"""Reproducible demonstration experiment; held-out learners and a forward-only time split.

Features are computed BEFORE the answer. The label is the NEXT observed correctness.
Synthetic results establish pipeline behavior, never real-world educational accuracy.
"""
import argparse
import json
from pathlib import Path
import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier, ExtraTreesClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score, brier_score_loss, log_loss, accuracy_score, mean_squared_error

ROOT=Path(__file__).resolve().parent
FEATURES=["mastery","accuracy","attempts","studyMinutes","difficulty","daysSince","prerequisite","plannedMinutes","horizonDays"]

def generate(seed=2026, learners=120):
    rng=np.random.default_rng(seed)
    rows=[]
    for user in range(learners):
        ability=rng.normal(0,.7)
        for topic in range(18):
            difficulty=2+topic%7
            skill=float(1/(1+np.exp(-(ability-.13*difficulty))))
            bkt=.15; correct=0; study=0
            for step in range(8):
                days=float(rng.uniform(0,8)); horizon=int(rng.integers(0,8)); planned=int(rng.choice([0,10,20,30,45,60,90]))
                prerequisite=float(np.clip(rng.normal(.55+ability*.12,.20),.05,1))
                values=[bkt,(correct+1)/(step+2),step,study,difficulty,days,prerequisite,planned,horizon]
                retained=.15+(skill-.15)*np.exp(-(days+horizon)/(25+step*3))
                skill=float(np.clip(retained+(1-retained)*(1-np.exp(-planned/(40+difficulty*7)))*(.5+.5*prerequisite),.02,.98))
                probability=skill*(1-(.08+.009*difficulty))+(1-skill)*.2
                label=int(rng.random()<probability)
                rows.append((user,step,values,label))
                slip=.08+.009*difficulty
                numerator=bkt*(1-slip) if label else bkt*slip
                bkt=numerator/(numerator+(1-bkt)*(.2 if label else .8))
                bkt=bkt+(1-bkt)*.06
                correct+=label; study+=planned
    return rows

def score(y,p):
    buckets=[]; ece=0
    for low in np.arange(0,1,.1):
        mask=(p>=low)&(p<low+.1 if low<.9 else p<=1)
        if mask.any():
            predicted=float(p[mask].mean()); observed=float(y[mask].mean())
            ece+=abs(predicted-observed)*mask.mean()
            buckets.append(dict(predicted=round(predicted,4),observed=round(observed,4),count=int(mask.sum())))
    return dict(auc=round(float(roc_auc_score(y,p)),4),brier=round(float(brier_score_loss(y,p)),4),
                rmse=round(float(np.sqrt(mean_squared_error(y,p))),4),logLoss=round(float(log_loss(y,p)),4),
                accuracy=round(float(accuracy_score(y,p>=.5)),4),ece=round(float(ece),4),calibration=buckets,samples=len(y))

def train(output=ROOT/"artifacts",seed=2026):
    rows=generate(seed)
    # Disjoint learners. Last two steps of training learners form a separate temporal evaluation.
    training=[r for r in rows if r[0]<72 and r[1]<6]
    calibration=[r for r in rows if 72<=r[0]<96]
    testing=[r for r in rows if r[0]>=96]
    temporal=[r for r in rows if r[0]<72 and r[1]>=6]
    def unpack(rows):return np.array([r[2] for r in rows]),np.array([r[3] for r in rows])
    x,y=unpack(training); xc,yc=unpack(calibration); xt,yt=unpack(testing); xf,yf=unpack(temporal)
    models={
        "Random Forest":RandomForestClassifier(n_estimators=100,min_samples_leaf=25,max_depth=10,random_state=seed,n_jobs=1),
        "Gradient Boosting":GradientBoostingClassifier(n_estimators=90,max_depth=2,min_samples_leaf=25,learning_rate=.05,random_state=seed),
        "Extra Trees":ExtraTreesClassifier(n_estimators=100,min_samples_leaf=25,max_depth=10,random_state=seed,n_jobs=1),
    }
    results={}
    for name,model in models.items():
        model.fit(x,y);results[name]=score(yt,model.predict_proba(xt)[:,1])
    baseline=make_pipeline(StandardScaler(),LogisticRegression(max_iter=1000,random_state=seed)).fit(x,y)
    results["Logistic baseline"]=score(yt,baseline.predict_proba(xt)[:,1])
    def mean_prob(features):return np.mean([m.predict_proba(features)[:,1] for m in models.values()],axis=0)
    def logits(p):return np.log(np.clip(p,1e-5,1-1e-5)/(1-np.clip(p,1e-5,1-1e-5))).reshape(-1,1)
    calibrator=LogisticRegression(C=10,random_state=seed).fit(logits(mean_prob(xc)),yc)
    def calibrated(features):return calibrator.predict_proba(logits(mean_prob(features)))[:,1]
    results["Calibrated ensemble"]=score(yt,calibrated(xt))
    importance=np.mean([m.feature_importances_ for m in models.values()],axis=0)
    report=dict(available=True,version="demo-ensemble-v1",dataset="synthetic",seed=seed,target="next_answer_correct",
                notice="合成学习行为上的演示评估，不能证明真实学习者的预测精度；答对概率不等于知识掌握的真实标签。",
                split=dict(trainLearners=72,calibrationLearners=24,testLearners=24,trainSamples=len(training),calibrationSamples=len(calibration),testSamples=len(testing),temporalSamples=len(temporal),learnerOverlap=0),
                models=results,temporal=score(yf,calibrated(xf)),features=[dict(name=f,importance=round(float(v),4)) for f,v in zip(FEATURES,importance)])
    output.mkdir(parents=True,exist_ok=True)
    joblib.dump(dict(models=models,calibrator=calibrator,features=FEATURES,report=report),output/"model.joblib")
    (output/"metrics.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps({"ensemble":results["Calibrated ensemble"],"split":report["split"]},ensure_ascii=False))
    return report

if __name__=="__main__":
    parser=argparse.ArgumentParser();parser.add_argument("--output",type=Path,default=ROOT/"artifacts");parser.add_argument("--seed",type=int,default=2026)
    args=parser.parse_args();train(args.output,args.seed)

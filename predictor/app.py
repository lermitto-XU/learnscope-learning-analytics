import hmac
import json
import os
from pathlib import Path
from functools import lru_cache
import joblib
import numpy as np
from fastapi import FastAPI, Depends, HTTPException, Header
from pydantic import BaseModel, Field, ConfigDict

ROOT=Path(__file__).resolve().parent
KEY=os.environ.get("PREDICTOR_KEY","")
app=FastAPI(title="LearnScope Prediction Engine",version="1.0.0",docs_url=None,redoc_url=None)

class Features(BaseModel):
    model_config=ConfigDict(extra="forbid",allow_inf_nan=False)
    mastery:float=Field(ge=0,le=1)
    accuracy:float=Field(ge=0,le=1)
    attempts:int=Field(ge=0,le=1_000_000)
    studyMinutes:float=Field(ge=0,le=1_000_000)
    difficulty:int=Field(ge=1,le=10)
    daysSince:float=Field(ge=0,le=10000)
    prerequisite:float=Field(ge=0,le=1)
    plannedMinutes:int=Field(ge=0,le=180)
    horizonDays:int=Field(ge=0,le=30)

def authorize(x_predictor_key:str=Header(default="")):
    if KEY and not hmac.compare_digest(KEY,x_predictor_key):raise HTTPException(403,"Invalid prediction service key")

@lru_cache(maxsize=1)
def bundle():
    path=ROOT/"artifacts/model.joblib"
    # Only locally generated, trusted model files are loaded. No model upload endpoint.
    return joblib.load(path) if path.exists() else None

def predict_many(items:list[Features]):
    model=bundle()
    if model is None:
        raise HTTPException(503,"No trained model; run train.py")
    x=np.array([[getattr(features,k) for k in model["features"]] for features in items])
    # Score the entire matrix once per model, including calibration. Scenario and
    # baseline therefore share the exact same model snapshot and processing path.
    probabilities={name:estimator.predict_proba(x)[:,1] for name,estimator in model["models"].items()}
    raw=np.clip(np.mean(list(probabilities.values()),axis=0),1e-5,1-1e-5)
    logits=np.log(raw/(1-raw)).reshape(-1,1)
    calibrated=model["calibrator"].predict_proba(logits)[:,1]
    results=[]
    for index,features in enumerate(items):
        outside=features.attempts>7 or features.studyMinutes>630 or features.plannedMinutes>90 or features.horizonDays>7 or features.daysSince>8 or features.difficulty>8
        results.append(dict(probability=round(float(calibrated[index]),4),source="calibrated-ensemble",modelVersion=model["report"]["version"],
                    modelSpread=[dict(name=name,probability=round(float(values[index]),4)) for name,values in probabilities.items()],
                    outOfDistribution=outside,notice="演示模型基于合成数据；模型之间的差异不是统计置信区间。"+(" 当前输入超出训练数据的常见范围，结果仅供探索。" if outside else "")))
    return results

def predict(features:Features):
    return predict_many([features])[0]

@app.get("/health")
def health():return dict(status="ok",modelLoaded=bundle() is not None)

@app.get("/metrics",dependencies=[Depends(authorize)])
def metrics():
    model=bundle()
    return model["report"] if model else dict(available=False,notice="模型尚未训练")

@app.post("/predict",dependencies=[Depends(authorize)])
def predict_endpoint(features:Features):return predict(features)

class Batch(BaseModel):
    model_config=ConfigDict(extra="forbid")
    items:list[Features]=Field(min_length=1,max_length=100)

@app.post("/predict/batch",dependencies=[Depends(authorize)])
def batch(request:Batch):return predict_many(request.items)

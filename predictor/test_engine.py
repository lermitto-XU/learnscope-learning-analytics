import unittest
from unittest.mock import Mock, patch
import numpy as np
from fastapi.testclient import TestClient
from app import app, bundle
from train import generate

class PredictionTests(unittest.TestCase):
    def test_feature_history_is_created_before_answer(self):
        rows=generate(2026,3)
        for user in range(3):
            history=[r for r in rows if r[0]==user][:8]
            for step,row in enumerate(history):
                self.assertEqual(row[2][2],step)
                previous_correct=sum(r[3] for r in history[:step])
                self.assertAlmostEqual(row[2][1],(previous_correct+1)/(step+2))
        self.assertEqual([r[3] for r in generate(2026,1)],[r[3] for r in generate(2026,1)])
    def test_prediction_is_bounded_and_batch_matches_single(self):
        client=TestClient(app)
        features=dict(mastery=.6,accuracy=.7,attempts=5,studyMinutes=90,difficulty=5,daysSince=3,prerequisite=.7,plannedMinutes=30,horizonDays=3)
        result=client.post('/predict',json=features)
        self.assertEqual(result.status_code,200)
        self.assertGreaterEqual(result.json()['probability'],0)
        self.assertLessEqual(result.json()['probability'],1)
        items=[features,{**features,'plannedMinutes':0},{**features,'plannedMinutes':120,'difficulty':10}]
        batched=client.post('/predict/batch',json=dict(items=items)).json()
        singles=[client.post('/predict',json=item).json() for item in items]
        self.assertEqual(batched,singles)
        self.assertEqual(batched[0],result.json())
        self.assertFalse(batched[0]['outOfDistribution'])
        self.assertTrue(batched[2]['outOfDistribution'])
        self.assertEqual(client.post('/predict',json={**features,'mastery':2}).status_code,422)
        self.assertEqual(client.post('/predict',json={**features,'unknown':1}).status_code,422)
        self.assertEqual(client.post('/predict/batch',json=dict(items=[])).status_code,422)
        self.assertEqual(client.post('/predict/batch',json=dict(items=[features]*101)).status_code,422)
        self.assertEqual(client.post('/predict/batch',json=dict(items=[features,{**features,'horizonDays':31}])).status_code,422)
        self.assertEqual(client.post('/predict/batch',json=dict(items=[{**features,'mastery':'NaN'}])).status_code,422)

    def test_batch_scores_each_model_once_and_calibrates_once(self):
        trained=bundle()
        spies={name:Mock(wraps=estimator) for name,estimator in trained['models'].items()}
        calibrator=Mock(wraps=trained['calibrator'])
        model={**trained,'models':spies,'calibrator':calibrator}
        features=dict(mastery=.6,accuracy=.7,attempts=5,studyMinutes=90,difficulty=5,daysSince=3,prerequisite=.7,plannedMinutes=30,horizonDays=3)
        with patch('app.bundle',return_value=model):
            response=TestClient(app).post('/predict/batch',json=dict(items=[features]*20))
        self.assertEqual(response.status_code,200)
        self.assertEqual(len(response.json()),20)
        for estimator in spies.values():
            estimator.predict_proba.assert_called_once()
            self.assertEqual(estimator.predict_proba.call_args.args[0].shape,(20,len(trained['features'])))
        calibrator.predict_proba.assert_called_once()
        self.assertEqual(calibrator.predict_proba.call_args.args[0].shape,(20,1))

    def test_missing_model_is_explicit_for_both_endpoints(self):
        features=dict(mastery=.6,accuracy=.7,attempts=5,studyMinutes=90,difficulty=5,daysSince=3,prerequisite=.7,plannedMinutes=30,horizonDays=3)
        with patch('app.bundle',return_value=None):
            client=TestClient(app)
            self.assertEqual(client.post('/predict',json=features).status_code,503)
            self.assertEqual(client.post('/predict/batch',json=dict(items=[features])).status_code,503)
    def test_metrics_include_separate_calibration_and_temporal_validation(self):
        report=bundle()['report']
        self.assertEqual(report['split']['learnerOverlap'],0)
        self.assertEqual(report['dataset'],'synthetic')
        self.assertIn('Logistic baseline',report['models'])
        self.assertGreater(report['temporal']['samples'],0)
        calibration=report['models']['Calibrated ensemble']['calibration']
        self.assertEqual(sum(b['count'] for b in calibration),report['split']['testSamples'])

if __name__=='__main__':unittest.main()

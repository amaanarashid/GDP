# AGV Predictive Maintenance — Python ML Server

A small FastAPI service that trains failure-prediction models on uploaded
datasets and serves live predictions to the React app.

## What it does
- **Auto-detects** sensor columns and the failure/label column in any CSV
- **Trains** a RandomForest classifier (handles class imbalance, gives risk %)
- **Predicts** failure risk % + estimated RUL (days) from live sensor values
- Stores one model per machine (keyed by machine_id)

## Setup (one time)
```bash
cd ml-server
pip install -r requirements.txt
```

## Run
```bash
python -m uvicorn main:app --reload --port 8000
```
Leave this running in its own terminal. You'll see:
```
Uvicorn running on http://127.0.0.1:8000
```

## Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/analyze` | Inspect a CSV — returns detected sensors, label, stats |
| POST | `/train`   | Train failure classifier on labelled CSV (`file`, `machine_id`) |
| POST | `/predict` | Failure risk % + RUL for live values (`machine_id`, `values`) |
| POST | `/train-anomaly` | Learn "normal" from a machine's DB history (`machine_id`) |
| POST | `/detect`  | Anomaly score 0–100 for live values (`machine_id`, `values`) |
| POST | `/predict-rul` | RUL with an 80% uncertainty range (`windows`: raw sensor windows) — MetroPT-3 quantile models + conformal calibration |
| GET  | `/evaluate-rul` | Held-out MetroPT-3 test-set replay: predicted vs actual RUL series + metrics (powers the app's Model Evaluation page) |
| GET  | `/evaluate-detector` | **Headline result**: unsupervised failure detector (IsolationForest on 2-h duty-cycle features, trained on healthy data only) — AUC 0.91 on two unseen real failures, oil leak flagged ~51 h before repair, 1.3% false alarms. Trained by `../rul_pipeline/04_train_detector.py` |
| GET  | `/health`  | Ping + list trained models |

## Three techniques (this is the project's ML story)
| Data source | Labels? | Technique | Endpoint |
|-------------|---------|-----------|----------|
| Uploaded CSV (e.g. AI4I) | Yes | Supervised failure classification (RandomForest, chronological train/test split) | `/train`, `/predict` |
| Simulated DB data (Supabase) | No | Unsupervised anomaly detection (Isolation Forest) | `/train-anomaly`, `/detect` |
| MetroPT-3 (real compressor data) | RUL (hours to failure) | Quantile regression (P10/P50/P90 HistGradientBoosting) + asymmetric conformal calibration (CQR) — trained offline by `../rul_pipeline/03_train_quantile.py` | `/predict-rul` |

### Honest evaluation notes (for the report)
- `/train` now splits **chronologically** (last 20% held out) instead of randomly —
  random splits leak future information on time-series data. On AI4I this drops
  F1 from ~0.72 to ~0.57 with AUC ~0.97; the lower number is the defensible one.
- `/predict-rul` returns `rul_days` (P50) plus `low_days`–`high_days`, an 80%
  prediction interval calibrated with asymmetric CQR on a temporal hold-out
  (coverage 0.78 on failures the model never saw, incl. an unseen failure type).

## Database connection
Copy `.env.example` to `.env` and add your Supabase URL + anon key
(the same keys the React app uses). Python only READS sensor data.

## Verified results on AI4I 2020 (real data)
```
Precision: 0.827   Recall: 0.632   F1: 0.717   ROC-AUC: 0.969
```
Feature importance (what drives failure):
```
Torque              0.327
Rotational speed    0.308
Tool wear           0.217
Air temperature     0.091
Process temperature 0.056
```

## Architecture
```
React app (5173)  ──REST──►  Python ML server (8000)
                                   │
                              models/ (trained .joblib per machine)
```

## Deploying later
The server is stateless except for the `models/` folder. To host online:
containerize with a Dockerfile and deploy to Railway / Render / Fly.io, then
point the app's ML_SERVER_URL at the deployed URL.

"""
============================================================
AGV Predictive Maintenance — Python ML Server (FastAPI)
============================================================
A small REST service the React app talks to. It:
  • /analyze   — reads an uploaded CSV, auto-detects sensor
                 columns and the failure/label column
  • /train     — trains a failure-risk classifier on the CSV
                 and saves the model per machine
  • /predict   — given live sensor values, returns failure
                 risk % and an estimated RUL (days)
  • /health    — simple ping

Design notes
  - Auto-detects columns so ANY tabular PdM dataset works,
    not just AI4I 2020.
  - Trains a RandomForest (robust, fast, handles imbalance,
    gives probability = risk %). No GPU needed.
  - Models are stored on disk keyed by machine_id so each
    real-data machine has its own trained model.

Run:
  pip install -r requirements.txt
  python -m uvicorn main:app --reload --port 8000
============================================================
"""

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import numpy as np
import joblib, os, io, json
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.model_selection import train_test_split
from sklearn.metrics import precision_score, recall_score, f1_score, roc_auc_score, roc_curve
from sklearn.preprocessing import StandardScaler
from dotenv import load_dotenv

load_dotenv()

# Supabase (read-only use of sensor data)
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY", "")
_sb = None
def sb():
    global _sb
    if _sb is None:
        from supabase import create_client
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise HTTPException(500, "Supabase keys not set in ml-server/.env")
        _sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _sb

app = FastAPI(title="AGV PdM ML Server")

# Allow the React dev server to call us
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],           # tighten in production
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_DIR = "models"
os.makedirs(MODEL_DIR, exist_ok=True)

# Words that hint a column is a failure/label (not a sensor)
LABEL_HINTS = ['fail', 'failure', 'label', 'target', 'status', 'fault', 'broken']
# Words that hint a column is an ID (ignore)
ID_HINTS = ['id', 'udi', 'index', 'timestamp', 'time', 'date', 'product']


# ─────────────────────────────────────────────────────────
# Column auto-detection
# ─────────────────────────────────────────────────────────
def detect_columns(df: pd.DataFrame):
    sensors, label_col, ignored = [], None, []
    # Find the binary failure column: prefer a hinted name that is 0/1
    candidates = []
    for c in df.columns:
        lc = str(c).lower()
        uniq = df[c].dropna().unique()
        is_binary = set(np.unique(uniq)).issubset({0, 1, 0.0, 1.0}) and len(uniq) <= 2
        if any(h in lc for h in LABEL_HINTS) and is_binary:
            candidates.append(c)
    # main failure column = the hinted binary with the most positives but not sub-type flags
    if candidates:
        # prefer one literally containing 'machine failure' or just 'failure'
        best = sorted(candidates, key=lambda c: df[c].sum(), reverse=True)
        label_col = best[0]

    for c in df.columns:
        lc = str(c).lower()
        if c == label_col:
            continue
        # ignore IDs and obvious sub-flags / non-numeric
        if any(h in lc for h in ID_HINTS):
            ignored.append(c); continue
        if not pd.api.types.is_numeric_dtype(df[c]):
            ignored.append(c); continue
        # ignore other binary flag columns (failure sub-types like TWF/HDF)
        uniq = df[c].dropna().unique()
        if set(np.unique(uniq)).issubset({0, 1}) and len(uniq) <= 2:
            ignored.append(c); continue
        sensors.append(c)

    return sensors, label_col, ignored


# ─────────────────────────────────────────────────────────
# /analyze — inspect an uploaded CSV
# ─────────────────────────────────────────────────────────
@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    content = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(400, f"Could not read CSV: {e}")

    sensors, label_col, ignored = detect_columns(df)

    def safe(x):
        # NaN is not valid JSON — an all-NaN column would break the response
        return 0.0 if pd.isna(x) else float(x)

    stats = {}
    for s in sensors:
        stats[s] = {
            "min": safe(df[s].min()),
            "max": safe(df[s].max()),
            "mean": safe(df[s].mean()),
            # warning at ~85th percentile, critical at ~97th
            "warning": safe(df[s].quantile(0.85)),
            "critical": safe(df[s].quantile(0.97)),
        }

    return {
        "rows": len(df),
        "sensors": sensors,
        "label_column": label_col,
        "ignored": ignored,
        "has_labels": label_col is not None,
        "stats": stats,
        "failure_rate": float(df[label_col].mean()) if label_col else None,
    }


# ─────────────────────────────────────────────────────────
# /train — train + save a model for a machine
# ─────────────────────────────────────────────────────────
@app.post("/train")
async def train(file: UploadFile = File(...), machine_id: str = Form(...)):
    content = await file.read()
    df = pd.read_csv(io.BytesIO(content))
    sensors, label_col, _ = detect_columns(df)

    if not sensors:
        raise HTTPException(400, "No numeric sensor columns detected.")
    if not label_col:
        raise HTTPException(400, "No failure/label column detected — cannot train a risk model.")

    X = df[sensors].fillna(0).values
    y = df[label_col].astype(int).values

    # ── Chronological split (no future leakage) ──────────────
    # Sensor data is a time series: a random split lets the model
    # "peek at the future" and inflates metrics. Sort by a time/order
    # column if one exists (timestamp, date, UDI, index...), else
    # keep the CSV's row order, and hold out the LAST 20% as test.
    order_col = None
    for c in df.columns:
        lc = str(c).lower()
        if any(h in lc for h in ('timestamp', 'time', 'date', 'udi', 'index')):
            try:
                if df[c].is_monotonic_increasing or pd.api.types.is_numeric_dtype(df[c]):
                    order_col = c
                    break
            except Exception:
                continue
    order = np.argsort(df[order_col].values, kind="stable") if order_col else np.arange(len(df))
    X, y = X[order], y[order]

    split = int(len(X) * 0.8)
    X_tr_raw, X_te_raw = X[:split], X[split:]
    y_tr, y_te = y[:split], y[split:]

    # Fit the scaler on TRAIN ONLY (fitting on all data is also leakage)
    scaler = StandardScaler().fit(X_tr_raw)
    X_tr, X_te = scaler.transform(X_tr_raw), scaler.transform(X_te_raw)

    if y_te.sum() == 0 or y_tr.sum() == 0:
        # Degenerate chronological split (all failures on one side) —
        # fall back to a random split but say so in metrics.
        # stratify needs >=2 samples per class; guard against tiny datasets.
        Xs = scaler.fit_transform(X)
        strat = y if np.bincount(y.astype(int)).min() >= 2 else None
        X_tr, X_te, y_tr, y_te = train_test_split(Xs, y, test_size=0.2, random_state=42, stratify=strat)
        split_kind = "random-stratified (chronological was degenerate)"
    else:
        split_kind = f"chronological (last 20% held out, ordered by {order_col or 'row order'})"

    clf = RandomForestClassifier(
        n_estimators=200, max_depth=12,
        class_weight="balanced", random_state=42, n_jobs=-1,
    )
    clf.fit(X_tr, y_tr)

    # Metrics for the report
    pred = clf.predict(X_te)
    proba = clf.predict_proba(X_te)[:, 1]
    metrics = {
        "precision": round(float(precision_score(y_te, pred, zero_division=0)), 3),
        "recall": round(float(recall_score(y_te, pred, zero_division=0)), 3),
        "f1": round(float(f1_score(y_te, pred, zero_division=0)), 3),
        "roc_auc": round(float(roc_auc_score(y_te, proba)), 3) if len(set(y_te)) > 1 else None,
        "test_size": int(len(y_te)),
        "failure_rate": round(float(y.mean()), 4),
        "split": split_kind,
    }

    # Feature importance (which sensor drives failure)
    importance = dict(sorted(
        {sensors[i]: round(float(clf.feature_importances_[i]), 3) for i in range(len(sensors))}.items(),
        key=lambda kv: kv[1], reverse=True,
    ))

    # ── Chart data for the app (test set only — never training rows) ──
    # 1. Predicted risk per test sample; keep every ACTUAL failure row so
    #    red markers survive downsampling.
    n = len(y_te)
    stride = max(1, n // 400)
    keep = sorted(set(range(0, n, stride)) | {i for i in range(n) if y_te[i] == 1})
    risk_series = [
        {"i": int(i), "risk": round(float(proba[i]), 4), "actual": int(y_te[i])}
        for i in keep
    ]
    # 2. ROC curve points (downsampled)
    roc_points = []
    if len(set(y_te)) > 1:
        fpr, tpr, _ = roc_curve(y_te, proba)
        rstep = max(1, len(fpr) // 150)
        roc_points = [{"fpr": round(float(fpr[i]), 4), "tpr": round(float(tpr[i]), 4)}
                      for i in range(0, len(fpr), rstep)]
        if not roc_points or roc_points[-1]["fpr"] != 1.0:
            roc_points.append({"fpr": 1.0, "tpr": 1.0})

    joblib.dump({"model": clf, "scaler": scaler, "sensors": sensors,
                 "label": label_col, "metrics": metrics, "importance": importance},
                f"{MODEL_DIR}/{machine_id}.joblib")

    return {"status": "trained", "sensors": sensors, "label_column": label_col,
            "metrics": metrics, "importance": importance,
            "risk_series": risk_series, "roc": roc_points}


# ─────────────────────────────────────────────────────────
# /predict — risk % + estimated RUL from live sensor values
# ─────────────────────────────────────────────────────────
class PredictReq(BaseModel):
    machine_id: str
    values: dict          # { sensor_name: value }

@app.post("/predict")
async def predict(req: PredictReq):
    path = f"{MODEL_DIR}/{req.machine_id}.joblib"
    if not os.path.exists(path):
        raise HTTPException(404, "No trained model for this machine. Train first.")
    bundle = joblib.load(path)
    sensors = bundle["sensors"]

    row = [float(req.values.get(s, 0)) for s in sensors]
    Xs = bundle["scaler"].transform([row])
    risk = float(bundle["model"].predict_proba(Xs)[0][1])   # probability of failure

    # Map risk → estimated RUL (days) via defined bands
    if   risk >= 0.80: rul_days = round(7 * (1 - risk) / 0.20, 1)      # 0–7 d
    elif risk >= 0.50: rul_days = round(7 + (0.80 - risk) / 0.30 * 23, 1)   # 7–30 d
    elif risk >= 0.20: rul_days = round(30 + (0.50 - risk) / 0.30 * 60, 1)  # 30–90 d
    else:              rul_days = round(90 + (0.20 - risk) / 0.20 * 90, 1)  # 90–180 d

    return {
        "risk": round(risk * 100, 1),          # %
        "rul_days": rul_days,
        "tier": ("critical" if risk >= 0.8 else "warning" if risk >= 0.5
                 else "watch" if risk >= 0.2 else "healthy"),
        "importance": bundle["importance"],
    }


# ─────────────────────────────────────────────────────────
# ANOMALY DETECTION (unsupervised, for unlabelled DB data)
# ─────────────────────────────────────────────────────────

def fetch_machine_matrix(machine_id: str, limit: int = 1000):
    """Pull recent sensor readings from Supabase and pivot into a
    matrix: rows = time points, columns = sensors."""
    client = sb()
    # sensors for this machine
    sres = client.table("sensors").select("id,name").eq("machine_id", machine_id).execute()
    sensors = sres.data or []
    if not sensors:
        raise HTTPException(404, "No sensors for this machine.")
    sid_to_name = {s["id"]: s["name"] for s in sensors}

    # readings for those sensors
    ids = list(sid_to_name.keys())
    rres = (client.table("sensor_readings")
            .select("sensor_id,value,timestamp")
            .in_("sensor_id", ids)
            .order("timestamp", desc=True)
            .limit(limit * len(ids))
            .execute())
    rows = rres.data or []
    if not rows:
        raise HTTPException(404, "No sensor readings found. Run the simulator first.")

    df = pd.DataFrame(rows)
    df["name"] = df["sensor_id"].map(sid_to_name)
    # pivot: average per timestamp+sensor, then wide
    pivot = df.pivot_table(index="timestamp", columns="name", values="value", aggfunc="mean")
    pivot = pivot.sort_index().fillna(method="ffill").fillna(method="bfill").dropna()
    return pivot, list(sid_to_name.values())


class MachineReq(BaseModel):
    machine_id: str

@app.post("/train-anomaly")
async def train_anomaly(req: MachineReq):
    """Learn normal operating behaviour for a machine from its DB history."""
    pivot, names = fetch_machine_matrix(req.machine_id)
    if len(pivot) < 20:
        raise HTTPException(400, f"Not enough readings ({len(pivot)}). Run the simulator longer.")

    X = pivot.values
    scaler = StandardScaler()
    Xs = scaler.fit_transform(X)

    iso = IsolationForest(n_estimators=150, contamination=0.05, random_state=42)
    iso.fit(Xs)

    # Calibrate scoring from the training distribution
    raw = iso.score_samples(Xs)
    score_mean = float(raw.mean())
    score_std  = float(raw.std()) or 1e-6

    joblib.dump({"model": iso, "scaler": scaler, "sensors": list(pivot.columns),
                 "score_mean": score_mean, "score_std": score_std},
                f"{MODEL_DIR}/{req.machine_id}_anomaly.joblib")

    return {
        "status": "trained",
        "rows_used": int(len(pivot)),
        "sensors": list(pivot.columns),
        "score_mean": score_mean,
        "score_std": score_std,
    }


class DetectReq(BaseModel):
    machine_id: str
    values: dict          # { sensor_name: value } — current live readings

@app.post("/detect")
async def detect(req: DetectReq):
    """Score how abnormal the current readings are (0=normal, 100=very abnormal)."""
    path = f"{MODEL_DIR}/{req.machine_id}_anomaly.joblib"
    if not os.path.exists(path):
        raise HTTPException(404, "No anomaly model. Train anomaly detection first.")
    bundle = joblib.load(path)
    sensors = bundle["sensors"]

    row = [float(req.values.get(s, 0)) for s in sensors]
    Xs = bundle["scaler"].transform([row])
    # isolation forest: lower score_samples = more anomalous
    raw = float(bundle["model"].score_samples(Xs)[0])
    is_anom = int(bundle["model"].predict(Xs)[0] == -1)

    # Calibrate to 0..100 using how many std-devs BELOW the training mean.
    # readings near/above mean -> ~0; several std below -> ->100.
    mean = bundle.get("score_mean", -0.5)
    std  = bundle.get("score_std", 0.1)
    z = (mean - raw) / std            # positive when more anomalous than normal
    anomaly_pct = round(max(0, min(100, z * 25)), 1)

    return {
        "anomaly_score": anomaly_pct,
        "is_anomaly": bool(is_anom),
        "tier": ("critical" if anomaly_pct >= 70 else "warning" if anomaly_pct >= 40 else "normal"),
    }


# ─────────────────────────────────────────────────────────
# RUL WITH UNCERTAINTY (MetroPT-3 quantile models + conformal)
# Serves the models trained offline by rul_pipeline/03_train_quantile.py.
# Returns P50 ("best guess") plus a calibrated [low, high] range so
# the app can show "8–15 days" instead of a false-precision number.
# This is the single source of truth for RUL feature engineering —
# the browser sends raw sensor windows, we compute features here.
# ─────────────────────────────────────────────────────────
RUL_ART = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "rul_pipeline", "artifacts")
_rul_bundle = None

def rul_bundle():
    """Lazy-load quantile models + scaler + conformal correction (once)."""
    global _rul_bundle
    if _rul_bundle is None:
        try:
            meta = json.load(open(os.path.join(RUL_ART, "meta.json")))
            conformal = json.load(open(os.path.join(RUL_ART, "conformal.json")))
            _rul_bundle = {
                "scaler": joblib.load(os.path.join(RUL_ART, "feature_scaler.joblib")),
                "q10": joblib.load(os.path.join(RUL_ART, "model_rul_q10.joblib")),
                "q50": joblib.load(os.path.join(RUL_ART, "model_rul_q50.joblib")),
                "q90": joblib.load(os.path.join(RUL_ART, "model_rul_q90.joblib")),
                "sensors": meta["sensors"],
                "window": meta.get("window", 60),
                "rul_cap": meta.get("rul_cap_h", 336),
                "qhat_lo": conformal["qhat_lo_h"],
                "qhat_hi": conformal["qhat_hi_h"],
                "alpha": conformal.get("alpha", 0.2),
            }
        except FileNotFoundError as e:
            raise HTTPException(503, f"RUL models not trained yet — run rul_pipeline/03_train_quantile.py ({e})")
    return _rul_bundle


def window_features(values):
    """Match the training pipeline exactly (01_build_dataset.py):
    val = last, mean, std (ddof=1), slope = (last-first)/(n-1)."""
    v = []
    for x in values:
        try:
            f = float(x)
            if not np.isnan(f):
                v.append(f)
        except (TypeError, ValueError):
            continue                     # skip non-numeric junk instead of 500ing
    if not v:
        return [0.0, 0.0, 0.0, 0.0]
    val, mean = v[-1], float(np.mean(v))
    std = float(np.std(v, ddof=1)) if len(v) > 1 else 0.0
    slope = (v[-1] - v[0]) / (len(v) - 1) if len(v) > 1 else 0.0
    return [val, mean, std, slope]


class RulReq(BaseModel):
    windows: dict         # { dataset_column: [recent values, oldest→newest] }

@app.post("/predict-rul")
async def predict_rul(req: RulReq):
    b = rul_bundle()
    feats = []
    for col in b["sensors"]:                       # exact training order
        feats.extend(window_features(req.windows.get(col, [])))
    Xs = b["scaler"].transform([feats])

    p10 = float(b["q10"].predict(Xs)[0])
    p50 = float(b["q50"].predict(Xs)[0])
    p90 = float(b["q90"].predict(Xs)[0])

    cap = b["rul_cap"]
    # quantile-crossing fix, then conformal widening, then clip to [0, cap]
    mid  = min(max(p50, 0), cap)
    low  = min(max(min(p10, p50) - b["qhat_lo"], 0), cap)
    high = min(max(max(p90, p50) + b["qhat_hi"], 0), cap)

    return {
        "rul_hours": round(mid, 1),
        "rul_days": round(mid / 24, 1),
        "low_days": round(low / 24, 1),
        "high_days": round(high / 24, 1),
        "coverage_target": 1 - b["alpha"],          # e.g. 0.8 → "80% interval"
        "capped_at_days": round(cap / 24, 1),
        "model_version": "metropt3-quantile-cqr-v2",
    }


# ─────────────────────────────────────────────────────────
# MODEL EVALUATION (held-out real-data test set)
# Replays the MetroPT-3 TEST window (June–July 2020, two real
# failures the model never saw — one of an unseen type) through
# the quantile models and returns predicted vs actual RUL, so the
# app can PROVE the model works on real data.
# ─────────────────────────────────────────────────────────
_eval_cache = None

@app.get("/evaluate-rul")
def evaluate_rul(points: int = 400):
    global _eval_cache
    if _eval_cache is None:
        b = rul_bundle()
        try:
            X = np.load(os.path.join(RUL_ART, "X_test.npy"))
            y = np.load(os.path.join(RUL_ART, "y_test.npy"))
            t = np.load(os.path.join(RUL_ART, "t_test.npy"))   # epoch seconds
            meta = json.load(open(os.path.join(RUL_ART, "meta.json")))
            metrics = json.load(open(os.path.join(RUL_ART, "metrics_quantile.json")))
        except FileNotFoundError as e:
            raise HTTPException(503, f"Evaluation artifacts missing — run the rul_pipeline scripts ({e})")

        Xs = b["scaler"].transform(X)
        p10 = b["q10"].predict(Xs)
        p50 = b["q50"].predict(Xs)
        p90 = b["q90"].predict(Xs)
        cap = b["rul_cap"]
        mid  = np.clip(p50, 0, cap)
        low  = np.clip(np.minimum(p10, p50) - b["qhat_lo"], 0, cap)
        high = np.clip(np.maximum(p90, p50) + b["qhat_hi"], 0, cap)

        # Failure events that fall inside the test window
        t0, t1 = int(t.min()), int(t.max())
        failures = []
        for onset, recovery, ftype in meta.get("failures", []):
            ms = int(pd.Timestamp(onset).timestamp())
            if t0 <= ms <= t1 + 6 * 3600:
                failures.append({"onset_ms": ms * 1000, "type": ftype, "onset": onset})

        _eval_cache = {
            "t_ms": (t.astype("int64") * 1000).tolist(),
            "actual_d": (y / 24).round(2).tolist(),
            "p50_d": (mid / 24).round(2).tolist(),
            "low_d": (low / 24).round(2).tolist(),
            "high_d": (high / 24).round(2).tolist(),
            "failures": failures,
            "metrics": {
                "mae_days": round(metrics["P50_MAE_h"] / 24, 2),
                "rmse_days": round(metrics["P50_RMSE_h"] / 24, 2),
                "interval_coverage": round(metrics["interval_coverage"], 3),
                "coverage_target": 1 - metrics.get("alpha", 0.2),
                "n_test": metrics["n_test"],
                "split": metrics["split"],
            },
            "train_window": "Feb–May 2020 (failures F1, F2 — air leaks)",
            "test_window": "Jun–Jul 2020 (failures F3 oil leak + F4 air leak, both unseen)",
            "dataset": "MetroPT-3 — Metro do Porto air production unit (real)",
            "model_version": "metropt3-quantile-cqr-v2",
        }

    c = _eval_cache
    n = len(c["t_ms"])
    step = max(1, n // max(50, min(points, 2000)))
    idx = list(range(0, n, step))
    series = [
        {"t": c["t_ms"][i], "actual": c["actual_d"][i], "p50": c["p50_d"][i],
         "low": c["low_d"][i], "high": c["high_d"][i]}
        for i in idx
    ]
    return {
        "series": series,
        "failures": c["failures"],
        "metrics": c["metrics"],
        "train_window": c["train_window"],
        "test_window": c["test_window"],
        "dataset": c["dataset"],
        "model_version": c["model_version"],
        "n_points": len(series),
    }


# ─────────────────────────────────────────────────────────
# FAILURE DETECTOR EVALUATION (headline result)
# Precomputed by rul_pipeline/04_train_detector.py: unsupervised
# IsolationForest on 2-h duty-cycle features, trained on healthy
# Feb–May data only, scored on the unseen Jun–Jul window with two
# real failures. Served as-is from artifacts (no recompute).
# ─────────────────────────────────────────────────────────
@app.get("/evaluate-detector")
def evaluate_detector():
    path = os.path.join(RUL_ART, "detector_eval.json")
    if not os.path.exists(path):
        raise HTTPException(503, "Detector not trained — run rul_pipeline/04_train_detector.py")
    return json.load(open(path))


@app.get("/health")
def health():
    files = os.listdir(MODEL_DIR)
    classifiers = [f[:-7] for f in files if f.endswith(".joblib") and not f.endswith("_anomaly.joblib")]
    anomaly = [f[:-15] for f in files if f.endswith("_anomaly.joblib")]
    return {"status": "ok", "classifier_models": classifiers, "anomaly_models": anomaly}

# ============================================================
# 04 — FAILURE DETECTOR (unsupervised, the project's headline)
# IsolationForest trained ONLY on healthy Feb–May data, using
# 2-hour duty-cycle features (an air leak makes the compressor
# run more often; an oil problem shifts temperature patterns —
# both show up in multi-hour aggregates, not 10-min windows).
#
# Evaluated on the unseen Jun–Jul window containing two REAL
# failures (one oil leak — a type absent from training):
#   AUC ≈ 0.91, oil leak flagged ~70 min after onset
#   (≈ 51 h before the repair), false alarms ≈ 1.3%.
#
# Outputs (artifacts/):
#   detector.joblib        (scaler + model + features + threshold)
#   detector_eval.json     (test score series + metrics for the app)
# ============================================================
import json, joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score
import config as C

np.random.seed(C.SEED)
A = C.ARTIFACTS

SIGNALS   = ['COMP', 'DV_eletric', 'MPG', 'TP2', 'Oil_temperature', 'Motor_current', 'H1', 'LPS']
ROLL_MIN  = 120          # 2-hour rolling window (minutes)
SMOOTH    = 15           # score smoothing (minutes)
THR_Q     = 0.995        # alarm threshold = this quantile of healthy-train scores
TRAIN_END = pd.Timestamp(C.TRAIN_END)
TEST_END  = pd.Timestamp("2020-07-16")

print("loading raw CSV (1-min resample)…")
df = pd.read_csv(C.DATA_CSV, usecols=['timestamp'] + SIGNALS, parse_dates=['timestamp'])
df = df.set_index('timestamp').resample('1min').mean()

F = pd.DataFrame(index=df.index)
r = df.rolling(ROLL_MIN, min_periods=ROLL_MIN // 2)
for c in SIGNALS:
    F[f'{c}_2h'] = r[c].mean()
F = F.dropna()
t = F.index

in_fail = np.zeros(len(F), bool)
for onset, recovery, _type in C.FAILURES:
    in_fail |= np.asarray((t >= pd.Timestamp(onset)) & (t <= pd.Timestamp(recovery)))

tr_healthy = np.asarray(t < TRAIN_END) & ~in_fail
te         = np.asarray(t >= TRAIN_END) & np.asarray(t <= TEST_END)
print(f"healthy train minutes: {tr_healthy.sum():,}  test minutes: {te.sum():,}")

scaler = StandardScaler().fit(F.values[tr_healthy])
iso = IsolationForest(n_estimators=200, contamination=0.01, random_state=C.SEED, n_jobs=-1)
iso.fit(scaler.transform(F.values[tr_healthy]))

def smooth_scores(X):
    raw = -iso.score_samples(scaler.transform(X))
    return pd.Series(raw).rolling(SMOOTH, min_periods=5).mean().bfill().values

s_tr = smooth_scores(F.values[tr_healthy])
thr  = float(np.quantile(s_tr, THR_Q))
s_te = smooth_scores(F.values[te])
lab  = in_fail[te]
tt   = t[te]

auc = float(roc_auc_score(lab, s_te))
fa  = float((s_te[~lab] >= thr).mean())

events = []
for onset, recovery, ftype in C.FAILURES:
    a, b = pd.Timestamp(onset), pd.Timestamp(recovery)
    if a < TRAIN_END:
        continue                      # only score the unseen test failures
    m = np.asarray((tt >= a) & (tt <= b))
    above = s_te[m] >= thr
    first = int(np.argmax(above)) if above.any() else None
    events.append({
        "onset": onset, "recovery": recovery, "type": ftype,
        "onset_ms": int(a.timestamp() * 1000), "recovery_ms": int(b.timestamp() * 1000),
        "detected_after_min": first,
        "lead_hours_before_repair": round(((b - (a + pd.Timedelta(minutes=first))).total_seconds() / 3600), 1) if first is not None else None,
        "pct_interval_flagged": round(float(above.mean()) * 100, 1),
    })

joblib.dump({"scaler": scaler, "model": iso, "features": list(F.columns),
             "threshold": thr, "smooth_min": SMOOTH, "roll_min": ROLL_MIN,
             "signals": SIGNALS}, A / "detector.joblib")

# Downsampled score series for the app chart — per-bucket MAX so
# short alarms survive downsampling.
N_POINTS = 700
step = max(1, len(s_te) // N_POINTS)
series = []
for i in range(0, len(s_te), step):
    j = min(i + step, len(s_te))
    k = i + int(np.argmax(s_te[i:j]))
    series.append({"t": int(tt[k].timestamp() * 1000),
                   "score": round(float(s_te[k]), 4),
                   "in_failure": bool(lab[i:j].any())})

eval_out = {
    "series": series,
    "threshold": round(thr, 4),
    "events": events,
    "metrics": {
        "auc": round(auc, 3),
        "false_alarm_rate": round(fa, 4),
        "trained_on": "healthy Feb–May 2020 only (unsupervised — no failure labels used)",
        "test_window": "Jun–Jul 2020 (two unseen real failures, incl. an oil leak type absent from training)",
    },
    "feature_desc": "2-hour rolling duty cycles / means of 8 signals, 15-min score smoothing",
    "model_version": "metropt3-detector-v1",
}
json.dump(eval_out, open(A / "detector_eval.json", "w"))
print(json.dumps({**eval_out, "series": f"[{len(series)} points]"}, indent=2))

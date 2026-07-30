# ============================================================
# 03 — QUANTILE RUL MODELS (P10 / P50 / P90) + CONFORMAL CALIBRATION
# Instead of one point estimate ("12 days"), train three
# HistGradientBoosting models at quantiles 0.1, 0.5, 0.9 so the
# app can show an honest range ("8–15 days").
#
# Raw quantile intervals are too narrow under distribution shift
# (empirical coverage was 62% vs the 80% target), so we apply
# asymmetric CQR (Conformalized Quantile Regression, Romano et
# al. 2019): hold out the last 20% of train temporally, measure
# how far the truth falls outside each side of [P10,P90] there,
# and widen each side by its own conformity quantile.
#   symmetric CQR  -> coverage 0.98, width 330 h (overcorrects)
#   asymmetric CQR -> coverage 0.78, width 317 h (kept)
#
# Leakage-safe: reuses the temporal split from 01 (train = F1+F2,
# test = F3+F4) and the scaler fitted on TRAIN only in 02. Note
# test includes an OIL-LEAK failure never seen in training — the
# wide interval honestly reflects that uncertainty.
#
# Outputs (artifacts/):
#   model_rul_q10.joblib / q50 / q90
#   conformal.json          (qhat_lo_h, qhat_hi_h, alpha)
#   metrics_quantile.json   (P50 MAE/RMSE + interval coverage/width)
# ============================================================
import json, joblib
import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error
import config as C

np.random.seed(C.SEED)
A = C.ARTIFACTS
ALPHA = 0.20            # target: ~80% of true RULs inside the interval

Xtr, ytr = np.load(A / "X_train.npy"), np.load(A / "y_train.npy")
Xte, yte = np.load(A / "X_test.npy"),  np.load(A / "y_test.npy")
scaler = joblib.load(A / "feature_scaler.joblib")   # fitted on TRAIN in 02
Xtr_s, Xte_s = scaler.transform(Xtr), scaler.transform(Xte)

# Temporal calibration split: fit on first 80% of train, calibrate on last 20%
n_cal = int(len(Xtr_s) * 0.2)
Xfit, yfit = Xtr_s[:-n_cal], ytr[:-n_cal]
Xcal, ycal = Xtr_s[-n_cal:], ytr[-n_cal:]
print(f"fit {Xfit.shape}  calib {Xcal.shape}  test {Xte.shape}")

QUANTILES = {"q10": 0.10, "q50": 0.50, "q90": 0.90}

def make(q):
    return HistGradientBoostingRegressor(
        loss="quantile", quantile=q,
        max_iter=200, learning_rate=0.06, max_depth=8,
        random_state=C.SEED,
    )

# ── Step 1: fit on the fit-portion, compute per-side conformity ──
cal_pred = {tag: make(q).fit(Xfit, yfit).predict(Xcal) for tag, q in QUANTILES.items()}
lo_c = np.minimum(cal_pred["q10"], cal_pred["q50"])
hi_c = np.maximum(cal_pred["q90"], cal_pred["q50"])
qhat_lo = float(np.quantile(lo_c - ycal, 1 - ALPHA))   # widen lower bound down
qhat_hi = float(np.quantile(ycal - hi_c, 1 - ALPHA))   # widen upper bound up
print(f"conformal widening: lo -{qhat_lo:.1f} h, hi +{qhat_hi:.1f} h")
json.dump({"qhat_lo_h": qhat_lo, "qhat_hi_h": qhat_hi, "alpha": ALPHA},
          open(A / "conformal.json", "w"), indent=2)

# ── Step 2: refit final models on ALL of train, save for serving ──
preds = {}
for tag, q in QUANTILES.items():
    mdl = make(q).fit(Xtr_s, ytr)
    preds[tag] = mdl.predict(Xte_s)
    joblib.dump(mdl, A / f"model_rul_{tag}.joblib")
    print(f"trained {tag} (quantile={q})")

# ── Step 3: evaluate on the held-out temporal TEST set ──
mid = np.clip(preds["q50"], 0, C.RUL_CAP_H)
lo  = np.clip(np.minimum(preds["q10"], preds["q50"]) - qhat_lo, 0, C.RUL_CAP_H)
hi  = np.clip(np.maximum(preds["q90"], preds["q50"]) + qhat_hi, 0, C.RUL_CAP_H)

metrics = {
    "P50_MAE_h":  float(mean_absolute_error(yte, mid)),
    "P50_RMSE_h": float(np.sqrt(mean_squared_error(yte, mid))),
    # How often the true RUL falls inside the conformal interval — target ~0.80
    "interval_coverage": float(np.mean((yte >= lo) & (yte <= hi))),
    "interval_width_mean_h": float(np.mean(hi - lo)),
    "conformal_qhat_lo_h": qhat_lo,
    "conformal_qhat_hi_h": qhat_hi,
    "alpha": ALPHA,
    "n_test": int(len(yte)),
    "split": "temporal (train F1+F2, test F3+F4); asymmetric CQR calibrated on last 20% of train",
}
json.dump(metrics, open(A / "metrics_quantile.json", "w"), indent=2)
print(json.dumps(metrics, indent=2))
print("saved: model_rul_q10/q50/q90.joblib + conformal.json + metrics_quantile.json")

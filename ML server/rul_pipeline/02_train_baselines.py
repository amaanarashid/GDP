# ============================================================
# 02 — TRAIN + BENCHMARK (classical + feedforward NN)
# Ridge (baseline) -> RandomForest -> HistGradientBoosting -> MLP.
# Leakage-safe: fit scaler on TRAIN only; TimeSeriesSplit CV on
# train; final metrics on the held-out temporal TEST set.
# The MLP is the model exported to the app.
# ============================================================
import json, joblib
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import Ridge
from sklearn.ensemble import RandomForestRegressor, HistGradientBoostingRegressor
from sklearn.neural_network import MLPRegressor
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import config as C

np.random.seed(C.SEED)
A = C.ARTIFACTS
Xtr, ytr = np.load(A/"X_train.npy"), np.load(A/"y_train.npy")
Xte, yte = np.load(A/"X_test.npy"),  np.load(A/"y_test.npy")
print("train", Xtr.shape, "test", Xte.shape)

scaler = StandardScaler().fit(Xtr)
Xtr_s, Xte_s = scaler.transform(Xtr), scaler.transform(Xte)

def metrics(y, p):
    return dict(MAE=float(mean_absolute_error(y, p)),
                RMSE=float(np.sqrt(mean_squared_error(y, p))),
                R2=float(r2_score(y, p)))

models = {
    "Ridge (baseline)":        Ridge(alpha=1.0, random_state=C.SEED),
    "HistGradientBoosting":    HistGradientBoostingRegressor(max_iter=200, learning_rate=0.06,
                                    max_depth=8, random_state=C.SEED),
    "MLP (neural net)":        MLPRegressor(hidden_layer_sizes=(64, 32), activation='relu',
                                    alpha=1e-3, max_iter=400, early_stopping=True,
                                    random_state=C.SEED),
    "RandomForest":            RandomForestRegressor(n_estimators=30, max_depth=10,
                                    n_jobs=-1, random_state=C.SEED),
}

# Resumable: each model saves its own metrics+preds as it finishes; re-run
# until all four are present. (2-core sandbox -> keep each fit affordable.)
res_path = A/"metrics_baselines.json"
results = json.load(open(res_path)) if res_path.exists() else {}
joblib.dump(scaler, A/"feature_scaler.joblib")

# lightweight temporal CV clones (cheap enough to fit alongside one final fit)
tscv = TimeSeriesSplit(n_splits=3)
cv_clone = {
    "Ridge (baseline)":     Ridge(alpha=1.0),
    "RandomForest":         RandomForestRegressor(n_estimators=15, max_depth=10, n_jobs=-1, random_state=C.SEED),
    "HistGradientBoosting": HistGradientBoostingRegressor(max_iter=150, learning_rate=0.06, max_depth=8, random_state=C.SEED),
    "MLP (neural net)":     MLPRegressor(hidden_layer_sizes=(64, 32), alpha=1e-3, max_iter=250,
                                early_stopping=True, random_state=C.SEED),
}

for name, mdl in models.items():
    tag = name.split()[0].lower()
    if name in results:
        print("[skip]", name); continue
    # final fit + held-out test
    mdl.fit(Xtr_s, ytr)
    p = np.clip(mdl.predict(Xte_s), 0, C.RUL_CAP_H)
    m = metrics(yte, p)
    # temporal cross-validation (mean +/- std of MAE)
    cv = []
    for tr, va in tscv.split(Xtr_s):
        c = cv_clone[name]; c.fit(Xtr_s[tr], ytr[tr])
        cv.append(mean_absolute_error(ytr[va], c.predict(Xtr_s[va])))
    m["CV_MAE_mean"], m["CV_MAE_std"] = float(np.mean(cv)), float(np.std(cv))
    results[name] = m
    joblib.dump(mdl, A/f"model_{tag}.joblib")
    np.save(A/f"pred_{tag}.npy", p)
    json.dump(results, open(res_path, "w"), indent=2)   # checkpoint after each model
    print(name, "->", {k: round(v, 3) for k, v in m.items()})

print("done models:", list(results))

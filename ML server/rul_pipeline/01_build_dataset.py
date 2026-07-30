# ============================================================
# 01 — BUILD DATASET
# Raw MetroPT-3 CSV -> windowed features + RUL labels, with a
# leakage-safe temporal split. Produces cached .npy arrays used
# by every downstream stage.
#
# Feature engineering is byte-for-byte compatible with the app's
# realRulModel.js windowStats(): per sensor [val, mean, std, slope]
#   val   = last value in the window
#   mean  = window mean
#   std   = sample std (ddof=1, pandas default)
#   slope = mean of consecutive diffs = (last - first) / (win-1)
# ============================================================
import json
import numpy as np
import pandas as pd
from numpy.lib.stride_tricks import sliding_window_view
import config as C

np.random.seed(C.SEED)
print("Reading:", C.DATA_CSV)

df = pd.read_csv(C.DATA_CSV, usecols=['timestamp'] + C.ANALOG)
df['timestamp'] = pd.to_datetime(df['timestamp'])
df = df.sort_values('timestamp').reset_index(drop=True)
n = len(df)
print(f"rows={n:,}  {df.timestamp.min()} -> {df.timestamp.max()}")

t = df['timestamp'].values.astype('datetime64[s]')
S = df[C.ANALOG].to_numpy(dtype=np.float32)          # (n, 7)

# ── Windowed tabular features (vectorised, app-parity) ─────
W = C.WINDOW
feat_cols, feats = [], []
for j, name in enumerate(C.ANALOG):
    s = pd.Series(S[:, j])
    val   = s.to_numpy()
    mean  = s.rolling(W).mean().to_numpy()
    std   = s.rolling(W).std().to_numpy()                       # ddof=1
    slope = (s - s.shift(W - 1)).to_numpy() / (W - 1)           # == mean of diffs
    for fname, arr in zip(C.FEATS_PER_SENSOR, [val, mean, std, slope]):
        feats.append(arr.astype(np.float32)); feat_cols.append(f"{name}_{fname}")
X_all = np.column_stack(feats)                        # (n, 28)

# ── RUL label = hours to next failure onset (capped) ───────
onsets = np.array([np.datetime64(pd.Timestamp(o)) for o, _, _ in C.FAILURES], dtype='datetime64[s]')
wins   = [(np.datetime64(pd.Timestamp(o)), np.datetime64(pd.Timestamp(r))) for o, r, _ in C.FAILURES]

onsets = np.sort(onsets)
pos = np.searchsorted(onsets, t, side='left')          # first onset >= t
rul_h = np.full(n, np.nan, dtype=np.float32)
has_future = pos < onsets.size
rul_h[has_future] = (onsets[pos[has_future]] - t[has_future]) / np.timedelta64(1, 'h')
rul_h = np.minimum(rul_h, C.RUL_CAP_H)

# mask rows that are INSIDE a failure window (machine already failed)
in_fail = np.zeros(n, dtype=bool)
for o, r in wins:
    in_fail |= (t >= o) & (t <= r)

# ── Valid sample mask: full window available, has RUL, healthy,
#    and taken every STRIDE readings ─────────────────────────
valid = np.zeros(n, dtype=bool)
idx = np.arange(n)
valid[(idx >= W - 1) & (idx % C.STRIDE == 0)] = True
valid &= ~np.isnan(rul_h) & ~in_fail & ~np.isnan(X_all).any(axis=1)
sel = np.where(valid)[0]
print(f"usable samples: {sel.size:,}")

# ── LSTM sequences: the raw 60-reading window, downsampled x3
#    -> (n_samples, 20, 7) ────────────────────────────────────
DS = 3
seq_full = sliding_window_view(S, W, axis=0)          # (n-W+1, 7, W)
# map sample row i -> window ending at i => start index i-W+1
seq_idx = sel - (W - 1)
SEQ = seq_full[seq_idx]                               # (m, 7, W)
SEQ = np.transpose(SEQ, (0, 2, 1))[:, ::DS, :]        # (m, 20, 7)

# ── Temporal split ─────────────────────────────────────────
split = np.datetime64(pd.Timestamp(C.TRAIN_END))
ts_sel = t[sel]
is_train = ts_sel < split

def save(split_name, mask):
    np.save(C.ARTIFACTS / f"X_{split_name}.npy",   X_all[sel][mask])
    np.save(C.ARTIFACTS / f"seq_{split_name}.npy", SEQ[mask].astype(np.float32))
    np.save(C.ARTIFACTS / f"y_{split_name}.npy",   rul_h[sel][mask])
    np.save(C.ARTIFACTS / f"ycls_{split_name}.npy",(rul_h[sel][mask] <= C.HORIZON_H).astype(np.int8))
    np.save(C.ARTIFACTS / f"t_{split_name}.npy",   ts_sel[mask].astype('datetime64[s]').astype(np.int64))

save("train", is_train)
save("test",  ~is_train)

meta = dict(feature_names=feat_cols, sensors=C.ANALOG, window=W, stride=C.STRIDE,
            rul_cap_h=C.RUL_CAP_H, horizon_h=C.HORIZON_H, seq_len=SEQ.shape[1],
            n_train=int(is_train.sum()), n_test=int((~is_train).sum()),
            train_end=C.TRAIN_END, failures=C.FAILURES)
json.dump(meta, open(C.ARTIFACTS / "meta.json", "w"), indent=2)
print("train/test:", meta['n_train'], meta['n_test'])
print("pos rate (fail<=24h) train/test:",
      round(float((rul_h[sel][is_train] <= C.HORIZON_H).mean()), 4),
      round(float((rul_h[sel][~is_train] <= C.HORIZON_H).mean()), 4))
print("saved artifacts ->", C.ARTIFACTS)

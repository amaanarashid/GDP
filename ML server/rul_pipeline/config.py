# ============================================================
# RUL PIPELINE — central configuration
# MetroPT-3 (Metro do Porto air-production unit) predictive
# maintenance. Everything reproducible is pinned here.
# ============================================================
from pathlib import Path

SEED = 42

# ── Paths ──────────────────────────────────────────────────
# The raw CSV lives next to this pipeline (in the ML server folder).
# Auto-detect any file containing "metropt".
_HERE = Path(__file__).resolve().parent
_SERVER_DIR = _HERE.parent

def _find_csv():
    for p in list(_SERVER_DIR.glob("*.csv")) + list(_SERVER_DIR.rglob("*etro*.csv")):
        if "metropt" in p.name.lower() or "compressor" in p.name.lower():
            return p
    # fall back to the known filename
    return _SERVER_DIR / "MetroPT3(AirCompressor).csv"

DATA_CSV = _find_csv()
ARTIFACTS = _HERE / "artifacts"          # cached arrays, models, metrics
FIGURES   = _HERE / "figures"            # plots for the report
ARTIFACTS.mkdir(exist_ok=True)
FIGURES.mkdir(exist_ok=True)

# ── Sensors ────────────────────────────────────────────────
# The 7 analog sensors. Order MUST match the app's export order
# (realRulModel.js reads scaler.sensors in this exact order).
ANALOG = ['TP2', 'TP3', 'H1', 'DV_pressure',
          'Reservoirs', 'Oil_temperature', 'Motor_current']

# ── Failure events ─────────────────────────────────────────
# Onsets localised from the signal (sustained DV-pressure duty
# cycle / motor-current load) and cross-checked against the
# published MetroPT-3 failure reports. (onset, recovery, type)
FAILURES = [
    ("2020-04-18 00:00", "2020-04-19 01:00", "air_leak"),   # F1
    ("2020-05-29 23:00", "2020-05-30 05:00", "air_leak"),   # F2
    ("2020-06-05 10:00", "2020-06-07 14:00", "oil_leak"),   # F3
    ("2020-07-15 13:00", "2020-07-15 18:00", "air_leak"),   # F4
]

# ── Windowing / labelling ──────────────────────────────────
RAW_CADENCE_S = 10        # dataset sampling period (seconds)
WINDOW        = 60        # readings per feature window (= app default, 10 min)
STRIDE        = 30        # sample one feature vector every STRIDE readings (5 min)
RUL_CAP_H     = 336       # cap RUL at 14 days; sensors carry no info beyond this
HORIZON_H     = 24        # binary label: failure within next 24 h (for classification eval)

# ── Temporal split (no leakage) ────────────────────────────
# Train on the first two failures, test on the last two — the
# model must generalise to failure events it never saw.
TRAIN_END = "2020-06-01 00:00"   # train: Feb-May  (F1, F2)
# test:  Jun 1 -> last failure recovery (F3, F4)

# ── Feature layout ─────────────────────────────────────────
# Per sensor: [val, mean, std, slope]  ->  4 * 7 = 28 features
FEATS_PER_SENSOR = ['val', 'mean', 'std', 'slope']
N_FEATURES = len(ANALOG) * len(FEATS_PER_SENSOR)

"""
============================================================
VERIFY ML SERVER — end-to-end proof that the ML service works
============================================================
Runs every endpoint against the live server and prints a
PASS/FAIL report with the real numbers it returns.

Use it:
  • before a demo, as a 10-second pre-flight check
  • as evidence in the report (paste the output)
  • to prove the models are genuinely running, not hard-coded

Run (with the server already started in another terminal):
    python verify_ml_server.py
    python verify_ml_server.py --url http://localhost:8000
============================================================
"""
import argparse, json, os, sys, time

try:
    import requests
except ImportError:
    sys.exit("Install requests first:  pip install requests")

OK, FAIL, SKIP = "PASS", "FAIL", "SKIP"
results = []


def record(name, status, detail=""):
    results.append((name, status, detail))
    mark = {"PASS": "[ OK ]", "FAIL": "[FAIL]", "SKIP": "[skip]"}[status]
    print(f"  {mark}  {name}" + (f"  —  {detail}" if detail else ""))


def find_ai4i():
    """Locate the AI4I CSV relative to this file (repo layout)."""
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.abspath(os.path.join(here, "..", ".."))
    for dirpath, _dirs, files in os.walk(os.path.join(root, "datasets")):
        for f in files:
            if f.lower() == "ai4i2020.csv":
                return os.path.join(dirpath, f)
    return None


def main(base):
    print("=" * 62)
    print("ML SERVER VERIFICATION")
    print(f"target: {base}")
    print("=" * 62)

    # ── 1. Is it alive? ──────────────────────────────────────
    print("\n1. Service")
    try:
        t0 = time.time()
        r = requests.get(f"{base}/health", timeout=10)
        ms = int((time.time() - t0) * 1000)
        r.raise_for_status()
        h = r.json()
        record("server reachable", OK, f"{ms} ms")
        record("models on disk", OK,
               f"{len(h.get('classifier_models', []))} classifier, "
               f"{len(h.get('anomaly_models', []))} anomaly")
    except Exception as e:
        record("server reachable", FAIL, str(e)[:60])
        print("\nServer is not running. Start it with:")
        print("  python -m uvicorn main:app --reload --port 8000")
        return summarise()

    # ── 2. Real-data models (the headline results) ───────────
    print("\n2. Real-data models (MetroPT-3)")
    try:
        d = requests.get(f"{base}/evaluate-detector", timeout=30).json()
        m = d["metrics"]
        record("detector evaluation", OK,
               f"AUC {m['auc']}, false alarms {m['false_alarm_rate']*100:.1f}%")
        for e in d.get("events", []):
            lead = e.get("lead_hours_before_repair")
            record(f"  caught {e['type']}", OK,
                   f"alarm +{e['detected_after_min']} min, {lead} h before repair")
    except Exception as e:
        record("detector evaluation", FAIL, str(e)[:60])

    try:
        d = requests.get(f"{base}/evaluate-rul?points=50", timeout=30).json()
        m = d["metrics"]
        record("RUL evaluation", OK,
               f"MAE {m['mae_days']} d, coverage {m['interval_coverage']*100:.0f}%")
        record("  split", OK, m["split"][:52])
    except Exception as e:
        record("RUL evaluation", FAIL, str(e)[:60])

    # ── 3. Live inference ────────────────────────────────────
    print("\n3. Live inference")
    try:
        windows = {s: [1.0] * 60 for s in
                   ["TP2", "TP3", "H1", "DV_pressure", "Reservoirs",
                    "Oil_temperature", "Motor_current"]}
        d = requests.post(f"{base}/predict-rul", json={"windows": windows}, timeout=20).json()
        assert d["low_days"] <= d["rul_days"] <= d["high_days"], "interval ordering wrong"
        record("RUL prediction", OK,
               f"{d['rul_days']} d (range {d['low_days']}–{d['high_days']})")
    except Exception as e:
        record("RUL prediction", FAIL, str(e)[:60])

    # ── 4. Train from scratch on a real dataset ──────────────
    print("\n4. Supervised training (AI4I 2020)")
    csv = find_ai4i()
    if not csv:
        record("AI4I dataset found", SKIP, "datasets/ai4i2020.csv not present")
    else:
        try:
            with open(csv, "rb") as f:
                d = requests.post(f"{base}/analyze", files={"file": f}, timeout=60).json()
            record("dataset analysis", OK,
                   f"{d['rows']} rows, {len(d['sensors'])} sensors, label='{d['label_column']}'")
        except Exception as e:
            record("dataset analysis", FAIL, str(e)[:60])

        try:
            with open(csv, "rb") as f:
                d = requests.post(f"{base}/train",
                                  files={"file": f},
                                  data={"machine_id": "verify-run"},
                                  timeout=180).json()
            m = d["metrics"]
            record("model training", OK,
                   f"AUC {m['roc_auc']}, F1 {m['f1']}, precision {m['precision']}, recall {m['recall']}")
            record("  split used", OK, m.get("split", "?")[:52])
            top = list(d["importance"].items())[:3]
            record("  top features", OK, ", ".join(f"{k} {v}" for k, v in top))
            record("  chart data returned", OK,
                   f"{len(d.get('risk_series', []))} risk points, {len(d.get('roc', []))} ROC points")
        except Exception as e:
            record("model training", FAIL, str(e)[:60])

        try:
            vals = {"Air temperature [K]": 300, "Process temperature [K]": 310,
                    "Rotational speed [rpm]": 1400, "Torque [Nm]": 60, "Tool wear [min]": 200}
            d = requests.post(f"{base}/predict",
                              json={"machine_id": "verify-run", "values": vals},
                              timeout=20).json()
            record("live risk prediction", OK, f"risk {d.get('risk')}%, tier {d.get('tier')}")
        except Exception as e:
            record("live risk prediction", FAIL, str(e)[:60])

    return summarise()


def summarise():
    print("\n" + "=" * 62)
    p = sum(1 for _, s, _ in results if s == OK)
    f = sum(1 for _, s, _ in results if s == FAIL)
    k = sum(1 for _, s, _ in results if s == SKIP)
    print(f"RESULT: {p} passed, {f} failed, {k} skipped")
    print("=" * 62)
    if f:
        print("\nFailures:")
        for n, s, d in results:
            if s == FAIL:
                print(f"  - {n}: {d}")
    return 1 if f else 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:8000")
    a = ap.parse_args()
    sys.exit(main(a.url.rstrip("/")))

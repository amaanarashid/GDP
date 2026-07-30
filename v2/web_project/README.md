# AGV Predictive Maintenance — Web Version (PANOPTES)

A browser-based port of the desktop PyQt system. Same architecture, same
business logic (`config.py`, `database/`, `models/`, `services/` are
**unchanged** from the desktop version) — only the GUI layer changed from
PyQt widgets to a Flask + HTML/CSS/JS frontend.

## Why a web version

- One link to share — no install needed for whoever's viewing/grading it
- Looks like a real industrial control-room dashboard (dark theme, monospace
  data readouts, SVG digital twin with glow effects on critical components)
- Runs the "two GUIs" as two browser tabs instead of two desktop windows,
  still synced live through the same shared SQLite database

## 1. Install

```bash
cd web_project
python -m venv venv

# Windows (PowerShell)
venv\Scripts\Activate.ps1
# Windows (cmd)
venv\Scripts\activate.bat
# macOS/Linux
source venv/bin/activate

python -m pip install -r requirements.txt
```

> `pyzbar` needs the system `zbar` library if you want QR decoding from a
> webcam later (`sudo apt-get install libzbar0` on Linux, `brew install zbar`
> on macOS). QR **generation** (for printing/display) only needs `qrcode`
> and works without `zbar`.

## 2. Run

```bash
python app.py
```

Then open in your browser:
- **Technician Dashboard:** http://127.0.0.1:5000/
- **Machine Simulator:** http://127.0.0.1:5000/simulator

Open both in separate tabs (or separate browser windows) — they share the
same `database/factory.db` file and stay in sync, polling every 1.5 seconds.

## 3. Demo sequence

1. Open the Dashboard tab, select `M001`, click **Scan QR**
2. Open the Simulator tab, click **Start Auto Simulation**
3. Watch the Dashboard's sensor cards, health score, and digital twin update
4. Click **Inject Bearing Fault** in the Simulator
5. Watch the digital twin's Bearing block turn red and glow, and the
   Predictive Maintenance panel recommend "Replace Bearing"
6. Click **Reset Machine** to return to baseline

## 4. Project structure

```
web_project/
├── app.py                  # Flask routes + JSON API
├── config.py                # unchanged — machine-type registry
├── database/                 # unchanged — SQLite schema + access layer
├── models/                    # unchanged — dataclasses
├── services/                   # unchanged — health/prediction/qr/sim engines
├── templates/
│   ├── base.html               # shared layout, nav, fonts
│   ├── dashboard.html            # 7-section technician dashboard + SVG twin
│   └── simulator.html             # sliders, fault buttons
├── static/
│   ├── css/style.css               # PANOPTES dark industrial theme
│   ├── js/dashboard.js              # polls /api/state, renders all sections
│   ├── js/simulator.js               # sliders, auto-sim polling, fault calls
│   └── qr_codes/                      # generated QR PNGs land here
└── requirements.txt
```

## 5. API reference

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/machines` | list all machines |
| POST | `/api/machines` | add a new machine (scalability) |
| POST | `/api/scan` | simulate AGV QR scan (sets active machine) |
| GET | `/api/active_machine` | currently scanned machine |
| GET | `/api/state/<id>` | full dashboard payload: health, prediction, history, logs |
| GET | `/api/sim/state/<id>` | current slider values for a machine |
| POST | `/api/sim/update` | commit slider values to DB |
| POST | `/api/sim/tick` | one auto-simulation drift step |
| POST | `/api/sim/fault` | inject bearing/gearbox/motor fault |
| POST | `/api/sim/reset` | reset machine to baseline |
| GET | `/api/qr/<id>` | generate & download a machine's QR code PNG |

## 6. Adding new machines

Same as the desktop version — no code changes needed:

```python
import requests
requests.post("http://127.0.0.1:5000/api/machines", json={
    "machine_id": "M002",
    "machine_name": "Packaging Line A",
    "location": "Zone B",
    "machine_type": "Conveyor",
})
```

New machine *types* still go in `config.py`'s `MACHINE_TYPE_CONFIGS`.

## 7. Deploying beyond localhost

The Flask dev server (`app.run(debug=True)`) is for local demos only. For a
real deployment, run behind a production WSGI server:

```bash
pip install waitress
waitress-serve --listen=0.0.0.0:8000 app:app
```

Then access it from any device on your network at `http://<your-ip>:8000/`.

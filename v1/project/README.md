# AGV-Based Predictive Maintenance & Digital Twin Monitoring System

A desktop Industry 4.0 simulation built with **PyQt6** + **SQLite**. Two
independent GUIs — a **Machine Simulator** and a **Technician Dashboard** —
run as separate processes and stay in sync through a shared database,
mimicking how a real AGV + factory sensor network + monitoring station
would communicate.

---

## 1. Project Overview

An AGV "scans" a machine's QR code, the dashboard loads that machine's live
sensor data, computes per-component and overall health scores, predicts the
most likely failure and Remaining Useful Life (RUL), and renders a color-coded
2D digital twin — all updating automatically every 1.5 seconds.

Since no physical machine is available, `machine_simulator.py` plays the role
of the real machine: you drag sliders or inject faults, and it writes
readings into SQLite exactly as a real sensor gateway would.

## 2. Features

- Two independent PyQt6 GUIs, run simultaneously, synced via SQLite (WAL mode)
- Config-driven machine types (`config.py`) — add a new machine type with a
  Python dict entry, no other code changes
- Per-component health formulas (Motor, Bearing, Gearbox, Belt, Fan)
- Weighted overall machine health score with 4-tier status/color rules
- Predictive maintenance: weakest-component detection, simulated RUL,
  recommended action, confidence %, priority, downtime & cost estimate
- 2D digital twin with live color-coded components (green/yellow/orange/red)
- Matplotlib historical trend charts (temperature, vibration, operating hours)
- AGV panel with QR-code generation (`qrcode`) and decoding (`OpenCV` + `pyzbar`)
- Fault injection (bearing / gearbox / motor) and auto-simulation drift
- Maintenance log table for audit history

## 3. System Architecture

```
                 ┌─────────────────────┐        ┌─────────────────────┐
                 │ Machine Simulator    │        │ Technician Dashboard │
                 │ (machine_simulator.py)│       │ (main_dashboard.py)  │
                 │  - sliders            │        │  - QTimer poll       │
                 │  - fault injection     │        │  - health engine     │
                 │  - auto-sim QTimer     │        │  - prediction engine │
                 └──────────┬────────────┘        │  - digital twin       │
                            │   writes             │  - charts             │
                            ▼                      └──────────┬────────────┘
                  ┌───────────────────────┐                   │ reads/writes
                  │   SQLite factory.db     │◀──────────────────┘
                  │  (WAL mode, shared file) │
                  └───────────────────────┘
```

Both windows are independent OS processes/widgets; there is no direct socket
or signal between them — the database file IS the integration layer, which
keeps the design simple and crash-tolerant (either GUI can be closed/reopened
without losing state).

## 4. Database Schema

| Table | Purpose |
|---|---|
| `machines` | One row per machine (id, name, location, type, status, health) |
| `sensor_data` | Time-series raw readings (temperature, vibration, current, hours) |
| `maintenance_logs` | Audit trail of faults injected / resets / service actions |
| `component_health` | Time-series per-component health scores (generic, any machine type) |
| `agv_state` | Single-row table holding the "currently scanned" machine id |

See `database/schema.sql` for full DDL.

## 5. Installation

```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

pip install PyQt6 matplotlib qrcode[pil] opencv-python pyzbar
```

> **Note:** `pyzbar` requires the system `zbar` shared library.
> - Ubuntu/Debian: `sudo apt-get install libzbar0`
> - macOS: `brew install zbar`
> - Windows: ships its own DLL with the pip wheel, usually no extra step needed.
>
> If you don't need live webcam QR scanning, the app still works fully —
> the AGV panel's "Scan QR" button simulates the scan via the dropdown
> without needing a camera.

## 6. Dependencies

| Package | Used for |
|---|---|
| PyQt6 | Both GUIs |
| matplotlib | Historical trend charts |
| qrcode | Generating machine QR codes |
| opencv-python | Webcam capture / image decoding for QR |
| pyzbar | Decoding QR codes from frames/images |
| sqlite3 (stdlib) | Shared database |

## 7. How to Run

Open **two terminals** (both GUIs must run simultaneously as separate processes):

```bash
# Terminal 1
python machine_simulator.py

# Terminal 2
python main_dashboard.py
```

On first run, both apps auto-create `database/factory.db` from
`database/schema.sql` and seed the initial machine `M001 - Conveyor Drive
System`.

## 8. Step-by-Step Demonstration

1. Launch `machine_simulator.py` and `main_dashboard.py`.
2. In the dashboard's **AGV Simulation Panel**, select `M001` and click
   **📷 Scan QR** — this loads M001 into all dashboard sections.
3. In the simulator, click **Start Auto Simulation** — watch the dashboard's
   sensor cards and digital twin update every ~1.5s.
4. Click **Inject Bearing Fault** in the simulator. Within a couple of
   seconds the dashboard's Bearing component turns red, the overall health
   drops, and Section 4 (Predictive Maintenance) recommends "Replace
   Bearing" with an estimated RUL and confidence.
5. Click **Reset Machine** to return to a healthy baseline.

## 9. Simulator Usage Guide

- **Machine Selection Dropdown** — switch which machine's sliders you're
  editing (each machine keeps its own independent simulated state).
- **Sliders** — drag to set a value, then click **Update Values** to commit
  it to the database immediately.
- **Start/Stop Auto Simulation** — randomly drifts all four sensor values
  every 1.5s and writes each tick to SQLite (simulates normal wear).
- **Inject Bearing/Gearbox/Motor Fault** — applies a one-time spike to the
  relevant sensors (see Health Calculation Logic below) and logs the event.
- **Reset Machine** — restores baseline healthy values (25°C, 0.1 mm/s,
  4A, 0 hrs) and logs the reset.

## 10. Dashboard Usage Guide

The dashboard auto-refreshes every 1.5 seconds via `QTimer`. Sections:

1. **Machine Information** — static identity fields
2. **Live Sensor Data** — most recent raw reading
3. **Machine Health** — weighted overall score + color-coded status pill
4. **Predictive Maintenance** — weakest component, predicted failure, RUL,
   recommended action, confidence
5. **Digital Twin** — 2D schematic, each component tinted by health
6. **Historical Trends** — Matplotlib line charts (last 100 readings)
7. **Maintenance Recommendation** — action, priority, downtime, cost

## 11. Adding New Machines (No Code Rewrite)

The system is intentionally **configuration-driven**:

1. **Add a database row** (either via a small script or future "Add Machine"
   dialog):
   ```python
   from database.database import Database
   Database().add_machine("M002", "Packaging Line A", "Zone B", "Conveyor")
   ```
2. **Define components for a new machine type** (only needed if it's a type
   that doesn't exist yet) — add one dict entry to
   `MACHINE_TYPE_CONFIGS` in `config.py`. Weights should sum to 1.0.
3. **Generate its QR code** — click "Generate QR Codes for All Machines" in
   the dashboard, or call `QRService().generate_qr("M002")`.

Both GUIs pick up the new machine automatically on their next dropdown
refresh — no other code changes required.

## 12. QR Workflow

- `services/qr_service.py` generates a PNG QR code per machine (encoding the
  `machine_id`) into `assets/qr_codes/`.
- Decoding supports both a single image file and a live webcam frame via
  OpenCV + pyzbar, for when a real AGV camera becomes available.
- In the simulated environment, the **AGV Simulation Panel**'s dropdown +
  "Scan QR" button stands in for an actual camera scan, writing the
  selected `machine_id` into the shared `agv_state` table, which the
  dashboard reads on its next refresh tick.

## 13. Predictive Maintenance Workflow

1. `HealthEngine` computes each component's health from the latest sensor
   reading using the formulas registered for the machine's type.
2. The overall machine health is the weighted sum of component scores.
3. `PredictionEngine` finds the weakest component. If its health is below
   40, it raises a maintenance alert with a type-specific recommended
   action (e.g. "Replace Bearing").
4. RUL is estimated as `health / degradation_rate`, simulated per
   component-type, clamped to a sane 0-365 day range.
5. A confidence percentage and downtime/cost estimate are derived from how
   far the score is from the ambiguous midpoint and from priority tier.

## 14. Digital Twin Workflow

`digital_twin/twin_widget.py` is a `QWidget` with a custom `paintEvent` that
draws rounded rectangles for each known component at fixed layout
coordinates (any component name not in the fixed layout is drawn in an
overflow row, so new machine types still render without crashing). Each
rectangle's fill color comes from the same `status_for_score()` rule used
everywhere else in the app, so the legend stays consistent across Sections
3, 4, and 5.

## 15. Future Improvements

- Replace polling (`QTimer` + DB reads) with SQLite `update` hooks or a
  lightweight pub/sub (e.g. ZeroMQ) for lower latency
- "Add Machine" dialog in the dashboard itself, instead of a script
- Persist component layout coordinates per machine type for richer twins
- Export PDF maintenance reports
- Multi-machine grid/overview screen
- Authentication for technician vs. admin roles

## 16. Screenshots

> _Add screenshots here after running the app locally:_
>
> - `assets/screenshots/dashboard_overview.png`
> - `assets/screenshots/digital_twin.png`
> - `assets/screenshots/simulator.png`
> - `assets/screenshots/fault_injection.png`

## 17. Troubleshooting

| Issue | Fix |
|---|---|
| `ModuleNotFoundError: PyQt6` | Run `pip install PyQt6` inside your venv |
| Blank/garbled QR images | Install `qrcode[pil]` (Pillow is required) |
| `pyzbar` import error on Linux | Install system package `libzbar0` |
| Dashboard shows "No data yet" | Make sure `machine_simulator.py` has
  written at least one reading (click **Update Values** once) |
| Two GUIs show different values | Check both point to the same
  `database/factory.db` path; don't run from different working directories |
| `database is locked` errors | WAL mode is enabled by default, which
  should prevent this; ensure no other process has an exclusive lock open |

## 18. Known Limitations

- Health formulas and RUL estimates are simplified simulations for
  demonstration, not certified reliability models
- Digital twin layout is hand-positioned for the conveyor type; new machine
  types fall back to a generic stacked-row layout
- No real AGV/camera hardware integration is included — QR scanning is
  simulated via a dropdown selector by default
- Single-database-file concurrency is fine for a demo but not built for
  high-frequency multi-writer production loads

## 19. License

MIT License. Provided as-is for educational and prototyping purposes.

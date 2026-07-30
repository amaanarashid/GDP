# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

AGV Predictive Maintenance web app (React 19 + Vite + Tailwind + Supabase + TensorFlow.js). This `v4/` folder is always the current working version; sibling folders (`v4.9`, `v4.10`, `v1`–`v3`, etc.) are historical snapshots — never develop in them.

## Commands

- `npm run dev` — dev server at http://localhost:5173
- `npm run build` — production build
- `npm run lint` — oxlint
- `npm run preview` — preview the build

There is no test suite.

Optional Python ML server (lives in the sibling folder `../ML server/ml-server/`):

```bash
cd "../ML server/ml-server"
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

## Setup requirements

- `.env` (copy from `.env.example`) needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; `VITE_ML_SERVER_URL` optionally overrides the ML server default of `http://localhost:8000`.
- Database schema and seed SQL in `data/` (`schema.sql`, `seed_users.sql`, `migration_*.sql`, `add_metropt_machine.sql`) are run **manually in the Supabase SQL Editor** — there is no migration tool. See `data/SETUP.md`.
- Demo users: `admin@agv.demo` / `Admin@1234`, `tech@agv.demo` / `Tech@1234`.

## Gotcha: stale duplicate tree at repo root

`index.html` loads `/src/main.jsx` — **only `src/` is live code**. The root-level `App.jsx`, `ProtectedRoute.jsx`, `components/`, `pages/`, `lib/`, `hooks/`, `context/`, `utils/`, `assets/` are leftover copies of an earlier layout. Never edit those; always work under `src/`.

## Architecture

There is no app server. Supabase (Postgres + Auth + Realtime) is the entire backend; the browser does everything else, including running the simulation and ML inference.

### Data flow

- All Supabase access goes through `src/lib/supabase.js` (client) and the query modules `src/lib/data.js`, `adminData.js`, `dashboardData.js`, `maintenanceData.js`. Tables: `profiles`, `machines`, `components`, `sensors`, `sensor_readings`, `rul_predictions`, `alerts`, `maintenance_logs`, `emergency_broadcasts`.
- Live updates arrive via Supabase Realtime subscriptions (`postgres_changes`), e.g. `EmergencyContext` and the dashboard hooks.

### Auth & routing

`src/App.jsx` defines the routes. `AuthContext` holds the session + role (from `profiles`); `ProtectedRoute` gates routes, with `requireAdmin` for `/admin` and `/simulate`. `EmergencyContext` streams active emergency broadcasts to all pages.

### Simulation (browser-side, writes to DB)

- `src/lib/simEngine.js` — pure functions: next sensor value given active faults, severity, health deltas.
- `src/lib/faults.js` — fault definitions per machine type (which sensors each fault drives toward warning/critical).
- `src/hooks/useSimulator.js` — the loop: ticks every 5s, ramps fault intensity, then persists through the shared write pipeline in `data.js` (`writeReadings` → `updateSensorValues` → `updateComponentHealth` → `refreshMachineHealth`, plus `createAlert`). Any new data source should reuse this pipeline.
- (Removed) The Simulate page's "Real data" CSV playback mode (`datasetPlayer.js` / `datasetMappings.js` / `DatasetPanel.jsx`) and the Admin "Add dataset" modal (`AddDatasetModal.jsx`) are both deleted. Real-data ML flows live in the Dataset Lab on the ML Model page (`/model`, `DatasetLab.jsx`) and the ML server. The Simulate page can export a machine's history as a labelled CSV (`datasetExport.js` — failure = critical alert within a selectable horizon).

### Three ML paths (know which one applies)

1. **Degradation-trend extrapolation** (`src/lib/trendRul.js`) — used by all simulated machines. Not ML: days remaining = (health − service threshold) ÷ current decline rate, where the rate comes from the wear law in `simEngine.js` (baseline wear × machine age × per-component factor, accelerated by warning/critical sensors). Replaced the old TF.js net that trained on synthetic labels (circular — deleted along with the `@tensorflow/*` deps).
2. **Python-trained MetroPT-3 RUL model** (`src/lib/realRulModel.js`) — weights + scaler live in `public/rul_model/` (produced offline by `train_rul_model.py`); inference is replicated in plain JS. Auto-selected when a machine's sensor names match the MetroPT-3 set (`isRealModelMachine`).
3. **FastAPI ML server** (`src/lib/mlServer.js` → `../ML server/ml-server/`) — optional external service for supervised failure classification (`/analyze`, `/train`, `/predict`) and unsupervised anomaly detection (`/train-anomaly`, `/detect`). The app degrades gracefully if it's not running (`mlAvailable()`).

`src/lib/priorityEngine.js` combines RUL + health + trend + critical sensor counts into the ranked priority score shown in the UI.

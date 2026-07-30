# AGV Predictive Maintenance — Web App (v4)

React + Vite + Supabase + TensorFlow.js predictive maintenance system.

This is the **main version** folder of the project. Earlier iterations (`v1` PyQt desktop, `v2` Flask web, `v3` React/Vite prototype) live as sibling folders and are kept for reference. `v4` is always the current working version; snapshots taken along the way are kept as `v4.1`, `v4.2`, etc. See [Versioning](#versioning) below.

## Setup
1. `npm install`
2. Copy `.env.example` to `.env` and add your Supabase URL + anon key
3. Run `data/schema.sql` in the Supabase SQL Editor
4. Create demo users (admin@agv.demo / Admin@1234, tech@agv.demo / Tech@1234)
5. Run `data/seed_users.sql` to assign roles
6. `npm run dev` → http://localhost:5173

See `data/SETUP.md` for the full Supabase project setup walkthrough.

## Routes
| Route          | Access             |
|----------------|--------------------|
| /login         | Public             |
| /dashboard     | Admin + Technician |
| /machine/:id   | Admin + Technician |
| /admin         | Admin only         |
| /simulate      | Admin only         |

## Build Progress
- [x] Step 1 — Supabase schema + seed
- [x] Step 2 — Auth + role routing + layout shell
- [x] Step 3 — Simulator engine
- [x] Step 4 — Dashboard + digital twins
- [x] Step 5 — Machine detail + RUL model
- [x] Step 6 — Admin page
- [x] Step 7 — Real data (MetroPT-3) + Python-trained RUL model

## Step 7 — Real data integration
- 4th machine "MetroPT-3 Air Compressor (Real Data)" (run `data/add_metropt_machine.sql`)
- Real dataset playback on the Simulator (toggle "Real data", upload `metropt3_trimmed.csv`)
- RUL model trained OFFLINE in Python on the full MetroPT-3 dataset
  (`train_rul_model.py`; test MAE 17.4h / 0.7 days) and served from
  `public/rul_model/` — the MetroPT machine automatically uses it,
  simulated machines keep the in-browser TF.js model

## Tech stack
- React 19 + Vite + Tailwind CSS
- Supabase (Postgres + Auth + Realtime) as backend
- TensorFlow.js for in-browser RUL inference
- Recharts for sensor history charts, `qrcode.react` / `html5-qrcode` for QR scan flow

## Project structure
```
v4/
├── src/
│   ├── pages/          # auth, dashboard, machine, admin, simulate
│   ├── components/     # layout, dashboard, machine, charts, ui
│   ├── context/        # AuthContext, EmergencyContext
│   ├── hooks/          # useDashboard, useSimulator
│   ├── lib/            # supabase client, simEngine, faults, rulModel, priorityEngine
│   └── utils/
├── data/               # schema.sql, seed_users.sql, migrations, SETUP.md
└── public/             # static assets, rul_model/ (trained model files)
```

## Versioning
- **`v4`** — this folder, always the latest working version.
- **`v4.1`, `v4.2`, ...** — snapshots/checkpoints taken as updates land (bug fixes, new features, refactors). `v4` itself should always reflect the most recent state; the numbered copies are history, not branches to keep developing on.

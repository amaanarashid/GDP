# AGV Predictive Maintenance — Web App

React + Vite + Supabase + TensorFlow.js predictive maintenance system.

## Setup
1. `npm install`
2. Copy `.env.example` to `.env` and add your Supabase URL + anon key
3. Run `../supabase/schema.sql` in Supabase SQL Editor
4. Create demo users (admin@agv.demo / Admin@1234, tech@agv.demo / Tech@1234)
5. Run `../supabase/seed_users.sql` to assign roles
6. `npm run dev` → http://localhost:5173

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
- [ ] Step 3 — Simulator engine
- [ ] Step 4 — Dashboard + digital twins
- [ ] Step 5 — Machine detail + RUL model
- [ ] Step 6 — Admin page

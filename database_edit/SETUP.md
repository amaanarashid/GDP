# Supabase Setup Guide

## Step 1 — Create Supabase Project
1. Go to https://supabase.com and sign in
2. Click **New Project**
3. Name it: `agv-predictive-maintenance`
4. Choose a strong database password (save it!)
5. Select region closest to Malaysia (Singapore)
6. Wait ~2 minutes for project to spin up

## Step 2 — Run Schema
1. In Supabase dashboard → **SQL Editor**
2. Click **New Query**
3. Paste the full contents of `schema.sql`
4. Click **Run**
5. You should see:
   - "Schema created successfully"
   - Table showing 3 machines with 5 components and 16 sensors each

## Step 3 — Create Demo Users
1. Go to **Authentication → Users → Add User**
2. Create:
   - Email: `admin@agv.demo` | Password: `Admin@1234`
   - Email: `tech@agv.demo`  | Password: `Tech@1234`
3. In SQL Editor, run `seed_users.sql` to assign roles

## Step 4 — Get Your Keys
Go to **Settings → API** and copy:
- `Project URL`      → VITE_SUPABASE_URL
- `anon public key`  → VITE_SUPABASE_ANON_KEY

You'll add these to the `.env` file in the React app.

## Step 5 — Enable Realtime
1. Go to **Database → Replication**
2. Confirm these tables are in the `supabase_realtime` publication:
   - sensor_readings
   - alerts
   - emergency_broadcasts
   - machines
   - components
   - rul_predictions

## Tables Overview
| Table                  | Purpose                              |
|------------------------|--------------------------------------|
| profiles               | Users with roles (admin/technician)  |
| machines               | 3 default + admin-added machines     |
| components             | 5 components per machine             |
| sensors                | 16 sensors per machine               |
| sensor_readings        | Live time-series from simulator      |
| rul_predictions        | TensorFlow.js RUL output             |
| alerts                 | Warning/critical/emergency alerts    |
| maintenance_logs       | Technician maintenance records       |
| emergency_broadcasts   | Admin emergency push notifications   |

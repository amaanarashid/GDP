-- ============================================================
-- AGV PREDICTIVE MAINTENANCE SYSTEM — SUPABASE SCHEMA
-- Run this entire file in Supabase SQL Editor
-- ============================================================

-- ── Enable UUID extension ──────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. USERS (extends Supabase auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT,
  role        TEXT NOT NULL DEFAULT 'technician' CHECK (role IN ('admin', 'technician')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'technician')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 2. MACHINES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.machines (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           TEXT NOT NULL,
  type           TEXT NOT NULL CHECK (type IN ('conveyor_drive', 'hydraulic_press', 'air_compressor', 'custom')),
  location       TEXT,
  status         TEXT NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy', 'warning', 'critical', 'offline')),
  overall_health NUMERIC(5,2) DEFAULT 100.00,
  runtime_hours  NUMERIC(10,1) DEFAULT 0,
  qr_code        TEXT UNIQUE,
  created_by     UUID REFERENCES public.profiles(id),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. COMPONENTS (per machine)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.components (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  machine_id    UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  health_score  NUMERIC(5,2) DEFAULT 100.00 CHECK (health_score BETWEEN 0 AND 100),
  color_status  TEXT DEFAULT 'green' CHECK (color_status IN ('green', 'yellow', 'red')),
  last_serviced TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. SENSORS (per component)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sensors (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  machine_id          UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  component_id        UUID NOT NULL REFERENCES public.components(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  unit                TEXT NOT NULL,
  normal_min          NUMERIC(10,3),
  normal_max          NUMERIC(10,3),
  warning_threshold   NUMERIC(10,3),
  critical_threshold  NUMERIC(10,3),
  current_value       NUMERIC(10,3),
  detects             TEXT[],
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. SENSOR READINGS (time-series)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sensor_readings (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sensor_id  UUID NOT NULL REFERENCES public.sensors(id) ON DELETE CASCADE,
  value      NUMERIC(10,3) NOT NULL,
  timestamp  TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast time-series queries
CREATE INDEX IF NOT EXISTS idx_sensor_readings_sensor_time
  ON public.sensor_readings(sensor_id, timestamp DESC);

-- ============================================================
-- 6. RUL PREDICTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rul_predictions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  machine_id      UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  component_id    UUID NOT NULL REFERENCES public.components(id) ON DELETE CASCADE,
  days_remaining  NUMERIC(6,1),
  confidence      NUMERIC(5,2),
  model_version   TEXT DEFAULT 'v1.0',
  timestamp       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. ALERTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.alerts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  machine_id  UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  component_id UUID REFERENCES public.components(id),
  sensor_id   UUID REFERENCES public.sensors(id),
  severity    TEXT NOT NULL CHECK (severity IN ('warning', 'critical', 'emergency')),
  type        TEXT NOT NULL DEFAULT 'sensor',
  message     TEXT NOT NULL,
  resolved    BOOLEAN DEFAULT FALSE,
  resolved_by UUID REFERENCES public.profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. MAINTENANCE LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.maintenance_logs (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  machine_id           UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  technician_id        UUID REFERENCES public.profiles(id),
  components_serviced  UUID[],
  notes                TEXT,
  health_before        NUMERIC(5,2),
  health_after         NUMERIC(5,2),
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 9. EMERGENCY BROADCASTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.emergency_broadcasts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  machine_id  UUID REFERENCES public.machines(id),
  message     TEXT NOT NULL,
  severity    TEXT DEFAULT 'emergency',
  created_by  UUID REFERENCES public.profiles(id),
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS POLICIES
-- ============================================================
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machines           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.components         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensors            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensor_readings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rul_predictions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_logs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_broadcasts ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read everything
CREATE POLICY "authenticated_read_all" ON public.machines         FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_all" ON public.components       FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_all" ON public.sensors          FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_all" ON public.sensor_readings  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_all" ON public.rul_predictions  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_all" ON public.alerts           FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_all" ON public.maintenance_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_read_all" ON public.emergency_broadcasts FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_own_profile"       ON public.profiles         FOR SELECT TO authenticated USING (auth.uid() = id);

-- Technicians: insert maintenance logs + update alerts
CREATE POLICY "technician_insert_maintenance" ON public.maintenance_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "technician_update_alerts"      ON public.alerts           FOR UPDATE TO authenticated USING (true);

-- Sensor readings: anyone authenticated can insert (simulator)
CREATE POLICY "insert_sensor_readings" ON public.sensor_readings FOR INSERT TO authenticated WITH CHECK (true);

-- RUL predictions: anyone authenticated can insert (in-browser ML)
CREATE POLICY "insert_rul_predictions" ON public.rul_predictions FOR INSERT TO authenticated WITH CHECK (true);

-- Alerts: system can insert
CREATE POLICY "insert_alerts" ON public.alerts FOR INSERT TO authenticated WITH CHECK (true);

-- Admins: full access to machines, components, sensors, emergency
CREATE POLICY "admin_manage_machines"    ON public.machines    FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "admin_manage_components"  ON public.components  FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "admin_manage_sensors"     ON public.sensors     FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "admin_manage_emergency"   ON public.emergency_broadcasts FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "admin_update_components"  ON public.components  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "admin_update_machines"    ON public.machines    FOR UPDATE TO authenticated USING (true);
CREATE POLICY "admin_update_sensors"     ON public.sensors     FOR UPDATE TO authenticated USING (true);

-- ============================================================
-- REALTIME — enable for live dashboard updates
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.sensor_readings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_broadcasts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.machines;
ALTER PUBLICATION supabase_realtime ADD TABLE public.components;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rul_predictions;

-- ============================================================
-- HELPER: update machine overall_health from components
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_machine_health(p_machine_id UUID)
RETURNS VOID AS $$
DECLARE
  avg_health NUMERIC;
  new_status TEXT;
BEGIN
  SELECT AVG(health_score) INTO avg_health
  FROM public.components WHERE machine_id = p_machine_id;

  IF avg_health >= 75 THEN new_status := 'healthy';
  ELSIF avg_health >= 50 THEN new_status := 'warning';
  ELSE new_status := 'critical';
  END IF;

  UPDATE public.machines
  SET overall_health = ROUND(avg_health, 2),
      status = new_status,
      updated_at = NOW()
  WHERE id = p_machine_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- SEED DATA — 3 Default Machines
-- ============================================================

DO $$
DECLARE
  -- Machine IDs
  m_conveyor  UUID := uuid_generate_v4();
  m_hydraulic UUID := uuid_generate_v4();
  m_aircomp   UUID := uuid_generate_v4();

  -- Conveyor component IDs
  c_cv_motor   UUID := uuid_generate_v4();
  c_cv_gearbox UUID := uuid_generate_v4();
  c_cv_bearing UUID := uuid_generate_v4();
  c_cv_belt    UUID := uuid_generate_v4();
  c_cv_vfd     UUID := uuid_generate_v4();

  -- Hydraulic component IDs
  c_hy_motor   UUID := uuid_generate_v4();
  c_hy_pump    UUID := uuid_generate_v4();
  c_hy_cyl     UUID := uuid_generate_v4();
  c_hy_tank    UUID := uuid_generate_v4();
  c_hy_filter  UUID := uuid_generate_v4();

  -- Air compressor component IDs
  c_ac_motor   UUID := uuid_generate_v4();
  c_ac_pump    UUID := uuid_generate_v4();
  c_ac_filter  UUID := uuid_generate_v4();
  c_ac_tank    UUID := uuid_generate_v4();
  c_ac_fan     UUID := uuid_generate_v4();

BEGIN

-- ── MACHINES ──────────────────────────────────────────────
INSERT INTO public.machines (id, name, type, location, status, overall_health, runtime_hours, qr_code) VALUES
  (m_conveyor,  'Conveyor Drive System #1',     'conveyor_drive',  'Production Floor A', 'healthy', 100.00, 1240, 'QR-' || m_conveyor::TEXT),
  (m_hydraulic, 'Industrial Hydraulic Press #1','hydraulic_press',  'Production Floor B', 'healthy', 100.00,  980, 'QR-' || m_hydraulic::TEXT),
  (m_aircomp,   'Air Compressor Unit #1',       'air_compressor',  'Utility Room',       'healthy', 100.00, 2100, 'QR-' || m_aircomp::TEXT);

-- ── CONVEYOR COMPONENTS ───────────────────────────────────
INSERT INTO public.components (id, machine_id, name, health_score, color_status) VALUES
  (c_cv_motor,   m_conveyor, 'Electric Motor', 100, 'green'),
  (c_cv_gearbox, m_conveyor, 'Gearbox',        100, 'green'),
  (c_cv_bearing, m_conveyor, 'Bearings',       100, 'green'),
  (c_cv_belt,    m_conveyor, 'Drive Belt',     100, 'green'),
  (c_cv_vfd,     m_conveyor, 'VFD Drive',      100, 'green');

-- ── HYDRAULIC COMPONENTS ──────────────────────────────────
INSERT INTO public.components (id, machine_id, name, health_score, color_status) VALUES
  (c_hy_motor,  m_hydraulic, 'Electric Motor',    100, 'green'),
  (c_hy_pump,   m_hydraulic, 'Hydraulic Pump',    100, 'green'),
  (c_hy_cyl,    m_hydraulic, 'Hydraulic Cylinder',100, 'green'),
  (c_hy_tank,   m_hydraulic, 'Oil Tank',          100, 'green'),
  (c_hy_filter, m_hydraulic, 'Oil Filter',        100, 'green');

-- ── AIR COMPRESSOR COMPONENTS ─────────────────────────────
INSERT INTO public.components (id, machine_id, name, health_score, color_status) VALUES
  (c_ac_motor,  m_aircomp, 'Electric Motor',    100, 'green'),
  (c_ac_pump,   m_aircomp, 'Compressor Pump',   100, 'green'),
  (c_ac_filter, m_aircomp, 'Air Filter',        100, 'green'),
  (c_ac_tank,   m_aircomp, 'Air Receiver Tank', 100, 'green'),
  (c_ac_fan,    m_aircomp, 'Cooling Fan',       100, 'green');

-- ============================================================
-- SENSORS — CONVEYOR DRIVE SYSTEM
-- ============================================================

-- Electric Motor
INSERT INTO public.sensors (machine_id, component_id, name, unit, normal_min, normal_max, warning_threshold, critical_threshold, current_value, detects) VALUES
  (m_conveyor, c_cv_motor, 'Temperature', '°C',  20,  70,  80,  95,  45,  ARRAY['Overheating','Rotor/Stator Issues']),
  (m_conveyor, c_cv_motor, 'Current',     'A',   5,   25,  30,  40,  15,  ARRAY['Overload','Electrical Fault']),
  (m_conveyor, c_cv_motor, 'Vibration',   'mm/s',0,   4.5, 7,   11,  1.2, ARRAY['Imbalance','Misalignment']);

-- Gearbox
INSERT INTO public.sensors (machine_id, component_id, name, unit, normal_min, normal_max, warning_threshold, critical_threshold, current_value, detects) VALUES
  (m_conveyor, c_cv_gearbox, 'Temperature', '°C',  20,  75,  85,  95,  52,  ARRAY['Gear Wear','Lubrication Problems']),
  (m_conveyor, c_cv_gearbox, 'Vibration',   'mm/s',0,   5,   8,   12,  2.1, ARRAY['Misalignment','Gear Wear']);

-- Bearings
INSERT INTO public.sensors (machine_id, component_id, name, unit, normal_min, normal_max, warning_threshold, critical_threshold, current_value, detects) VALUES
  (m_conveyor, c_cv_bearing, 'Temperature', '°C',  15,  60,  75,  90,  38,  ARRAY['Bearing Wear','Lubrication Failure']),
  (m_conveyor, c_cv_bearing, 'Vibration',   'mm/s',0,   4,   7,   11,  1.5, ARRAY['Looseness','Imbalance']),
  (m_conveyor, c_cv_bearing, 'Noise',       'dB',  50,  75,  85,  95,  62,  ARRAY['Bearing Wear','Lubrication Failure']);

-- Drive Belt
INSERT INTO public.sensors (machine_id, component_id, name, unit, normal_min, normal_max, warning_threshold, critical_threshold, current_value, detects) VALUES
  (m_conveyor, c_cv_belt, 'Belt Speed', 'RPM', 800, 1500, 1600, 1800, 1200, ARRAY['Misalignment','Wear']),
  (m_conveyor, c_cv_belt, 'Slip',       '%',   0,   3,    5,    8,    1.2,  ARRAY['Belt Slip','Tension Loss']),
  (m_conveyor, c_cv_belt, 'Vibration',  'mm/s',0,   4,    6,    10,   1.8,  ARRAY['Belt Slip','Misalignment']);

-- VFD Drive
INSERT INTO public.sensors (machine_id, component_id, name, unit, normal_min, normal_max, warning_threshold, critical_threshold, current_value, detects) VALUES
  (m_conveyor, c_cv_vfd, 'Temperature',    '°C',  20,  55,  65,  75,  42,  ARRAY['Overheating','Drive Failure']),
  (m_conveyor, c_cv_vfd, 'Current',        'A',   5,   30,  35,  45,  18,  ARRAY['Overcurrent','Electrical Faults']),
  (m_conveyor, c_cv_vfd, 'DC Bus Voltage', 'V',   540, 680, 700, 720, 620, ARRAY['Electrical Faults','Drive Failure']),
  (m_conveyor, c_cv_vfd, 'Fault Count',    'cnt', 0,   5,   10,  20,  0,   ARRAY['Drive Failure','Electrical Faults']);

-- ============================================================
-- SENSORS — INDUSTRIAL HYDRAULIC PRESS
-- ============================================================

-- Electric Motor
INSERT INTO public.sensors (machine_id, component_id, name, unit, normal_min, normal_max, warning_threshold, critical_threshold, current_value, detects) VALUES
  (m_hydraulic, c_hy_motor, 'Temperature', '°C',  20,  70,  80,  95,  48,  ARRAY['Overheating','Rotor/Stator Issues']),
  (m_hydraulic, c_hy_motor, 'Current',     'A',   10,  50,  60,  75,  32,  ARRAY['Overload','Electrical Fault']),
  (m_hydraulic, c_hy_motor, 'Vibration',   'mm/s',0,   4.5, 7,   11,  1.8, ARRAY['Imbalance','Misalignment']);

-- Hydraulic Pump
INSERT INTO public.sensors (machine_id, component_id, name, unit, normal_min, normal_max, warning_threshold, critical_threshold, current_value, detects) VALUES
  (m_hydraulic, c_hy_pump, 'Pressure',    'bar', 100, 250, 270, 300, 185, ARRAY['Pump Wear','Leakage']),
  (m_hydraulic, c_hy_pump, 'Temperature', '°C',  20,  65,  75,  90,  50,  ARRAY['Overheating','Cavitation']),
  (m_hydraulic, c_hy_pump, 'Vibration',   'mm/s',0,   5,   8,   12,  2.2, ARRAY['Pump Wear','Cavitation']);

-- Hydraulic Cylinder
INSERT INTO public.sensors (machine_id, component_id, name, unit, normal_min, normal_max, warning_threshold, critical_threshold, current_value, detects) VALUES
  (m_hydraulic, c_hy_cyl, 'Pressure',  'bar', 80,  220, 240, 270, 160, ARRAY['Seal Wear','Internal Leakage']),
  (m_hydraulic, c_hy_cyl, 'Position',  'mm',  0,   500, 510, 520, 250, ARRAY['Sticking','Force Reduction']),
  (m_hydraulic, c_hy_cyl, 'Temperature','°C', 20,  60,  70,  85,  42,  ARRAY['Seal Wear','Overheating']);

-- Oil Tank
INSERT INTO public.sensors (machine_id, component_id, name, unit, normal_min, normal_max, warning_threshold, critical_threshold, current_value, detects) VALUES
  (m_hydraulic, c_hy_tank, 'Oil Temperature', '°C', 20, 60,  70,  85,  45,  ARRAY['Oil Degradation','Overheating']),
  (m_hydraulic, c_hy_tank, 'Oil Level',       '%',  40, 100, 30,  20,  78,  ARRAY['Low Oil Level']);

-- Oil Filter
INSERT INTO public.sensors (machine_id, component_id, name, unit, normal_min, normal_max, warning_threshold, critical_threshold, current_value, detects) VALUES
  (m_hydraulic, c_hy_filter, 'Differential Pressure', 'bar', 0, 3, 5, 7, 1.2, ARRAY['Filter Clogging','Restricted Flow']);

-- ============================================================
-- SENSORS — AIR COMPRESSOR
-- ============================================================

-- Electric Motor
INSERT INTO public.sensors (machine_id, component_id, name, unit, normal_min, normal_max, warning_threshold, critical_threshold, current_value, detects) VALUES
  (m_aircomp, c_ac_motor, 'Temperature', '°C',  20,  70,  80,  95,  50,  ARRAY['Overheating','Rotor/Stator Issues']),
  (m_aircomp, c_ac_motor, 'Current',     'A',   5,   35,  42,  55,  22,  ARRAY['Overload','Electrical Fault']),
  (m_aircomp, c_ac_motor, 'Vibration',   'mm/s',0,   4.5, 7,   11,  2.0, ARRAY['Imbalance','Misalignment']);

-- Compressor Pump
INSERT INTO public.sensors (machine_id, component_id, name, unit, normal_min, normal_max, warning_threshold, critical_threshold, current_value, detects) VALUES
  (m_aircomp, c_ac_pump, 'Pressure',    'bar', 6,  12,  13,  15,  8.5, ARRAY['Pressure Loss','Wear & Tear']),
  (m_aircomp, c_ac_pump, 'Temperature', '°C',  20, 80,  90,  105, 65,  ARRAY['Overheating','Mechanical Failure']),
  (m_aircomp, c_ac_pump, 'Vibration',   'mm/s',0,  5,   8,   12,  2.5, ARRAY['Mechanical Failure','Wear']);

-- Air Filter
INSERT INTO public.sensors (machine_id, component_id, name, unit, normal_min, normal_max, warning_threshold, critical_threshold, current_value, detects) VALUES
  (m_aircomp, c_ac_filter, 'Differential Pressure', 'bar', 0, 0.5, 0.8, 1.2, 0.15, ARRAY['Filter Clogging','Airflow Restriction']);

-- Air Receiver Tank
INSERT INTO public.sensors (machine_id, component_id, name, unit, normal_min, normal_max, warning_threshold, critical_threshold, current_value, detects) VALUES
  (m_aircomp, c_ac_tank, 'Pressure',    'bar', 6,  10, 11, 13, 8.0, ARRAY['Pressure Loss','Leakage']),
  (m_aircomp, c_ac_tank, 'Temperature', '°C',  15, 50, 60, 75, 35,  ARRAY['Abnormal Operation']);

-- Cooling Fan
INSERT INTO public.sensors (machine_id, component_id, name, unit, normal_min, normal_max, warning_threshold, critical_threshold, current_value, detects) VALUES
  (m_aircomp, c_ac_fan, 'RPM',         'RPM', 900, 1500, 1600, 1800, 1200, ARRAY['Fan Failure','Reduced Cooling']),
  (m_aircomp, c_ac_fan, 'Temperature', '°C',  20,  55,   65,   80,   40,   ARRAY['Overheating','Fan Failure']);

END $$;

-- ============================================================
-- SEED: Initial sensor readings (last 24hrs baseline)
-- ============================================================
INSERT INTO public.sensor_readings (sensor_id, value, timestamp)
SELECT
  s.id,
  CASE
    WHEN s.unit = '°C'    THEN s.normal_min + (s.normal_max - s.normal_min) * (0.4 + 0.2 * random())
    WHEN s.unit = 'A'     THEN s.normal_min + (s.normal_max - s.normal_min) * (0.3 + 0.3 * random())
    WHEN s.unit = 'mm/s'  THEN s.normal_min + (s.normal_max - s.normal_min) * (0.2 + 0.2 * random())
    WHEN s.unit = 'bar'   THEN s.normal_min + (s.normal_max - s.normal_min) * (0.5 + 0.2 * random())
    WHEN s.unit = '%'     THEN 70 + random() * 20
    WHEN s.unit = 'RPM'   THEN s.normal_min + (s.normal_max - s.normal_min) * (0.4 + 0.2 * random())
    WHEN s.unit = 'V'     THEN s.normal_min + (s.normal_max - s.normal_min) * (0.5 + 0.1 * random())
    WHEN s.unit = 'dB'    THEN s.normal_min + (s.normal_max - s.normal_min) * (0.3 + 0.2 * random())
    WHEN s.unit = 'mm'    THEN s.normal_min + (s.normal_max - s.normal_min) * (0.4 + 0.2 * random())
    WHEN s.unit = 'cnt'   THEN 0
    ELSE s.current_value
  END + (random() - 0.5) * 2,
  NOW() - (generate_series * INTERVAL '15 minutes')
FROM public.sensors s,
     generate_series(1, 96)  -- 96 readings × 15 min = 24 hours
WHERE s.unit != 'hrs';

-- ============================================================
-- DONE ✓
-- ============================================================
SELECT 'Schema created successfully' AS status;
SELECT m.name, COUNT(DISTINCT c.id) AS components, COUNT(DISTINCT s.id) AS sensors
FROM public.machines m
JOIN public.components c ON c.machine_id = m.id
JOIN public.sensors s ON s.machine_id = m.id
GROUP BY m.name;

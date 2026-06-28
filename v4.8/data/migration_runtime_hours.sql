-- ============================================================
-- MIGRATION: Consolidate runtime_hours to machine level
-- Run this ONLY if you already ran the original schema.sql
-- Otherwise just re-run schema.sql from scratch
-- ============================================================

-- 1. Add runtime_hours column to machines
ALTER TABLE public.machines
  ADD COLUMN IF NOT EXISTS runtime_hours NUMERIC(10,1) DEFAULT 0;

-- 2. Set initial runtime values from existing motor sensor readings
UPDATE public.machines m
SET runtime_hours = (
  SELECT s.current_value
  FROM public.sensors s
  JOIN public.components c ON s.component_id = c.id
  WHERE c.machine_id = m.id
    AND s.name = 'Runtime Hours'
    AND c.name = 'Electric Motor'
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM public.sensors s
  JOIN public.components c ON s.component_id = c.id
  WHERE c.machine_id = m.id AND s.name = 'Runtime Hours'
);

-- 3. Delete all Runtime Hours sensor readings
DELETE FROM public.sensor_readings
WHERE sensor_id IN (
  SELECT id FROM public.sensors WHERE name = 'Runtime Hours'
);

-- 4. Delete all Runtime Hours sensors
DELETE FROM public.sensors WHERE name = 'Runtime Hours';

-- 5. Verify
SELECT
  m.name,
  m.runtime_hours,
  COUNT(s.id) AS sensors_remaining
FROM public.machines m
JOIN public.sensors s ON s.machine_id = m.id
GROUP BY m.name, m.runtime_hours
ORDER BY m.name;

-- Expected results:
-- Conveyor Drive System #1     → 1240 hrs → 15 sensors
-- Industrial Hydraulic Press #1 → 980 hrs → 11 sensors
-- Air Compressor Unit #1        → 2100 hrs → 11 sensors

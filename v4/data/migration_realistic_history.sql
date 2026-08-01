-- ============================================================
-- MIGRATION: realistic healthy history
--
-- The old generate_history() produced pure white noise spanning
-- 25% of each sensor's range, with a "cycle" whose period was 8
-- SAMPLES rather than 8 hours. Two problems:
--   1. It looks nothing like sensor data — real readings are
--      smooth, because physical quantities have inertia.
--   2. The anomaly detector trained on that huge noise band
--      learned an enormously wide "normal", so genuine faults
--      didn't look unusual and the score stayed low.
--
-- This version models a real sensor trace:
--   • a 24-hour cycle (day/night thermal + load variation)
--   • an 8-hour shift cycle, smaller
--   • a slow random walk per sensor (autocorrelated drift — the
--     reason real traces wander rather than jitter)
--   • a little white noise on top
--
-- IMPORTANT: the day/shift cycles share ONE phase across the whole
-- machine, because they represent a machine-level effect (ambient
-- temperature, production load). An earlier version gave each sensor
-- its own phase, which made sensors move in opposition — a structure
-- the live simulator never reproduces, so every live reading looked
-- anomalous and the detector reported 100%. Per-sensor individuality
-- comes from the random walk instead.
-- Values stay comfortably inside the healthy band: this is the
-- "normal" the detector learns from.
--
-- Same signature as before, so the app needs no changes.
-- Run manually in the Supabase SQL Editor.
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_history(
  p_machine_id UUID,
  p_hours INTEGER DEFAULT 24,
  p_interval_min INTEGER DEFAULT 5
)
RETURNS INTEGER AS $$
DECLARE
  inserted INTEGER := 0;
  pts INTEGER;
BEGIN
  pts := (p_hours * 60) / p_interval_min;

  -- Clear existing history for a clean regeneration
  DELETE FROM public.sensor_readings
  WHERE sensor_id IN (SELECT id FROM public.sensors WHERE machine_id = p_machine_id);

  INSERT INTO public.sensor_readings (sensor_id, value, timestamp)
  WITH grid AS (
    SELECT
      s.id                                   AS sensor_id,
      s.normal_min::numeric                  AS lo,
      s.normal_max::numeric                  AS hi,
      (s.normal_max - s.normal_min)::numeric AS rng,
      -- ONE phase for the whole machine (see note above)
      (abs(hashtext(p_machine_id::text)) % 1000) / 1000.0 * 2 * pi() AS phase,
      gs,
      NOW() - (gs * (p_interval_min || ' minutes')::INTERVAL) AS ts
    FROM public.sensors s
    CROSS JOIN generate_series(1, pts) AS gs
    WHERE s.machine_id = p_machine_id
  ),
  walked AS (
    SELECT
      grid.*,
      -- cumulative small steps = random walk (gs DESC = chronological)
      SUM(random() - 0.5) OVER (
        PARTITION BY sensor_id ORDER BY gs DESC ROWS UNBOUNDED PRECEDING
      ) AS w
    FROM grid
  )
  SELECT
    sensor_id,
    -- keep the trace inside the healthy band
    LEAST(
      lo + rng * 0.88,
      GREATEST(
        lo + rng * 0.08,
          lo + rng * 0.45                                                        -- baseline
        + rng * 0.08 * sin(2 * pi() * extract(epoch FROM ts) / 86400 + phase)    -- 24h cycle
        + rng * 0.03 * sin(2 * pi() * extract(epoch FROM ts) / 28800 + phase)    -- 8h shift cycle
        + rng * 0.05 * (w / (1 + abs(w)))                                        -- bounded drift
        + rng * 0.012 * (random() - 0.5)                                         -- sensor noise
      )
    ),
    ts
  FROM walked;

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Realistic history generator installed' AS status;

-- ============================================================
-- STEP 5 MIGRATION — data management + reset support
-- Run in Supabase SQL Editor
-- ============================================================

-- ── 1. Prune readings older than 24h ───────────────────────
CREATE OR REPLACE FUNCTION public.prune_old_readings()
RETURNS INTEGER AS $$
DECLARE
  deleted INTEGER;
BEGIN
  DELETE FROM public.sensor_readings
  WHERE timestamp < NOW() - INTERVAL '24 hours';
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 2. Optional: schedule hourly prune via pg_cron ─────────
-- Requires pg_cron (Database → Extensions → enable "pg_cron"), then uncomment:
--
-- SELECT cron.schedule('prune-sensor-readings', '0 * * * *',
--   $$ SELECT public.prune_old_readings(); $$);

-- ── 3. Reset a single machine to full health ───────────────
CREATE OR REPLACE FUNCTION public.reset_machine(
  p_machine_id UUID,
  p_wipe_history BOOLEAN DEFAULT FALSE,
  p_reset_runtime BOOLEAN DEFAULT FALSE
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.components
  SET health_score = 100, color_status = 'green', last_serviced = NOW()
  WHERE machine_id = p_machine_id;

  UPDATE public.sensors
  SET current_value = normal_min + (normal_max - normal_min) * 0.45
  WHERE machine_id = p_machine_id;

  UPDATE public.machines
  SET overall_health = 100,
      status = 'healthy',
      runtime_hours = CASE WHEN p_reset_runtime THEN 0 ELSE runtime_hours END,
      updated_at = NOW()
  WHERE id = p_machine_id;

  IF p_wipe_history THEN
    DELETE FROM public.sensor_readings
    WHERE sensor_id IN (SELECT id FROM public.sensors WHERE machine_id = p_machine_id);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 4. Generate N hours of synthetic history for a machine ─
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

  -- Clear existing history for clean regeneration
  DELETE FROM public.sensor_readings
  WHERE sensor_id IN (SELECT id FROM public.sensors WHERE machine_id = p_machine_id);

  INSERT INTO public.sensor_readings (sensor_id, value, timestamp)
  SELECT
    s.id,
    GREATEST(
      s.normal_min * 0.9,
      s.normal_min + (s.normal_max - s.normal_min) * (0.35 + 0.25 * random())
        + sin(gs::numeric / 8) * (s.normal_max - s.normal_min) * 0.05
    ),
    NOW() - (gs * (p_interval_min || ' minutes')::INTERVAL)
  FROM public.sensors s
  CROSS JOIN generate_series(1, pts) AS gs
  WHERE s.machine_id = p_machine_id;

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Step 5 migration complete' AS status;

-- ── 5. Increment machine runtime hours (sim tick) ──────────
CREATE OR REPLACE FUNCTION public.increment_runtime(p_machine_id UUID, p_hours NUMERIC)
RETURNS VOID AS $$
BEGIN
  UPDATE public.machines
  SET runtime_hours = COALESCE(runtime_hours, 0) + p_hours,
      updated_at = NOW()
  WHERE id = p_machine_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

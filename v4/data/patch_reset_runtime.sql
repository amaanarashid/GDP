-- ============================================================
-- PATCH — add runtime-reset option to reset_machine()
-- Run this in Supabase SQL Editor (safe to run anytime)
-- ============================================================

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

SELECT 'reset_machine patched with runtime option' AS status;

-- ============================================================
-- Increment machine runtime hours (called each sim tick)
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_runtime(p_machine_id UUID, p_hours NUMERIC)
RETURNS VOID AS $$
BEGIN
  UPDATE public.machines
  SET runtime_hours = COALESCE(runtime_hours, 0) + p_hours,
      updated_at = NOW()
  WHERE id = p_machine_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'increment_runtime function added' AS status;

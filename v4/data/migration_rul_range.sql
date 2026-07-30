-- ============================================================
-- MIGRATION: RUL uncertainty range
-- Adds the 80% prediction-interval bounds (from the quantile +
-- conformal models served by the ML server) to rul_predictions.
-- Run manually in the Supabase SQL Editor.
-- The app works without this migration (it retries the insert
-- without these columns), but ranges won't be stored.
-- ============================================================

ALTER TABLE public.rul_predictions
  ADD COLUMN IF NOT EXISTS rul_low  NUMERIC(6,1),
  ADD COLUMN IF NOT EXISTS rul_high NUMERIC(6,1);

COMMENT ON COLUMN public.rul_predictions.rul_low  IS 'Lower bound (days) of the 80% conformal prediction interval';
COMMENT ON COLUMN public.rul_predictions.rul_high IS 'Upper bound (days) of the 80% conformal prediction interval';

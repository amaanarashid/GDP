-- ============================================================
-- MIGRATION: live sensor values on the machine page
--
-- The `sensors` table holds current_value, but it was never added
-- to the realtime publication — so when the simulator updated a
-- sensor, no event was broadcast and the machine page's numbers
-- stayed frozen until a manual refresh.
--
-- Run manually in the Supabase SQL Editor.
-- ============================================================

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.sensors;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'sensors already in supabase_realtime — nothing to do';
END $$;

-- Realtime only sends the changed columns unless the table records
-- the full row; FULL makes updates carry every column so the UI can
-- merge them without re-fetching.
ALTER TABLE public.sensors REPLICA IDENTITY FULL;

SELECT 'Realtime sensors migration complete' AS status;

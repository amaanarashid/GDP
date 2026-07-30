-- ============================================================
-- STEP 6 — admin permissions + emergency broadcast policies
-- Run in Supabase SQL Editor
-- ============================================================

-- Allow authenticated users to INSERT machines/components/sensors
-- (admin role enforced in app; RLS already allows admin via earlier policies,
--  these ensure inserts work for the admin flows)

-- Emergency broadcasts: authenticated can insert + update active flag
DROP POLICY IF EXISTS "authenticated_insert_emergency" ON public.emergency_broadcasts;
CREATE POLICY "authenticated_insert_emergency" ON public.emergency_broadcasts
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_update_emergency" ON public.emergency_broadcasts;
CREATE POLICY "authenticated_update_emergency" ON public.emergency_broadcasts
  FOR UPDATE TO authenticated USING (true);

-- Machines: allow insert + update (soft delete) for authenticated
DROP POLICY IF EXISTS "authenticated_insert_machines" ON public.machines;
CREATE POLICY "authenticated_insert_machines" ON public.machines
  FOR INSERT TO authenticated WITH CHECK (true);

-- Components + sensors insert for authenticated (machine creation)
DROP POLICY IF EXISTS "authenticated_insert_components" ON public.components;
CREATE POLICY "authenticated_insert_components" ON public.components
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_insert_sensors" ON public.sensors;
CREATE POLICY "authenticated_insert_sensors" ON public.sensors
  FOR INSERT TO authenticated WITH CHECK (true);

SELECT 'Step 6 policies applied' AS status;

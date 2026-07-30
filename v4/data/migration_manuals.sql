-- ============================================================
-- MIGRATION: machine manuals (PDF)
-- Admins upload a PDF manual per machine; technicians open it
-- from the machine page and search it with the browser's own
-- PDF viewer (Ctrl+F).
-- Run manually in the Supabase SQL Editor.
-- ============================================================

-- 1. Columns on machines -------------------------------------
ALTER TABLE public.machines
  ADD COLUMN IF NOT EXISTS manual_url  TEXT,
  ADD COLUMN IF NOT EXISTS manual_name TEXT;

COMMENT ON COLUMN public.machines.manual_url  IS 'Public URL of the uploaded PDF manual in the "manuals" storage bucket';
COMMENT ON COLUMN public.machines.manual_name IS 'Original filename, shown to technicians';

-- 2. Storage bucket for the PDFs ------------------------------
-- Public bucket: the PDF is displayed directly in an <iframe>, so
-- it needs a readable URL. Manuals are not sensitive data.
INSERT INTO storage.buckets (id, name, public)
VALUES ('manuals', 'manuals', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

-- 3. Storage policies -----------------------------------------
-- Anyone may READ a manual (needed for the iframe / direct link).
DROP POLICY IF EXISTS "manuals_public_read" ON storage.objects;
CREATE POLICY "manuals_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'manuals');

-- Only signed-in users may upload / replace / delete.
DROP POLICY IF EXISTS "manuals_auth_insert" ON storage.objects;
CREATE POLICY "manuals_auth_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'manuals');

DROP POLICY IF EXISTS "manuals_auth_update" ON storage.objects;
CREATE POLICY "manuals_auth_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'manuals');

DROP POLICY IF EXISTS "manuals_auth_delete" ON storage.objects;
CREATE POLICY "manuals_auth_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'manuals');

SELECT 'Manuals migration complete' AS status;

-- ============================================================
-- DEMO USERS — Run AFTER schema.sql
-- Create these users in Supabase Auth > Users first,
-- then run this to set their roles.
-- ============================================================

-- After creating users in Supabase Auth dashboard:
-- Admin:      admin@agv.demo     / Admin@1234
-- Technician: tech@agv.demo      / Tech@1234

-- Update roles (replace UUIDs with actual auth user IDs)
-- UPDATE public.profiles SET role = 'admin'      WHERE email = 'admin@agv.demo';
-- UPDATE public.profiles SET role = 'technician' WHERE email = 'tech@agv.demo';

-- ── OR use this after signup via the app ───────────────────
-- The trigger auto-creates profiles. Just update role:

UPDATE public.profiles SET role = 'admin'
WHERE email = 'admin@agv.demo';

UPDATE public.profiles SET role = 'technician'
WHERE email = 'tech@agv.demo';

SELECT id, email, role FROM public.profiles;

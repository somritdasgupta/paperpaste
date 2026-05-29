-- Migration: Add explicit grants for Supabase breaking change (May 30, 2026)
-- Reference: https://github.com/orgs/supabase/discussions/45329
-- This ensures tables remain accessible via Data API after October 30, 2026

-- 1. Revoke default privileges for future tables (opt-in to new behavior)
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE USAGE, SELECT ON SEQUENCES FROM anon, authenticated, service_role;

-- 2. Grant explicit privileges to existing tables
-- Sessions table
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Devices table
GRANT SELECT, INSERT, UPDATE, DELETE ON public.devices TO anon;

-- Items table
GRANT SELECT, INSERT, UPDATE, DELETE ON public.items TO anon;

-- 3. Grant execute permissions on functions (already present but explicit)
GRANT EXECUTE ON FUNCTION public.kick_device(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.cleanup_inactive_sessions() TO anon;
GRANT EXECUTE ON FUNCTION public.header(text) TO anon;
GRANT EXECUTE ON FUNCTION public.devices_autohost() TO anon;
GRANT EXECUTE ON FUNCTION public.touch_session() TO anon;

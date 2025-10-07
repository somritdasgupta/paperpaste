-- PaperPaste Complete Database Setup
-- This script works for both fresh installations and existing database updates
-- Safe to run multiple times - will not break existing data

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tables with complete schema
DO $$ 
BEGIN
  -- Sessions table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema='public' AND table_name='sessions'
  ) THEN
    CREATE TABLE public.sessions (
      code text PRIMARY KEY,
      created_at timestamptz DEFAULT now(),
      last_activity timestamptz DEFAULT now()
    );
  END IF;

  -- Devices table with all required columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema='public' AND table_name='devices'
  ) THEN
    CREATE TABLE public.devices (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      session_code text NOT NULL REFERENCES public.sessions(code) ON DELETE CASCADE,
      device_id text NOT NULL DEFAULT '',
      device_name_encrypted text,
      is_host boolean DEFAULT false,
      last_seen timestamptz DEFAULT now(),
      is_frozen boolean DEFAULT false,
      can_view boolean DEFAULT true,
      created_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_devices_session ON public.devices(session_code);
    CREATE INDEX IF NOT EXISTS idx_devices_device_id ON public.devices(device_id);
    ALTER TABLE public.devices ADD CONSTRAINT devices_session_device_unique UNIQUE(session_code, device_id);
  ELSE
    -- Add missing columns to existing devices table
    BEGIN
      -- Add device_id column if it doesn't exist
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'devices' AND column_name = 'device_id' AND table_schema = 'public'
      ) THEN
        ALTER TABLE public.devices ADD COLUMN device_id text NOT NULL DEFAULT '';
        CREATE INDEX IF NOT EXISTS idx_devices_device_id ON public.devices(device_id);
      END IF;

      -- Add device_name_encrypted column if it doesn't exist
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'devices' AND column_name = 'device_name_encrypted' AND table_schema = 'public'
      ) THEN
        ALTER TABLE public.devices ADD COLUMN device_name_encrypted text;
      END IF;

      -- Add last_seen column if it doesn't exist
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'devices' AND column_name = 'last_seen' AND table_schema = 'public'
      ) THEN
        ALTER TABLE public.devices ADD COLUMN last_seen timestamptz DEFAULT now();
      END IF;

      -- Add is_frozen column if it doesn't exist
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'devices' AND column_name = 'is_frozen' AND table_schema = 'public'
      ) THEN
        ALTER TABLE public.devices ADD COLUMN is_frozen boolean DEFAULT false;
      END IF;

      -- Add can_view column if it doesn't exist
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'devices' AND column_name = 'can_view' AND table_schema = 'public'
      ) THEN
        ALTER TABLE public.devices ADD COLUMN can_view boolean DEFAULT true;
      END IF;

      -- Add unique constraint if it doesn't exist
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'devices' AND constraint_name = 'devices_session_device_unique' AND table_schema = 'public'
      ) THEN
        -- Handle potential duplicates before adding constraint
        WITH duplicates AS (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY session_code, device_id ORDER BY created_at) as row_num
          FROM public.devices 
          WHERE device_id != ''
        )
        DELETE FROM public.devices 
        WHERE id IN (
          SELECT id FROM duplicates WHERE row_num > 1
        );
        
        ALTER TABLE public.devices ADD CONSTRAINT devices_session_device_unique UNIQUE(session_code, device_id);
      END IF;
    END;
  END IF;

  -- Items table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema='public' AND table_name='items'
  ) THEN
    CREATE TABLE public.items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      session_code text NOT NULL REFERENCES public.sessions(code) ON DELETE CASCADE,
      kind text NOT NULL CHECK (kind IN ('text','code','file')),
      content text,
      file_url text,
      created_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_items_session ON public.items(session_code, created_at DESC);
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

-- Create header function for RLS
CREATE OR REPLACE FUNCTION public.header(name text)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce((current_setting('request.headers', true)::jsonb ->> name), '')
$$;

-- RLS Policies for Sessions
DROP POLICY IF EXISTS "sessions by header" ON public.sessions;
CREATE POLICY "sessions by header"
ON public.sessions
FOR ALL
TO anon
USING (code = public.header('x-paperpaste-session'))
WITH CHECK (code = public.header('x-paperpaste-session'));

-- RLS Policies for Devices
DROP POLICY IF EXISTS "devices by header" ON public.devices;
CREATE POLICY "devices by header"
ON public.devices
FOR ALL
TO anon
USING (session_code = public.header('x-paperpaste-session'))
WITH CHECK (session_code = public.header('x-paperpaste-session'));

DROP POLICY IF EXISTS "host can delete devices" ON public.devices;
CREATE POLICY "host can delete devices"
ON public.devices
FOR DELETE
TO anon
USING (
  session_code = public.header('x-paperpaste-session')
  AND EXISTS (
    SELECT 1 FROM public.devices h
    WHERE h.session_code = public.devices.session_code
      AND h.is_host = true
  )
);

-- RLS Policies for Items
DROP POLICY IF EXISTS "items by header" ON public.items;
CREATE POLICY "items by header"
ON public.items
FOR ALL
TO anon
USING (session_code = public.header('x-paperpaste-session'))
WITH CHECK (session_code = public.header('x-paperpaste-session'));

-- Auto-host function: First device becomes host automatically
CREATE OR REPLACE FUNCTION public.devices_autohost()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_host IS DISTINCT FROM true THEN
    SELECT NOT EXISTS(
      SELECT 1 FROM public.devices d 
      WHERE d.session_code = NEW.session_code AND d.is_host
    ) INTO STRICT NEW.is_host;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_devices_autohost ON public.devices;
CREATE TRIGGER trg_devices_autohost
BEFORE INSERT ON public.devices
FOR EACH ROW EXECUTE FUNCTION public.devices_autohost();

-- Session activity tracking
CREATE OR REPLACE FUNCTION public.touch_session()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.sessions 
  SET last_activity = now() 
  WHERE code = coalesce(NEW.session_code, OLD.session_code);
  RETURN coalesce(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_items_touch_session ON public.items;
CREATE TRIGGER trg_items_touch_session
AFTER INSERT OR UPDATE OR DELETE ON public.items
FOR EACH ROW EXECUTE FUNCTION public.touch_session();

DROP TRIGGER IF EXISTS trg_devices_touch_session ON public.devices;
CREATE TRIGGER trg_devices_touch_session
AFTER INSERT OR UPDATE OR DELETE ON public.devices
FOR EACH ROW EXECUTE FUNCTION public.touch_session();

-- Cleanup inactive sessions (3 hours)
CREATE OR REPLACE FUNCTION public.cleanup_inactive_sessions()
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  DELETE FROM public.sessions s 
  WHERE s.last_activity < now() - interval '3 hours';
$$;

-- Host can kick devices function
CREATE OR REPLACE FUNCTION public.kick_device(p_device_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.devices d
  USING public.devices h
  WHERE d.id = p_device_id
    AND h.session_code = d.session_code
    AND h.is_host = true
    AND d.session_code = public.header('x-paperpaste-session');
END $$;

GRANT EXECUTE ON FUNCTION public.kick_device(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.cleanup_inactive_sessions() TO anon;

-- Create storage bucket for file uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('paperpaste', 'paperpaste', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policy
DROP POLICY IF EXISTS "paperpaste_bucket_policy" ON storage.objects;
CREATE POLICY "paperpaste_bucket_policy"
ON storage.objects
FOR ALL
TO anon
USING (bucket_id = 'paperpaste')
WITH CHECK (bucket_id = 'paperpaste');
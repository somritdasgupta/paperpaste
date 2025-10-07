-- End-to-End Encrypted Paperpaste Database Schema
-- This schema supports anonymous, encrypted clipboard sharing

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Sessions with enhanced security
CREATE TABLE IF NOT EXISTS public.sessions (
  code text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now()
);

-- Devices with encrypted names and permission system
CREATE TABLE IF NOT EXISTS public.devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_code text NOT NULL,
  device_id text NOT NULL,
  device_name_encrypted text,
  is_host boolean NOT NULL DEFAULT false,
  is_frozen boolean NOT NULL DEFAULT false,
  can_view boolean NOT NULL DEFAULT true,
  last_seen timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_code, device_id)
);
CREATE INDEX IF NOT EXISTS idx_devices_session_code ON public.devices(session_code);
CREATE INDEX IF NOT EXISTS idx_devices_last_seen ON public.devices(last_seen);

-- Items with end-to-end encryption
CREATE TABLE IF NOT EXISTS public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_code text NOT NULL,
  kind text NOT NULL DEFAULT 'text',
  content_encrypted text,
  file_url text,
  device_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_items_session_code_created_at ON public.items(session_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_device_id ON public.items(device_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_items_updated_at ON public.items;
CREATE TRIGGER trg_items_updated_at
BEFORE UPDATE ON public.items
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Enhanced cleanup function for old sessions and associated data
CREATE OR REPLACE FUNCTION public.cleanup_inactive_sessions(cutoff_hours int default 3)
RETURNS table(deleted_sessions_count int, deleted_items_count int, deleted_devices_count int) 
LANGUAGE plpgsql AS $$
DECLARE
  cutoff_ts timestamptz := now() - interval '1 hour' * cutoff_hours;
  deleted_items int;
  deleted_devices int;
  deleted_sessions int;
BEGIN
  -- Delete items from inactive sessions
  DELETE FROM public.items WHERE session_code IN (
    SELECT code FROM public.sessions WHERE last_activity_at < cutoff_ts
  );
  GET DIAGNOSTICS deleted_items = ROW_COUNT;

  -- Delete devices from inactive sessions
  DELETE FROM public.devices WHERE session_code IN (
    SELECT code FROM public.sessions WHERE last_activity_at < cutoff_ts
  );
  GET DIAGNOSTICS deleted_devices = ROW_COUNT;

  -- Delete inactive sessions
  DELETE FROM public.sessions WHERE last_activity_at < cutoff_ts;
  GET DIAGNOSTICS deleted_sessions = ROW_COUNT;

  RETURN QUERY SELECT deleted_sessions, deleted_items, deleted_devices;
END
$$;

-- Supabase Storage bucket (public for easy downloads)
insert into storage.buckets (id, name, public)
values ('paperpaste','paperpaste', true)
on conflict (id) do nothing;

-- RLS: for initial development, allow anon read/write scoped to a session code.
-- You can later harden this by using header-based checks: request.header('x-paperpaste-session')
alter table public.sessions enable row level security;
alter table public.devices enable row level security;
alter table public.items enable row level security;

-- Development policies (broad; tighten in production)
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'sessions_dev_rw') then
    create policy sessions_dev_rw on public.sessions
      for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'devices_dev_rw') then
    create policy devices_dev_rw on public.devices
      for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'items_dev_rw') then
    create policy items_dev_rw on public.items
      for all using (true) with check (true);
  end if;
end$$;

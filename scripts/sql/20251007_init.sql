-- Enable necessary extensions
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- Sessions with 7-digit code as primary key
create table if not exists public.sessions (
  code char(7) primary key,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  secret uuid not null default gen_random_uuid()
);

-- Devices per session
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  session_code char(7) not null references public.sessions(code) on delete cascade,
  device_id uuid not null,
  last_seen timestamptz not null default now(),
  unique(session_code, device_id)
);

-- Clipboard items
create type public.item_kind as enum ('text','code','file');
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  session_code char(7) not null references public.sessions(code) on delete cascade,
  type public.item_kind not null,
  content text,
  storage_path text,
  mime_type text,
  size bigint,
  created_at timestamptz not null default now()
);
create index if not exists idx_items_session_created on public.items(session_code, created_at desc);

-- Trigger: keep session last_activity_at fresh
create or replace function public.touch_session_activity()
returns trigger language plpgsql as $$
begin
  update public.sessions set last_activity_at = now() where code = new.session_code;
  return new;
end
$$;

drop trigger if exists trg_items_touch_session on public.items;
create trigger trg_items_touch_session
after insert or update on public.items
for each row execute function public.touch_session_activity();

-- Auto-destruct function (run via scheduled cron or on-demand)
create or replace function public.cleanup_inactive_sessions()
returns void language plpgsql as $$
begin
  delete from public.sessions s
  where s.last_activity_at < now() - interval '3 hours';
end
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
  if not exists (select 1 from pg_policies where polname = 'sessions_dev_rw') then
    create policy sessions_dev_rw on public.sessions
      for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where polname = 'devices_dev_rw') then
    create policy devices_dev_rw on public.devices
      for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where polname = 'items_dev_rw') then
    create policy items_dev_rw on public.items
      for all using (true) with check (true);
  end if;
end$$;

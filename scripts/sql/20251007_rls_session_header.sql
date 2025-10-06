-- Add RLS keyed to request header x-paperpaste-session, auto-host, touch on activity, 3hr cleanup, and host kick rpc
do $$ begin
  perform 1
  from information_schema.tables
  where table_schema='public' and table_name='sessions';
  if not found then
    create table public.sessions (
      code text primary key,
      created_at timestamptz default now(),
      last_activity timestamptz default now()
    );
  end if;

  perform 1
  from information_schema.tables
  where table_schema='public' and table_name='devices';
  if not found then
    create table public.devices (
      id uuid primary key default gen_random_uuid(),
      session_code text not null references public.sessions(code) on delete cascade,
      is_host boolean default false,
      created_at timestamptz default now()
    );
    create index if not exists idx_devices_session on public.devices(session_code);
  end if;

  perform 1
  from information_schema.tables
  where table_schema='public' and table_name='items';
  if not found then
    create table public.items (
      id uuid primary key default gen_random_uuid(),
      session_code text not null references public.sessions(code) on delete cascade,
      kind text not null check (kind in ('text','code','file')),
      content text,
      file_url text,
      created_at timestamptz default now()
    );
    create index if not exists idx_items_session on public.items(session_code, created_at desc);
  end if;
end $$;

alter table public.sessions enable row level security;
alter table public.devices enable row level security;
alter table public.items enable row level security;

create or replace function public.header(name text)
returns text language sql stable as $$
  select coalesce( (current_setting('request.headers', true)::jsonb ->> name), '' )
$$;

drop policy if exists "sessions by header" on public.sessions;
create policy "sessions by header"
on public.sessions
for all
to anon
using (code = public.header('x-paperpaste-session'))
with check (code = public.header('x-paperpaste-session'));

drop policy if exists "devices by header" on public.devices;
create policy "devices by header"
on public.devices
for select, insert, update
to anon
using (session_code = public.header('x-paperpaste-session'))
with check (session_code = public.header('x-paperpaste-session'));

drop policy if exists "host can delete devices" on public.devices;
create policy "host can delete devices"
on public.devices
for delete
to anon
using (
  session_code = public.header('x-paperpaste-session')
  and exists (
    select 1 from public.devices h
    where h.session_code = public.devices.session_code
      and h.is_host = true
  )
);

drop policy if exists "items by header" on public.items;
create policy "items by header"
on public.items
for all
to anon
using (session_code = public.header('x-paperpaste-session'))
with check (session_code = public.header('x-paperpaste-session'));

create or replace function public.devices_autohost()
returns trigger language plpgsql as $$
begin
  if new.is_host is distinct from true then
    select not exists(select 1 from public.devices d where d.session_code = new.session_code and d.is_host)
      into strict new.is_host;
  end if;
  return new;
end $$;

drop trigger if exists trg_devices_autohost on public.devices;
create trigger trg_devices_autohost
before insert on public.devices
for each row execute function public.devices_autohost();

create or replace function public.touch_session()
returns trigger language plpgsql as $$
begin
  update public.sessions set last_activity = now() where code = coalesce(new.session_code, old.session_code);
  return coalesce(new, old);
end $$;

drop trigger if exists trg_items_touch_session on public.items;
create trigger trg_items_touch_session
after insert or update or delete on public.items
for each row execute function public.touch_session();

drop trigger if exists trg_devices_touch_session on public.devices;
create trigger trg_devices_touch_session
after insert or update or delete on public.devices
for each row execute function public.touch_session();

create or replace function public.cleanup_inactive_sessions()
returns void language sql security definer as $$
  delete from public.sessions s where s.last_activity < now() - interval '3 hours';
$$;

create or replace function public.kick_device(p_device_id uuid)
returns void language plpgsql security definer as $$
begin
  delete from public.devices d
  using public.devices h
  where d.id = p_device_id
    and h.session_code = d.session_code
    and h.is_host = true
    and d.session_code = public.header('x-paperpaste-session');
end $$;
grant execute on function public.kick_device(uuid) to anon;

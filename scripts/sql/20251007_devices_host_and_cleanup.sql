alter table public.devices
  add column if not exists is_host boolean default false;

-- Cleanup hook: call cleanup after item insert/update and device updates
create or replace function public.cleanup_after_activity()
returns trigger language plpgsql as $$
begin
  perform public.cleanup_inactive_sessions();
  return new;
end
$$;

drop trigger if exists trg_items_cleanup on public.items;
create trigger trg_items_cleanup
after insert or update on public.items
for each row execute function public.cleanup_after_activity();

drop trigger if exists trg_devices_cleanup on public.devices;
create trigger trg_devices_cleanup
after insert or update on public.devices
for each row execute function public.cleanup_after_activity();

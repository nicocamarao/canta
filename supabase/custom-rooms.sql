begin;

alter table public.rooms drop constraint if exists rooms_id_check;
alter table public.rooms
  add column if not exists display_name text,
  add column if not exists is_fixed boolean not null default false,
  add column if not exists created_by uuid,
  add column if not exists created_at timestamptz not null default now();

update public.rooms
set display_name = 'Sala ' || id,
    is_fixed = true
where id in ('A', 'B', 'C', 'D');
update public.rooms set display_name = 'Sala ' || id where display_name is null;
alter table public.rooms alter column display_name set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rooms_id_safe' and conrelid = 'public.rooms'::regclass) then
    alter table public.rooms add constraint rooms_id_safe check (length(id) between 1 and 79);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rooms_display_name_safe' and conrelid = 'public.rooms'::regclass) then
    alter table public.rooms add constraint rooms_display_name_safe check (length(btrim(display_name)) between 2 and 40);
  end if;
end
$$;

create or replace function public.create_room(room_name text)
returns text language plpgsql security definer set search_path = public as $$
declare
  clean_name text := btrim(room_name);
  new_id text := 'room-' || replace(gen_random_uuid()::text, '-', '');
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if length(clean_name) not between 2 and 40 then raise exception 'El nombre debe tener entre 2 y 40 caracteres.'; end if;
  insert into rooms(id, display_name, is_fixed, created_by) values (new_id, clean_name, false, auth.uid());
  return new_id;
end
$$;

revoke execute on function public.create_room(text) from public, anon;
grant execute on function public.create_room(text) to authenticated;

commit;

begin;

create table if not exists public.youtube_api_usage (
  day date primary key,
  units integer not null default 0 check (units between 0 and 8000),
  updated_at timestamptz not null default now()
);

create table if not exists public.youtube_user_usage (
  day date not null,
  user_id uuid not null,
  searches integer not null default 0,
  details integer not null default 0,
  primary key (day, user_id)
);

create table if not exists public.youtube_api_cache (
  cache_key text primary key,
  payload jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists youtube_api_cache_expiry on public.youtube_api_cache(expires_at);

alter table public.youtube_api_usage enable row level security;
alter table public.youtube_user_usage enable row level security;
alter table public.youtube_api_cache enable row level security;
revoke all on public.youtube_api_usage, public.youtube_user_usage, public.youtube_api_cache from anon, authenticated;

create or replace function public.reserve_youtube_quota(actor uuid, request_kind text, cost integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  quota_day date := (now() at time zone 'America/Los_Angeles')::date;
  global_units integer;
  user_searches integer;
  user_details integer;
begin
  if actor is null or request_kind not in ('search', 'detail') or cost not in (1, 100) then
    return false;
  end if;

  insert into youtube_api_usage(day) values (quota_day) on conflict do nothing;
  select units into global_units from youtube_api_usage where day = quota_day for update;
  if global_units + cost > 8000 then return false; end if;

  insert into youtube_user_usage(day, user_id) values (quota_day, actor) on conflict do nothing;
  select searches, details into user_searches, user_details
  from youtube_user_usage where day = quota_day and user_id = actor for update;

  if request_kind = 'search' and user_searches >= 20 then return false; end if;
  if request_kind = 'detail' and user_details >= 100 then return false; end if;

  update youtube_api_usage set units = units + cost, updated_at = now() where day = quota_day;
  update youtube_user_usage
  set searches = searches + case when request_kind = 'search' then 1 else 0 end,
      details = details + case when request_kind = 'detail' then 1 else 0 end
  where day = quota_day and user_id = actor;
  return true;
end
$$;

revoke execute on function public.reserve_youtube_quota(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.reserve_youtube_quota(uuid, text, integer) to service_role;

commit;

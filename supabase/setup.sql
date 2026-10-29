-- Run in the project's SQL editor; enable Anonymous Sign-ins in Authentication.
create table public.rooms (
 id text primary key check (id in ('A','B','C','D')),
 host_id uuid, host_seen_at timestamptz,
 video_id text check (video_id is null or video_id ~ '^[a-zA-Z0-9_-]{11}$'),
 title text not null default '' check (length(title) <= 300),
 playing boolean not null default false,
 position double precision not null default 0 check (position >= 0 and position <= 86400),
 updated_at timestamptz not null default now()
);
insert into public.rooms(id) values ('A'),('B'),('C'),('D');
alter table public.rooms enable row level security;
create policy "Visitors read room state" on public.rooms for select to authenticated using (true);
grant select on public.rooms to authenticated;
revoke insert,update,delete on public.rooms from anon,authenticated;
create function public.server_time() returns timestamptz language sql stable as $$ select now() $$;
create function public.claim_room(room text) returns boolean language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then return false; end if;
 update rooms set host_id=auth.uid(),host_seen_at=now()
 where id=room and (host_id is null or host_id=auth.uid() or host_seen_at < now()-interval '40 seconds');
 return found;
end $$;
create function public.release_room(room text) returns void language sql security definer set search_path=public as $$
 update rooms set host_id=null,host_seen_at=null where id=room and host_id=auth.uid();
$$;
create function public.set_playback(room text, video text, song_title text, is_playing boolean, at_position double precision) returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 update rooms set video_id=video,title=left(song_title,300),playing=is_playing,
 position=at_position,updated_at=now(),host_seen_at=now()
 where id=room and host_id=auth.uid();
 if not found then raise exception 'Only the room host can change playback'; end if;
end $$;
revoke execute on function public.claim_room(text), public.release_room(text),public.set_playback(text,text,text,boolean,double precision) from public,anon;
grant execute on function public.claim_room(text),public.release_room(text),public.set_playback(text,text,text,boolean,double precision) to authenticated;
alter publication supabase_realtime add table public.rooms;

begin;
alter table public.rooms add column if not exists started_at timestamptz;
create table if not exists public.room_sessions (
 client_id text primary key check(length(client_id) between 1 and 79),
 user_id uuid not null, room_id text not null references public.rooms(id),
 display_name text not null, mic boolean not null default false,cam boolean not null default false,
 last_seen_at timestamptz not null default now()
);
alter table public.room_sessions enable row level security;
revoke all on public.room_sessions from anon,authenticated;
create or replace function public.live_members() returns table(id text,name text,"roomId" text,mic boolean,cam boolean)
language sql security definer set search_path=public as $$
 select client_id,display_name,room_id,mic,cam from room_sessions where auth.uid() is not null and last_seen_at>now()-interval '12 seconds';
$$;
create or replace function public.advance_room(room text) returns void language plpgsql security definer set search_path=public as $$
declare r rooms%rowtype; q song_queue%rowtype;
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 select * into r from rooms where id=room for update;
 if not found then return;end if;
 delete from song_queue pending where pending.room_id=room and not exists(select 1 from room_sessions s where s.client_id=pending.client_id and s.user_id=pending.user_id and s.room_id=room and s.last_seen_at>now()-interval '12 seconds');
 if exists(select 1 from room_sessions s where s.client_id=r.singer_client and s.user_id=r.host_id and s.room_id=room and s.last_seen_at>now()-interval '12 seconds') then
  if r.phase='ready' and r.ready_until>now() then return;end if;
  if r.phase='playing' and r.ends_at>now() then return;end if;
 end if;
 select * into q from song_queue where room_id=room order by id limit 1;
 if found then
  delete from song_queue where id=q.id;
  update rooms set host_id=q.user_id,host_seen_at=now(),video_id=q.video_id,title=q.title,singer_name=q.singer_name,singer_client=q.client_id,duration=q.duration,playing=false,position=0,phase='ready',ready_until=now()+interval '15 seconds',ends_at=null,started_at=null,updated_at=now() where id=room;
 else
  update rooms set host_id=null,host_seen_at=null,video_id=null,title='',singer_name=null,singer_client=null,playing=false,position=0,phase='choosing',ready_until=null,ends_at=null,started_at=null,updated_at=now() where id=room and phase<>'choosing';
 end if;
end $$;
create or replace function public.room_sweep() returns void language plpgsql security definer set search_path=public as $$
declare room_id text;
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 for room_id in select id from rooms order by id loop perform advance_room(room_id);end loop;
 delete from room_sessions where last_seen_at<=now()-interval '12 seconds';
end $$;
create or replace function public.room_pulse(room text,client text,singer text,mic_on boolean,cam_on boolean) returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 insert into room_sessions(client_id,user_id,room_id,display_name,mic,cam,last_seen_at) values(client,auth.uid(),room,left(singer,60),mic_on,cam_on,now())
 on conflict(client_id) do update set room_id=excluded.room_id,display_name=excluded.display_name,mic=excluded.mic,cam=excluded.cam,last_seen_at=now() where room_sessions.user_id=auth.uid();
 if not found then raise exception 'Session belongs to another user';end if;
end $$;
create or replace function public.leave_room(room text,client text) returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then return;end if;
 delete from room_sessions where client_id=client and user_id=auth.uid() and room_id=room;
 delete from song_queue where client_id=client and user_id=auth.uid() and room_id=room;
 perform advance_room(room);
end $$;
create or replace function public.begin_song(room text,client text) returns void language plpgsql security definer set search_path=public as $$
begin
 update rooms set phase='playing',playing=true,position=0,updated_at=now()+interval '5 seconds',started_at=null,
 ends_at=now()+interval '20 seconds',ready_until=null
 where id=room and host_id=auth.uid() and singer_client=client and phase='ready' and ready_until>now()
 and exists(select 1 from room_sessions where client_id=client and user_id=auth.uid() and room_id=room and last_seen_at>now()-interval '12 seconds');
 if not found then raise exception 'El turno venció o no estás en la sala.';end if;
end $$;
create or replace function public.confirm_song_started(room text,client text,at_position double precision) returns void language plpgsql security definer set search_path=public as $$
begin
 update rooms set started_at=now()-make_interval(secs=>greatest(0,least(coalesce(at_position,0),10))),ends_at=now()+make_interval(secs=>duration+3-greatest(0,least(coalesce(at_position,0),10)))
 where id=room and host_id=auth.uid() and singer_client=client and phase='playing' and started_at is null and updated_at<=now() and ends_at>now();
end $$;
create or replace function public.finish_song(room text,client text) returns void language plpgsql security definer set search_path=public as $$
begin
 update rooms set ends_at=now(),ready_until=now() where id=room and host_id=auth.uid() and singer_client=client and phase in ('playing','ready');
 if found then perform advance_room(room);end if;
end $$;
revoke execute on function public.live_members(),public.room_sweep(),public.room_pulse(text,text,text,boolean,boolean),public.leave_room(text,text),public.confirm_song_started(text,text,double precision) from public,anon;
grant execute on function public.live_members(),public.room_sweep(),public.room_pulse(text,text,text,boolean,boolean),public.leave_room(text,text),public.confirm_song_started(text,text,double precision) to authenticated;
commit;

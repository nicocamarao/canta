alter table public.rooms add column phase text not null default 'choosing' check(phase in ('choosing','ready','playing'));
alter table public.rooms add column ready_until timestamptz;
alter table public.rooms add column ends_at timestamptz;
alter table public.rooms add column singer_name text;
alter table public.rooms add column singer_client text;
alter table public.rooms add column duration integer default 300;
create table public.song_queue (
 id bigint generated always as identity primary key,
 room_id text not null references public.rooms(id),
 user_id uuid not null,
 client_id text not null check(length(client_id)<80),
 singer_name text not null check(length(singer_name)<=60),
 video_id text not null check(video_id ~ '^[a-zA-Z0-9_-]{11}$'),
 title text not null check(length(title)<=300),
 duration integer not null check(duration between 1 and 7200),
 created_at timestamptz not null default now()
);
alter table public.song_queue enable row level security;
create policy "Guests read queue" on public.song_queue for select to authenticated using(true);
grant select on public.song_queue to authenticated;
revoke insert,update,delete on public.song_queue from anon,authenticated;
create or replace function public.advance_room(room text) returns void language plpgsql security definer set search_path=public as $$
declare r rooms%rowtype; q song_queue%rowtype;
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 select * into r from rooms where id=room for update;
 if not found then return;end if;
 if r.phase='ready' and r.ready_until>now() then return;end if;
 if r.phase='playing' and r.ends_at>now() then return;end if;
 select * into q from song_queue where room_id=room order by id limit 1;
 if found then
  delete from song_queue where id=q.id;
  update rooms set host_id=q.user_id,host_seen_at=now(),video_id=q.video_id,title=q.title,
   singer_name=q.singer_name,singer_client=q.client_id,duration=q.duration,playing=false,position=0,
   phase='ready',ready_until=now()+interval '15 seconds',ends_at=null,updated_at=now() where id=room;
 else
  update rooms set host_id=null,video_id=null,title='',singer_name=null,singer_client=null,
   playing=false,position=0,phase='choosing',ready_until=null,ends_at=null,updated_at=now() where id=room and phase<>'choosing';
 end if;
end $$;
create or replace function public.enqueue_song(room text,video text,song_title text,singer text,client text,seconds integer) returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 perform 1 from rooms where id=room for update;
 if not found then raise exception 'Unknown room';end if;
 if (select count(*) from song_queue where room_id=room)>=30 then raise exception 'La lista está llena (30 canciones).';end if;
 if (select count(*) from song_queue where user_id=auth.uid())>=5 then raise exception 'Ya tenés 5 canciones en espera.';end if;
 if song_title !~* '\mkaraoke\M' then raise exception 'Solo versiones karaoke';end if;
 insert into song_queue(room_id,user_id,client_id,singer_name,video_id,title,duration) values(room,auth.uid(),client,left(singer,60),video,left(song_title,300),seconds);
 perform advance_room(room);
end $$;
create or replace function public.begin_song(room text,client text) returns void language plpgsql security definer set search_path=public as $$
begin
 update rooms set phase='playing',playing=true,position=0,updated_at=now()+interval '3 seconds',
 ends_at=now()+interval '3 seconds'+make_interval(secs=>duration+3),ready_until=null
 where id=room and host_id=auth.uid() and singer_client=client and phase='ready' and ready_until>now();
 if not found then raise exception 'El turno ya venció o le toca a otra persona.';end if;
end $$;
create or replace function public.finish_song(room text,client text) returns void language plpgsql security definer set search_path=public as $$
begin
 update rooms set ends_at=now() where id=room and host_id=auth.uid() and singer_client=client and phase='playing';
 if found then perform advance_room(room);end if;
end $$;
create or replace function public.remove_queued_song(song bigint) returns void language sql security definer set search_path=public as $$
 delete from song_queue where id=song and user_id=auth.uid();
$$;
-- Queue ownership replaces the previous manually claimed host role.
revoke execute on function public.claim_room(text),public.release_room(text),public.set_playback(text,text,text,boolean,double precision) from authenticated;
revoke execute on function public.advance_room(text),public.enqueue_song(text,text,text,text,text,integer),public.begin_song(text,text),public.finish_song(text,text),public.remove_queued_song(bigint) from public,anon;
grant execute on function public.advance_room(text),public.enqueue_song(text,text,text,text,text,integer),public.begin_song(text,text),public.finish_song(text,text),public.remove_queued_song(bigint) to authenticated;
alter publication supabase_realtime add table public.song_queue;

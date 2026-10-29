create or replace function public.enqueue_song(room text,video text,song_title text,singer text,client text,seconds integer) returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 perform 1 from rooms where id=room for update;
 if not found then raise exception 'Unknown room';end if;
 if not exists(select 1 from room_sessions where client_id=client and user_id=auth.uid() and room_id=room and last_seen_at>now()-interval '8 seconds') then raise exception 'Tu conexión a la sala venció. Recargá la página y volvé a entrar.';end if;
 if (select count(*) from song_queue where room_id=room)>=30 then raise exception 'La lista está llena (30 canciones).';end if;
 if (select count(*) from song_queue where user_id=auth.uid())>=5 then raise exception 'Ya tenés 5 canciones en espera.';end if;
 if song_title !~* '\mkaraoke\M' then raise exception 'Solo versiones karaoke';end if;
 insert into song_queue(room_id,user_id,client_id,singer_name,video_id,title,duration) values(room,auth.uid(),client,left(singer,60),video,left(song_title,300),seconds);
 perform advance_room(room);
end $$;

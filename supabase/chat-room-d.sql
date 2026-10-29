begin;

delete from public.song_queue where room_id = 'D';

update public.rooms
set host_id = null,
    host_seen_at = null,
    video_id = null,
    title = '',
    singer_name = null,
    singer_client = null,
    playing = false,
    position = 0,
    phase = 'choosing',
    ready_until = null,
    ends_at = null,
    started_at = null,
    updated_at = now()
where id = 'D';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'song_queue_excludes_chat_room'
      and conrelid = 'public.song_queue'::regclass
  ) then
    alter table public.song_queue
      add constraint song_queue_excludes_chat_room check (room_id <> 'D');
  end if;
end
$$;

commit;

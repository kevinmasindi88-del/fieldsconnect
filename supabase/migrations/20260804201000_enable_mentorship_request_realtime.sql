begin;

alter table public.mentorship_requests
  replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'mentorship_requests'
  ) then
    alter publication supabase_realtime
      add table public.mentorship_requests;
  end if;
end;
$$;

commit;
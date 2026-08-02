-- Enable live updates in private mentorship workspaces.

begin;

alter table public.mentorship_updates
replica identity full;

alter table public.mentorship_milestones
replica identity full;

alter table public.mentorship_action_items
replica identity full;

do $block$
begin
  if not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'mentorship_updates'
  ) then
    alter publication supabase_realtime
    add table public.mentorship_updates;
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'mentorship_milestones'
  ) then
    alter publication supabase_realtime
    add table public.mentorship_milestones;
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'mentorship_action_items'
  ) then
    alter publication supabase_realtime
    add table public.mentorship_action_items;
  end if;
end;
$block$;

commit;
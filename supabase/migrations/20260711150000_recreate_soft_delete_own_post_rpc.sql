-- Recreate the post soft-delete RPC under a timestamped migration so the CLI cannot skip it.

drop function if exists public.soft_delete_own_post(uuid);

create function public.soft_delete_own_post(target_post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  affected_rows integer;
begin
  update public.posts
  set deleted_at = now()
  where id = target_post_id
    and author_id = auth.uid()
    and deleted_at is null;

  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end;
$$;

revoke all on function public.soft_delete_own_post(uuid) from public;
grant execute on function public.soft_delete_own_post(uuid) to authenticated;

notify pgrst, 'reload schema';

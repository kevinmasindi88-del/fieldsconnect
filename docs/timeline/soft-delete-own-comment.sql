create or replace function public.soft_delete_own_comment(target_comment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_rows integer;
  current_user_id uuid;
begin
  current_user_id := auth.uid();
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  update public.comments
  set deleted_at = now()
  where id = target_comment_id
    and author_id = current_user_id
    and deleted_at is null;

  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end;
$$;

revoke all on function public.soft_delete_own_comment(uuid) from public;
revoke all on function public.soft_delete_own_comment(uuid) from anon;
grant execute on function public.soft_delete_own_comment(uuid) to authenticated;
-- Soft-delete a comment owned by the authenticated user.

create or replace function public.soft_delete_own_comment(target_comment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_rows integer;
begin
  update public.comments
  set deleted_at = now()
  where id = target_comment_id
    and author_id = auth.uid()
    and deleted_at is null;

  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end;
$$;

revoke all on function public.soft_delete_own_comment(uuid) from public;
grant execute on function public.soft_delete_own_comment(uuid) to authenticated;

notify pgrst, 'reload schema';

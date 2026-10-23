-- Legacy clients can publish anonymous text only; they cannot retain or revive
-- the newer explicit consent to show the mentee identity and cycle title.
create or replace function public.set_mentorship_review_publication(
  target_mentorship_id uuid,
  publish_review boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  changed_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if publish_review is null then
    raise exception 'Choose whether to share the written review';
  end if;

  update public.mentorship_completion_feedback f
  set is_public_review = publish_review,
      is_public_named_review = false
  from public.mentorships m
  where f.mentorship_id = target_mentorship_id
    and m.id = f.mentorship_id
    and m.status = 'completed'
    and m.mentee_id = auth.uid()
    and f.author_id = auth.uid()
    and f.author_role = 'mentee'
    and f.mentor_rating between 1 and 5
  returning f.id into changed_id;

  if changed_id is null then
    raise exception 'Only the mentee may share or hide a submitted review for a completed mentorship';
  end if;
end;
$function$;

revoke all on function public.set_mentorship_review_publication(uuid,boolean)
  from public, anon;
grant execute on function public.set_mentorship_review_publication(uuid,boolean)
  to authenticated;

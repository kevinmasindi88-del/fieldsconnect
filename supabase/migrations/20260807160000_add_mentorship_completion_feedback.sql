create table if not exists
public.mentorship_completion_feedback (
  id uuid primary key default gen_random_uuid(),

  mentorship_id uuid not null
    references public.mentorships(id)
    on delete cascade,

  author_id uuid not null
    references public.profiles(id)
    on delete cascade,

  author_role text not null
    check (
      author_role in ('mentor', 'mentee')
    ),

  feedback text not null
    check (
      char_length(trim(feedback))
        between 10 and 2000
    ),

  submitted_at timestamptz not null
    default now(),

  unique (
    mentorship_id,
    author_id
  )
);

create index if not exists
mentorship_completion_feedback_mentorship_idx
on public.mentorship_completion_feedback (
  mentorship_id,
  submitted_at
);

alter table
public.mentorship_completion_feedback
enable row level security;

drop policy if exists
"Participants can view completion feedback"
on public.mentorship_completion_feedback;

create policy
"Participants can view completion feedback"
on public.mentorship_completion_feedback
for select
to authenticated
using (
  exists (
    select 1
    from public.mentorships mentorship
    where mentorship.id =
      mentorship_completion_feedback.mentorship_id
      and auth.uid() in (
        mentorship.mentor_id,
        mentorship.mentee_id
      )
  )
);

create or replace function
public.submit_mentorship_completion_feedback(
  target_mentorship_id uuid,
  feedback_text text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  target_mentorship public.mentorships%rowtype;
  feedback_id uuid;
  next_author_role text;
  cleaned_feedback text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  cleaned_feedback := trim(feedback_text);

  if char_length(cleaned_feedback) < 10 then
    raise exception
      'Feedback must be at least 10 characters';
  end if;

  if char_length(cleaned_feedback) > 2000 then
    raise exception
      'Feedback may not exceed 2000 characters';
  end if;

  select *
  into target_mentorship
  from public.mentorships
  where id = target_mentorship_id
  for update;

  if not found then
    raise exception 'Mentorship not found';
  end if;

  if target_mentorship.status <> 'completed' then
    raise exception
      'Completion feedback is only available after the mentorship is completed';
  end if;

  if auth.uid() = target_mentorship.mentor_id then
    next_author_role := 'mentor';
  elsif auth.uid() = target_mentorship.mentee_id then
    next_author_role := 'mentee';
  else
    raise exception
      'Only mentorship participants may submit completion feedback';
  end if;

  if exists (
    select 1
    from public.mentorship_completion_feedback
    where mentorship_id =
      target_mentorship_id
      and author_id = auth.uid()
  ) then
    raise exception
      'Completion feedback has already been submitted';
  end if;

  insert into public.mentorship_completion_feedback (
    mentorship_id,
    author_id,
    author_role,
    feedback
  )
  values (
    target_mentorship_id,
    auth.uid(),
    next_author_role,
    cleaned_feedback
  )
  returning id
  into feedback_id;

  insert into public.mentorship_audit_events (
    mentorship_id,
    actor_id,
    event_type,
    previous_status,
    new_status,
    notes
  )
  values (
    target_mentorship_id,
    auth.uid(),
    'completion_feedback_submitted',
    'completed',
    'completed',
    null
  );

  return feedback_id;
end;
$function$;

revoke all
on function
public.submit_mentorship_completion_feedback(
  uuid,
  text
)
from public, anon;

grant execute
on function
public.submit_mentorship_completion_feedback(
  uuid,
  text
)
to authenticated;

alter table
public.mentorship_completion_feedback
replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename =
        'mentorship_completion_feedback'
  ) then
    alter publication supabase_realtime
      add table
        public.mentorship_completion_feedback;
  end if;
end;
$$;
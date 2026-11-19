-- ============================================================================
-- FieldsConnect FC News workflow
--
-- Pilot scope:
-- - Active FC Team members author FC News.
-- - Senior moderators and administrators review.
-- - Reviewer may approve or return with mandatory comments.
-- - Only the original active FC Team author may publish approved news.
-- - Published content becomes a normal public timeline post.
-- - Public attribution is resolved through fc_news_publications as "FC News".
-- - Human author identity remains internal to the editorial workflow.
-- - Published FC News is immutable after approval/publication.
-- - Publication creates a notification for every active profile.
--
-- Future scope deliberately excluded from this migration:
-- - image uploads
-- - rich link previews
-- - media storage
-- ============================================================================


-- ============================================================================
-- Editorial workflow table
-- ============================================================================

create table if not exists public.fc_news (
  id uuid primary key default gen_random_uuid(),

  author_id uuid not null
    references public.profiles(id)
    on delete restrict,

  title text not null,
  body text not null,

  status text not null default 'draft'
    check (
      status in (
        'draft',
        'submitted_for_review',
        'changes_requested',
        'approved',
        'published'
      )
    ),

  reviewer_id uuid
    references public.profiles(id)
    on delete set null,

  reviewer_comments text,

  submitted_at timestamptz,
  reviewed_at timestamptz,
  approved_at timestamptz,
  published_at timestamptz,

  published_post_id uuid unique
    references public.posts(id)
    on delete restrict,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fc_news_title_length_check
    check (
      char_length(trim(title)) between 1 and 160
    ),

  constraint fc_news_body_length_check
    check (
      char_length(trim(body)) between 1 and 10000
    ),

  constraint fc_news_reviewer_comments_length_check
    check (
      reviewer_comments is null
      or char_length(trim(reviewer_comments)) between 1 and 5000
    ),

  constraint fc_news_published_state_check
    check (
      (
        status = 'published'
        and published_post_id is not null
        and published_at is not null
        and approved_at is not null
      )
      or
      (
        status <> 'published'
        and published_post_id is null
        and published_at is null
      )
    )
);


create index if not exists fc_news_author_status_idx
on public.fc_news(author_id, status, created_at desc);


create index if not exists fc_news_review_queue_idx
on public.fc_news(status, submitted_at desc)
where status = 'submitted_for_review';


create index if not exists fc_news_published_at_idx
on public.fc_news(published_at desc)
where status = 'published';


-- ============================================================================
-- Public publication mapping
--
-- This deliberately contains no human author identity.
-- Timeline/detail UI will use this table to identify official FC News posts.
-- ============================================================================

create table if not exists public.fc_news_publications (
  post_id uuid primary key
    references public.posts(id)
    on delete restrict,

  fc_news_id uuid not null unique
    references public.fc_news(id)
    on delete restrict,

  title text not null,

  published_at timestamptz not null default now(),

  constraint fc_news_publication_title_length_check
    check (
      char_length(trim(title)) between 1 and 160
    )
);


create index if not exists fc_news_publications_published_at_idx
on public.fc_news_publications(published_at desc);


-- ============================================================================
-- Updated-at trigger
-- ============================================================================

drop trigger if exists fc_news_set_updated_at
on public.fc_news;

create trigger fc_news_set_updated_at
before update on public.fc_news
for each row
execute function public.set_updated_at();


-- ============================================================================
-- Row-level security
-- ============================================================================

alter table public.fc_news enable row level security;
alter table public.fc_news_publications enable row level security;


drop policy if exists "fc_news_internal_read"
on public.fc_news;

create policy "fc_news_internal_read"
on public.fc_news
for select
to authenticated
using (
  author_id = auth.uid()
  or public.has_platform_role(
    array['senior_moderator', 'admin']
  )
);


drop policy if exists "fc_news_publications_read"
on public.fc_news_publications;

create policy "fc_news_publications_read"
on public.fc_news_publications
for select
to authenticated
using (true);


-- No direct INSERT / UPDATE / DELETE policies are created for fc_news.
-- Editorial state changes must go through the controlled RPC functions below.
--
-- No write policies are created for fc_news_publications.
-- Only publish_fc_news() may create a public mapping.


-- ============================================================================
-- Create draft
-- ============================================================================

create or replace function public.create_fc_news(
  news_title text,
  news_body text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  news_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_fc_team_member(auth.uid()) then
    raise exception 'Only an active FC Team member may create FC News';
  end if;

  if char_length(trim(coalesce(news_title, ''))) not between 1 and 160 then
    raise exception 'FC News title must be between 1 and 160 characters';
  end if;

  if char_length(trim(coalesce(news_body, ''))) not between 1 and 10000 then
    raise exception 'FC News body must be between 1 and 10000 characters';
  end if;

  insert into public.fc_news (
    author_id,
    title,
    body,
    status
  )
  values (
    auth.uid(),
    trim(news_title),
    trim(news_body),
    'draft'
  )
  returning id into news_id;

  insert into public.admin_audit_logs (
    actor_id,
    action,
    target_type,
    target_id,
    metadata
  )
  values (
    auth.uid(),
    'fc_news_created',
    'fc_news',
    news_id,
    jsonb_build_object(
      'status',
      'draft'
    )
  );

  return news_id;
end;
$$;


-- ============================================================================
-- Edit draft / returned news
-- ============================================================================

create or replace function public.update_fc_news(
  news_id uuid,
  news_title text,
  news_body text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  news_record public.fc_news%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_fc_team_member(auth.uid()) then
    raise exception 'Only an active FC Team member may edit FC News';
  end if;

  select *
  into news_record
  from public.fc_news
  where id = news_id
  for update;

  if news_record.id is null then
    raise exception 'FC News item not found';
  end if;

  if news_record.author_id <> auth.uid() then
    raise exception 'Only the FC News author may edit this item';
  end if;

  if news_record.status not in ('draft', 'changes_requested') then
    raise exception 'FC News may only be edited while draft or changes are requested';
  end if;

  if char_length(trim(coalesce(news_title, ''))) not between 1 and 160 then
    raise exception 'FC News title must be between 1 and 160 characters';
  end if;

  if char_length(trim(coalesce(news_body, ''))) not between 1 and 10000 then
    raise exception 'FC News body must be between 1 and 10000 characters';
  end if;

  update public.fc_news
  set
    title = trim(news_title),
    body = trim(news_body)
  where id = news_id;

  insert into public.admin_audit_logs (
    actor_id,
    action,
    target_type,
    target_id,
    metadata
  )
  values (
    auth.uid(),
    'fc_news_updated',
    'fc_news',
    news_id,
    jsonb_build_object(
      'status',
      news_record.status
    )
  );
end;
$$;


-- ============================================================================
-- Submit / resubmit for review
-- ============================================================================

create or replace function public.submit_fc_news_for_review(
  news_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  news_record public.fc_news%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_fc_team_member(auth.uid()) then
    raise exception 'Only an active FC Team member may submit FC News';
  end if;

  select *
  into news_record
  from public.fc_news
  where id = news_id
  for update;

  if news_record.id is null then
    raise exception 'FC News item not found';
  end if;

  if news_record.author_id <> auth.uid() then
    raise exception 'Only the FC News author may submit this item';
  end if;

  if news_record.status not in ('draft', 'changes_requested') then
    raise exception 'This FC News item cannot currently be submitted for review';
  end if;

  update public.fc_news
  set
    status = 'submitted_for_review',
    submitted_at = now(),
    reviewer_id = null,
    reviewer_comments = null,
    reviewed_at = null,
    approved_at = null
  where id = news_id;

  insert into public.notifications (
    recipient_id,
    actor_id,
    notification_type,
    entity_type,
    entity_id,
    title,
    body
  )
  select
    role_record.user_id,
    auth.uid(),
    'fc_news_review_requested',
    'fc_news',
    news_id,
    'FC News review requested',
    'An FC News item has been submitted for review.'
  from public.platform_roles role_record
  where role_record.role in ('senior_moderator', 'admin')
    and role_record.revoked_at is null
    and role_record.user_id is distinct from auth.uid();

  insert into public.admin_audit_logs (
    actor_id,
    action,
    target_type,
    target_id,
    metadata
  )
  values (
    auth.uid(),
    'fc_news_submitted_for_review',
    'fc_news',
    news_id,
    jsonb_build_object(
      'status',
      'submitted_for_review'
    )
  );
end;
$$;


-- ============================================================================
-- Review
--
-- approve_news = true:
--   comments optional
--   item becomes approved
--
-- approve_news = false:
--   comments mandatory
--   item becomes changes_requested
--
-- Self-approval is prohibited.
-- ============================================================================

create or replace function public.review_fc_news(
  news_id uuid,
  approve_news boolean,
  review_comments text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  news_record public.fc_news%rowtype;
  normalized_comments text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.has_platform_role(
    array['senior_moderator', 'admin']
  ) then
    raise exception 'Only a senior moderator or administrator may review FC News';
  end if;

  select *
  into news_record
  from public.fc_news
  where id = news_id
  for update;

  if news_record.id is null then
    raise exception 'FC News item not found';
  end if;

  if news_record.status <> 'submitted_for_review' then
    raise exception 'Only submitted FC News may be reviewed';
  end if;

  if news_record.author_id = auth.uid() then
    raise exception 'An FC News author cannot approve or review their own submission';
  end if;

  normalized_comments :=
    nullif(trim(coalesce(review_comments, '')), '');

  if not approve_news and normalized_comments is null then
    raise exception 'Review comments are required when changes are requested';
  end if;

  if normalized_comments is not null
     and char_length(normalized_comments) > 5000 then
    raise exception 'Review comments may not exceed 5000 characters';
  end if;

  if approve_news then
    update public.fc_news
    set
      status = 'approved',
      reviewer_id = auth.uid(),
      reviewer_comments = normalized_comments,
      reviewed_at = now(),
      approved_at = now()
    where id = news_id;

    insert into public.notifications (
      recipient_id,
      actor_id,
      notification_type,
      entity_type,
      entity_id,
      title,
      body
    )
    values (
      news_record.author_id,
      auth.uid(),
      'fc_news_approved',
      'fc_news',
      news_id,
      'FC News approved',
      'Your FC News item has been approved and is ready to post.'
    );

    insert into public.admin_audit_logs (
      actor_id,
      action,
      target_type,
      target_id,
      metadata
    )
    values (
      auth.uid(),
      'fc_news_approved',
      'fc_news',
      news_id,
      jsonb_build_object(
        'author_id',
        news_record.author_id
      )
    );
  else
    update public.fc_news
    set
      status = 'changes_requested',
      reviewer_id = auth.uid(),
      reviewer_comments = normalized_comments,
      reviewed_at = now(),
      approved_at = null
    where id = news_id;

    insert into public.notifications (
      recipient_id,
      actor_id,
      notification_type,
      entity_type,
      entity_id,
      title,
      body
    )
    values (
      news_record.author_id,
      auth.uid(),
      'fc_news_changes_requested',
      'fc_news',
      news_id,
      'FC News changes requested',
      normalized_comments
    );

    insert into public.admin_audit_logs (
      actor_id,
      action,
      target_type,
      target_id,
      metadata
    )
    values (
      auth.uid(),
      'fc_news_changes_requested',
      'fc_news',
      news_id,
      jsonb_build_object(
        'author_id',
        news_record.author_id,
        'review_comments',
        normalized_comments
      )
    );
  end if;
end;
$$;


-- ============================================================================
-- Publish approved FC News
--
-- Publishing:
-- 1. verifies original author + active FC Team membership
-- 2. creates ordinary public timeline post
-- 3. creates public FC News mapping
-- 4. finalises editorial record
-- 5. notifies every active profile
-- 6. records audit event
-- ============================================================================

create or replace function public.publish_fc_news(
  news_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  news_record public.fc_news%rowtype;
  timeline_post_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_fc_team_member(auth.uid()) then
    raise exception 'Only an active FC Team member may publish FC News';
  end if;

  select *
  into news_record
  from public.fc_news
  where id = news_id
  for update;

  if news_record.id is null then
    raise exception 'FC News item not found';
  end if;

  if news_record.author_id <> auth.uid() then
    raise exception 'Only the original FC News author may publish this item';
  end if;

  if news_record.status <> 'approved' then
    raise exception 'Only approved FC News may be posted';
  end if;

  if news_record.published_post_id is not null then
    raise exception 'This FC News item has already been published';
  end if;

  insert into public.posts (
    author_id,
    body,
    visibility
  )
  values (
    news_record.author_id,
    news_record.body,
    'public'
  )
  returning id into timeline_post_id;

  insert into public.fc_news_publications (
    post_id,
    fc_news_id,
    title,
    published_at
  )
  values (
    timeline_post_id,
    news_record.id,
    news_record.title,
    now()
  );

  update public.fc_news
  set
    status = 'published',
    published_post_id = timeline_post_id,
    published_at = now()
  where id = news_id;

  insert into public.notifications (
    recipient_id,
    actor_id,
    notification_type,
    entity_type,
    entity_id,
    title,
    body
  )
  select
    profile.id,
    null,
    'fc_news_published',
    'post',
    timeline_post_id,
    'FC News',
    'New FC News post'
  from public.profiles profile
  where profile.deleted_at is null;

  insert into public.admin_audit_logs (
    actor_id,
    action,
    target_type,
    target_id,
    metadata
  )
  values (
    auth.uid(),
    'fc_news_published',
    'fc_news',
    news_id,
    jsonb_build_object(
      'post_id',
      timeline_post_id
    )
  );

  return timeline_post_id;
end;
$$;


-- ============================================================================
-- Protect published FC News timeline posts from ordinary post editing/deletion.
--
-- Once approved and published, the exact reviewed content must not be silently
-- modified through the normal timeline post controls.
-- ============================================================================

create or replace function public.protect_published_fc_news_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.fc_news_publications publication
    where publication.post_id = old.id
  ) then
    raise exception 'Published FC News cannot be edited or deleted through normal timeline controls';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;


drop trigger if exists protect_published_fc_news_post
on public.posts;

create trigger protect_published_fc_news_post
before update or delete on public.posts
for each row
execute function public.protect_published_fc_news_post();


-- ============================================================================
-- Grants / API boundary
-- ============================================================================

revoke all privileges
on table public.fc_news
from public, anon, authenticated;

grant select
on table public.fc_news
to authenticated;


revoke all privileges
on table public.fc_news_publications
from public, anon, authenticated;

grant select
on table public.fc_news_publications
to authenticated;


revoke all on function
public.create_fc_news(text, text)
from public, anon;

grant execute on function
public.create_fc_news(text, text)
to authenticated;


revoke all on function
public.update_fc_news(uuid, text, text)
from public, anon;

grant execute on function
public.update_fc_news(uuid, text, text)
to authenticated;


revoke all on function
public.submit_fc_news_for_review(uuid)
from public, anon;

grant execute on function
public.submit_fc_news_for_review(uuid)
to authenticated;


revoke all on function
public.review_fc_news(uuid, boolean, text)
from public, anon;

grant execute on function
public.review_fc_news(uuid, boolean, text)
to authenticated;


revoke all on function
public.publish_fc_news(uuid)
from public, anon;

grant execute on function
public.publish_fc_news(uuid)
to authenticated;


-- Trigger helper is internal-only.
revoke all on function
public.protect_published_fc_news_post()
from public, anon, authenticated;

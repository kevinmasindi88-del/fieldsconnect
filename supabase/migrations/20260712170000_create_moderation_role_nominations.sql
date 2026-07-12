-- FieldsConnect moderation-role nomination foundation.
-- Platform roles are separate from profiles.role_type, which describes the user's professional category.

create table if not exists public.platform_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'moderator', 'senior_moderator', 'admin')) default 'user',
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.role_nominations (
  id uuid primary key default gen_random_uuid(),
  nominee_id uuid not null references auth.users(id) on delete cascade,
  nominated_by uuid not null references auth.users(id) on delete restrict,
  proposed_role text not null check (proposed_role in ('moderator', 'senior_moderator', 'admin')),
  justification text not null check (char_length(trim(justification)) >= 20),
  evidence_notes text,
  expected_availability text,
  conflict_of_interest_notes text,
  status text not null default 'awaiting_response' check (
    status in (
      'draft',
      'awaiting_response',
      'accepted',
      'declined',
      'expired',
      'awaiting_final_approval',
      'approved',
      'activated',
      'revoked'
    )
  ),
  code_of_conduct_acknowledged boolean not null default false,
  confidentiality_acknowledged boolean not null default false,
  impartiality_acknowledged boolean not null default false,
  conflict_declaration_acknowledged boolean not null default false,
  responded_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  activated_at timestamptz,
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (nominee_id, proposed_role, status)
);

create index if not exists role_nominations_nominee_idx
  on public.role_nominations (nominee_id, created_at desc);

create index if not exists role_nominations_status_idx
  on public.role_nominations (status, created_at desc);

create or replace function public.current_platform_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select role
      from public.platform_roles
      where user_id = auth.uid()
        and revoked_at is null
    ),
    'user'
  );
$$;

create or replace function public.has_platform_role(required_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_platform_role() = any(required_roles);
$$;

-- Bootstrap the founder account as administrator.
insert into public.platform_roles (user_id, role, granted_by)
select id, 'admin', id
from auth.users
where lower(email) = lower('kevinmasindi@yahoo.com')
on conflict (user_id) do update
set role = 'admin',
    granted_by = excluded.granted_by,
    revoked_at = null,
    updated_at = now();

create or replace function public.nominate_platform_role(
  nominee uuid,
  proposed text,
  justification_text text,
  evidence_text text default null,
  availability_text text default null,
  conflict_text text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text := public.current_platform_role();
  nomination_id uuid;
  nominee_current_role text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if proposed not in ('moderator', 'senior_moderator', 'admin') then
    raise exception 'Invalid proposed role';
  end if;

  if char_length(trim(coalesce(justification_text, ''))) < 20 then
    raise exception 'A nomination justification of at least 20 characters is required';
  end if;

  if proposed = 'moderator' and caller_role not in ('senior_moderator', 'admin') then
    raise exception 'Only a senior moderator or administrator may nominate a moderator';
  end if;

  if proposed in ('senior_moderator', 'admin') and caller_role <> 'admin' then
    raise exception 'Only an administrator may nominate this role';
  end if;

  if nominee = auth.uid() then
    raise exception 'Users may not nominate themselves';
  end if;

  select coalesce(role, 'user')
    into nominee_current_role
  from public.platform_roles
  where user_id = nominee
    and revoked_at is null;

  nominee_current_role := coalesce(nominee_current_role, 'user');

  if proposed = 'moderator' and nominee_current_role <> 'user' then
    raise exception 'Only a standard user may be nominated as moderator';
  end if;

  if proposed = 'senior_moderator' and nominee_current_role <> 'moderator' then
    raise exception 'Only an active moderator may be nominated as senior moderator';
  end if;

  if proposed = 'admin' and nominee_current_role <> 'senior_moderator' then
    raise exception 'Only an active senior moderator may be nominated as administrator';
  end if;

  if exists (
    select 1
    from public.role_nominations
    where nominee_id = nominee
      and proposed_role = proposed
      and status in ('awaiting_response', 'accepted', 'awaiting_final_approval', 'approved')
  ) then
    raise exception 'An active nomination for this role already exists';
  end if;

  insert into public.role_nominations (
    nominee_id,
    nominated_by,
    proposed_role,
    justification,
    evidence_notes,
    expected_availability,
    conflict_of_interest_notes,
    status
  ) values (
    nominee,
    auth.uid(),
    proposed,
    trim(justification_text),
    nullif(trim(coalesce(evidence_text, '')), ''),
    nullif(trim(coalesce(availability_text, '')), ''),
    nullif(trim(coalesce(conflict_text, '')), ''),
    'awaiting_response'
  )
  returning id into nomination_id;

  return nomination_id;
end;
$$;

create or replace function public.respond_to_role_nomination(
  nomination uuid,
  accept_nomination boolean,
  acknowledge_coc boolean default false,
  acknowledge_confidentiality boolean default false,
  acknowledge_impartiality boolean default false,
  acknowledge_conflicts boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  nomination_record public.role_nominations%rowtype;
begin
  select * into nomination_record
  from public.role_nominations
  where id = nomination
  for update;

  if nomination_record.id is null then
    raise exception 'Nomination not found';
  end if;

  if nomination_record.nominee_id <> auth.uid() then
    raise exception 'This nomination does not belong to the current user';
  end if;

  if nomination_record.status <> 'awaiting_response' then
    raise exception 'This nomination can no longer be answered';
  end if;

  if nomination_record.expires_at <= now() then
    update public.role_nominations
    set status = 'expired', updated_at = now()
    where id = nomination;
    raise exception 'This nomination has expired';
  end if;

  if not accept_nomination then
    update public.role_nominations
    set status = 'declined',
        responded_at = now(),
        updated_at = now()
    where id = nomination;
    return;
  end if;

  if not (acknowledge_coc and acknowledge_confidentiality and acknowledge_impartiality and acknowledge_conflicts) then
    raise exception 'All moderator acknowledgements must be accepted';
  end if;

  update public.role_nominations
  set status = 'awaiting_final_approval',
      code_of_conduct_acknowledged = true,
      confidentiality_acknowledged = true,
      impartiality_acknowledged = true,
      conflict_declaration_acknowledged = true,
      responded_at = now(),
      updated_at = now()
  where id = nomination;
end;
$$;

create or replace function public.approve_and_activate_role_nomination(nomination uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  nomination_record public.role_nominations%rowtype;
  caller_role text := public.current_platform_role();
begin
  if caller_role <> 'admin' then
    raise exception 'Only an administrator may approve and activate role nominations';
  end if;

  select * into nomination_record
  from public.role_nominations
  where id = nomination
  for update;

  if nomination_record.id is null then
    raise exception 'Nomination not found';
  end if;

  if nomination_record.status <> 'awaiting_final_approval' then
    raise exception 'Nomination is not awaiting final approval';
  end if;

  if not (
    nomination_record.code_of_conduct_acknowledged
    and nomination_record.confidentiality_acknowledged
    and nomination_record.impartiality_acknowledged
    and nomination_record.conflict_declaration_acknowledged
  ) then
    raise exception 'Required acknowledgements are incomplete';
  end if;

  insert into public.platform_roles (user_id, role, granted_by, granted_at, revoked_at, updated_at)
  values (nomination_record.nominee_id, nomination_record.proposed_role, auth.uid(), now(), null, now())
  on conflict (user_id) do update
  set role = excluded.role,
      granted_by = excluded.granted_by,
      granted_at = excluded.granted_at,
      revoked_at = null,
      updated_at = now();

  update public.role_nominations
  set status = 'activated',
      approved_by = auth.uid(),
      approved_at = now(),
      activated_at = now(),
      updated_at = now()
  where id = nomination;
end;
$$;

alter table public.platform_roles enable row level security;
alter table public.role_nominations enable row level security;

revoke all on public.platform_roles from anon, authenticated;
revoke all on public.role_nominations from anon, authenticated;

grant select on public.platform_roles to authenticated;
grant select on public.role_nominations to authenticated;
grant execute on function public.current_platform_role() to authenticated;
grant execute on function public.has_platform_role(text[]) to authenticated;
grant execute on function public.nominate_platform_role(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.respond_to_role_nomination(uuid, boolean, boolean, boolean, boolean, boolean) to authenticated;
grant execute on function public.approve_and_activate_role_nomination(uuid) to authenticated;

create policy "platform_roles_read_own_or_admin"
on public.platform_roles
for select
to authenticated
using (
  user_id = auth.uid()
  or public.has_platform_role(array['admin'])
);

create policy "role_nominations_read_relevant"
on public.role_nominations
for select
to authenticated
using (
  nominee_id = auth.uid()
  or nominated_by = auth.uid()
  or public.has_platform_role(array['senior_moderator', 'admin'])
);

create table if not exists public.library_terms_versions (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  title text not null,
  summary text not null,
  terms_text text not null,
  effective_at timestamptz not null default now(),
  is_current boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  constraint library_terms_version_length_check
  check (char_length(trim(version)) between 1 and 40),

  constraint library_terms_title_length_check
  check (char_length(trim(title)) between 3 and 160),

  constraint library_terms_summary_length_check
  check (char_length(trim(summary)) between 10 and 1000),

  constraint library_terms_text_length_check
  check (char_length(trim(terms_text)) between 100 and 20000)
);

create unique index if not exists
  library_terms_one_current_version_idx
on public.library_terms_versions(is_current)
where is_current = true;

create table if not exists public.library_terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_version_id uuid not null
    references public.library_terms_versions(id)
    on delete restrict,
  accepted_at timestamptz not null default now(),
  acceptance_source text not null default 'library_gate',
  user_agent text,
  created_at timestamptz not null default now(),

  constraint library_terms_acceptance_unique
  unique (user_id, terms_version_id),

  constraint library_terms_acceptance_source_check
  check (
    acceptance_source in (
      'library_gate',
      'administrative_record'
    )
  ),

  constraint library_terms_user_agent_length_check
  check (
    user_agent is null
    or char_length(user_agent) <= 1000
  )
);

create index if not exists
  library_terms_acceptances_user_idx
on public.library_terms_acceptances(
  user_id,
  accepted_at desc
);

insert into public.library_terms_versions (
  version,
  title,
  summary,
  terms_text,
  effective_at,
  is_current
)
values (
  '1.0',
  'FieldsConnect Library Terms of Use',
  'These terms govern the uploading, accessing, sharing, reporting and removal of resources within the FieldsConnect Library.',
  $terms$
1. Purpose and scope

The FieldsConnect Library enables users to upload, publish, share and access educational, professional and community resources. Use of the Library is subject to these Library Terms, the general FieldsConnect Terms of Use and applicable law.

2. Ownership and permission

By uploading a resource, you confirm that you own the material or have valid permission to upload and share it. You must not upload material that infringes copyright, trademarks, confidential information, privacy rights or other intellectual-property rights.

3. Personal and confidential information

You must not upload personal information, confidential business information, private records or sensitive material unless you have lawful authority and appropriate permission to do so. Users remain responsible for removing unnecessary personal information before uploading resources.

4. Prohibited material

You must not upload unlawful, harmful, fraudulent, deceptive, abusive, discriminatory, malicious or otherwise prohibited content. Files containing malware, harmful scripts, stolen information or material intended to compromise another person or system are prohibited.

5. Visibility and sharing

You are responsible for selecting the appropriate visibility setting. Public resources may be accessed by authenticated FieldsConnect users. Connections-only resources are intended only for accepted connections, subject to platform controls.

6. Moderation and removal

FieldsConnect may review, restrict, unpublish, redact or remove resources that are reported, unlawful, unsafe, infringing, confidential or inconsistent with these terms. Relevant records may be retained for moderation, security, legal or audit purposes.

7. Reporting

Users should report resources that may violate these terms. Reports must be submitted honestly and must not be used to harass users or misuse the moderation process.

8. Security and access

Library links may be temporary and access-controlled. Users must not bypass access restrictions, redistribute protected download links or attempt to gain unauthorized access to Library resources.

9. User responsibility

The uploader remains responsible for the legality, accuracy, permissions and appropriate classification of uploaded resources. FieldsConnect does not guarantee the accuracy, completeness or suitability of user-uploaded material.

10. Acceptance and future updates

By accepting these terms, you agree to comply with the current Library Terms. When a materially updated version becomes effective, you may be required to review and accept the new version before continuing to use the Library.
$terms$,
  now(),
  true
)
on conflict (version) do update
set
  title = excluded.title,
  summary = excluded.summary,
  terms_text = excluded.terms_text,
  effective_at = excluded.effective_at,
  is_current = excluded.is_current;

update public.library_terms_versions
set is_current = false
where version <> '1.0'
  and is_current = true;

create or replace function public.get_current_library_terms()
returns table (
  id uuid,
  version text,
  title text,
  summary text,
  terms_text text,
  effective_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    terms.id,
    terms.version,
    terms.title,
    terms.summary,
    terms.terms_text,
    terms.effective_at
  from public.library_terms_versions terms
  where terms.is_current = true
    and terms.effective_at <= now()
  order by terms.effective_at desc
  limit 1;
$$;

create or replace function public.has_accepted_current_library_terms(
  candidate uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    candidate is not null
    and exists (
      select 1
      from public.library_terms_versions terms
      join public.library_terms_acceptances acceptance
        on acceptance.terms_version_id = terms.id
      where terms.is_current = true
        and terms.effective_at <= now()
        and acceptance.user_id = candidate
    );
$$;

create or replace function public.accept_current_library_terms(
  client_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_terms_id uuid;
  acceptance_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if char_length(coalesce(client_user_agent, '')) > 1000 then
    raise exception 'User-agent metadata is too long';
  end if;

  select terms.id
  into current_terms_id
  from public.library_terms_versions terms
  where terms.is_current = true
    and terms.effective_at <= now()
  order by terms.effective_at desc
  limit 1;

  if current_terms_id is null then
    raise exception 'No current Library Terms version is available';
  end if;

  insert into public.library_terms_acceptances (
    user_id,
    terms_version_id,
    acceptance_source,
    user_agent
  )
  values (
    auth.uid(),
    current_terms_id,
    'library_gate',
    nullif(trim(coalesce(client_user_agent, '')), '')
  )
  on conflict (
    user_id,
    terms_version_id
  )
  do update
  set user_agent = coalesce(
    excluded.user_agent,
    public.library_terms_acceptances.user_agent
  )
  returning id into acceptance_id;

  return acceptance_id;
end;
$$;

alter table public.library_terms_versions
enable row level security;

alter table public.library_terms_acceptances
enable row level security;

revoke all on table public.library_terms_versions
from anon, authenticated;

revoke all on table public.library_terms_acceptances
from anon, authenticated;

grant select on table public.library_terms_versions
to authenticated;

grant select on table public.library_terms_acceptances
to authenticated;

drop policy if exists
  "library_terms_versions_authenticated_read"
on public.library_terms_versions;

create policy
  "library_terms_versions_authenticated_read"
on public.library_terms_versions
for select
to authenticated
using (
  effective_at <= now()
);

drop policy if exists
  "library_terms_acceptances_read_own"
on public.library_terms_acceptances;

create policy
  "library_terms_acceptances_read_own"
on public.library_terms_acceptances
for select
to authenticated
using (
  user_id = auth.uid()
  or public.has_platform_role(array['admin'])
);

revoke all on function
  public.get_current_library_terms()
from public, anon;

revoke all on function
  public.has_accepted_current_library_terms(uuid)
from public, anon;

revoke all on function
  public.accept_current_library_terms(text)
from public, anon;

grant execute on function
  public.get_current_library_terms()
to authenticated;

grant execute on function
  public.has_accepted_current_library_terms(uuid)
to authenticated;

grant execute on function
  public.accept_current_library_terms(text)
to authenticated;

notify pgrst, 'reload schema';
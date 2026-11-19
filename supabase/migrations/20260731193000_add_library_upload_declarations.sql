-- ============================================================
-- Library uploader declarations and basic audit trail
-- ============================================================

create table if not exists public.library_document_declarations (
  document_id uuid primary key
    references public.library_documents(id)
    on delete cascade,

  uploader_id uuid not null
    references auth.users(id)
    on delete cascade,

  rights_basis text not null,

  source_attribution text,
  licence_permission_details text,
  statutory_exception_explanation text,

  privacy_confirmed boolean not null default false,
  security_confirmed boolean not null default false,
  accuracy_confirmed boolean not null default false,

  terms_version_id uuid not null
    references public.library_terms_versions(id)
    on delete restrict,

  declared_at timestamptz not null default now(),

  constraint library_declaration_rights_basis_check
  check (
    rights_basis in (
      'original_owner',
      'written_permission',
      'public_domain',
      'open_licence',
      'statutory_exception'
    )
  ),

  constraint library_declaration_source_length_check
  check (
    source_attribution is null
    or char_length(source_attribution) <= 2000
  ),

  constraint library_declaration_permission_length_check
  check (
    licence_permission_details is null
    or char_length(licence_permission_details) <= 4000
  ),

  constraint library_declaration_exception_length_check
  check (
    statutory_exception_explanation is null
    or char_length(statutory_exception_explanation) <= 4000
  )
);

create index if not exists
  library_document_declarations_uploader_idx
on public.library_document_declarations(
  uploader_id,
  declared_at desc
);

create table if not exists public.library_audit_events (
  id uuid primary key default gen_random_uuid(),

  document_id uuid
    references public.library_documents(id)
    on delete set null,

  actor_id uuid
    references auth.users(id)
    on delete set null,

  event_type text not null,
  reason_category text,
  notes text,

  previous_status text,
  new_status text,

  terms_version_id uuid
    references public.library_terms_versions(id)
    on delete set null,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  constraint library_audit_event_type_length_check
  check (
    char_length(trim(event_type)) between 3 and 100
  ),

  constraint library_audit_reason_length_check
  check (
    reason_category is null
    or char_length(reason_category) <= 160
  ),

  constraint library_audit_notes_length_check
  check (
    notes is null
    or char_length(notes) <= 2000
  )
);

create index if not exists
  library_audit_events_document_idx
on public.library_audit_events(
  document_id,
  created_at desc
);

create index if not exists
  library_audit_events_actor_idx
on public.library_audit_events(
  actor_id,
  created_at desc
);

-- ============================================================
-- Prevent unverified direct document inserts
-- ============================================================

create or replace function public.enforce_library_compliant_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(
    current_setting(
      'app.library_compliant_insert',
      true
    ),
    ''
  ) <> 'enabled'
  then
    raise exception
      'Library documents must be created through the controlled upload process';
  end if;

  return new;
end;
$$;

drop trigger if exists
  enforce_library_compliant_insert_trigger
on public.library_documents;

create trigger
  enforce_library_compliant_insert_trigger
before insert on public.library_documents
for each row
execute function public.enforce_library_compliant_insert();

-- ============================================================
-- Controlled document creation with declaration
-- ============================================================

create or replace function public.create_library_document_with_declaration(
  document_title text,
  document_description text,
  original_file_name text,
  document_file_size_bytes bigint,
  document_mime_type text,
  document_storage_bucket text,
  document_storage_path text,
  document_visibility text,
  publish_now boolean,

  declared_rights_basis text,
  declared_source_attribution text default null,
  declared_licence_permission_details text default null,
  declared_statutory_exception_explanation text default null,

  declared_privacy_confirmed boolean default false,
  declared_security_confirmed boolean default false,
  declared_accuracy_confirmed boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_terms_id uuid;
  created_document_id uuid;
  effective_publish boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.has_accepted_current_library_terms(
    auth.uid()
  ) then
    raise exception
      'You must accept the current Library Terms before uploading';
  end if;

  if char_length(
    trim(coalesce(document_title, ''))
  ) < 3 then
    raise exception
      'A document title of at least 3 characters is required';
  end if;

  if char_length(trim(document_title)) > 200 then
    raise exception
      'The document title may not exceed 200 characters';
  end if;

  if char_length(
    coalesce(document_description, '')
  ) > 4000 then
    raise exception
      'The document description may not exceed 4000 characters';
  end if;

  if char_length(
    trim(coalesce(original_file_name, ''))
  ) < 1 then
    raise exception 'A file name is required';
  end if;

  if document_file_size_bytes <= 0
    or document_file_size_bytes > 8388608
  then
    raise exception
      'The file must be larger than zero and no greater than 8 MB';
  end if;

  if document_storage_bucket <> 'library-documents' then
    raise exception 'Invalid Library storage bucket';
  end if;

  if document_storage_path not like
    auth.uid()::text || '/%'
  then
    raise exception
      'The storage path does not belong to the authenticated uploader';
  end if;

  if document_visibility not in (
    'public',
    'connections'
  ) then
    raise exception 'Invalid document visibility';
  end if;

  if declared_rights_basis not in (
    'original_owner',
    'written_permission',
    'public_domain',
    'open_licence',
    'statutory_exception'
  ) then
    raise exception 'Select a valid rights basis';
  end if;

  if declared_rights_basis <> 'original_owner'
    and char_length(
      trim(
        coalesce(
          declared_source_attribution,
          ''
        )
      )
    ) < 3
  then
    raise exception
      'Source and attribution are required for this rights basis';
  end if;

  if declared_rights_basis in (
    'written_permission',
    'open_licence'
  )
    and char_length(
      trim(
        coalesce(
          declared_licence_permission_details,
          ''
        )
      )
    ) < 3
  then
    raise exception
      'Licence or permission details are required for this rights basis';
  end if;

  if declared_rights_basis =
    'statutory_exception'
    and char_length(
      trim(
        coalesce(
          declared_statutory_exception_explanation,
          ''
        )
      )
    ) < 10
  then
    raise exception
      'Explain the legal exception relied upon';
  end if;

  if not declared_privacy_confirmed then
    raise exception
      'The privacy and confidentiality declaration is required';
  end if;

  if not declared_security_confirmed then
    raise exception
      'The security declaration is required';
  end if;

  if not declared_accuracy_confirmed then
    raise exception
      'The truth and accuracy declaration is required';
  end if;

  select terms.id
  into current_terms_id
  from public.library_terms_versions terms
  where terms.is_current = true
    and terms.effective_at <= now()
  order by terms.effective_at desc
  limit 1;

  if current_terms_id is null then
    raise exception
      'No current Library Terms version is available';
  end if;

  -- Material relying on a statutory exception must not be
  -- automatically published.
  effective_publish :=
    coalesce(publish_now, false)
    and declared_rights_basis <>
      'statutory_exception';

  perform set_config(
    'app.library_compliant_insert',
    'enabled',
    true
  );

  insert into public.library_documents (
    owner_id,
    title,
    description,
    file_name,
    file_size_bytes,
    mime_type,
    storage_bucket,
    storage_path,
    visibility,
    is_published
  )
  values (
    auth.uid(),
    trim(document_title),
    nullif(
      trim(coalesce(document_description, '')),
      ''
    ),
    trim(original_file_name),
    document_file_size_bytes,
    coalesce(
      nullif(trim(document_mime_type), ''),
      'application/octet-stream'
    ),
    document_storage_bucket,
    document_storage_path,
    document_visibility,
    effective_publish
  )
  returning id into created_document_id;

  insert into public.library_document_declarations (
    document_id,
    uploader_id,
    rights_basis,
    source_attribution,
    licence_permission_details,
    statutory_exception_explanation,
    privacy_confirmed,
    security_confirmed,
    accuracy_confirmed,
    terms_version_id
  )
  values (
    created_document_id,
    auth.uid(),
    declared_rights_basis,
    nullif(
      trim(
        coalesce(
          declared_source_attribution,
          ''
        )
      ),
      ''
    ),
    nullif(
      trim(
        coalesce(
          declared_licence_permission_details,
          ''
        )
      ),
      ''
    ),
    nullif(
      trim(
        coalesce(
          declared_statutory_exception_explanation,
          ''
        )
      ),
      ''
    ),
    declared_privacy_confirmed,
    declared_security_confirmed,
    declared_accuracy_confirmed,
    current_terms_id
  );

  insert into public.library_audit_events (
    document_id,
    actor_id,
    event_type,
    reason_category,
    notes,
    new_status,
    terms_version_id,
    metadata
  )
  values
  (
    created_document_id,
    auth.uid(),
    'upload_declared',
    declared_rights_basis,
    'Uploader completed the required rights, privacy, security and accuracy declarations.',
    'declared',
    current_terms_id,
    jsonb_build_object(
      'visibility',
      document_visibility,
      'publish_requested',
      coalesce(publish_now, false)
    )
  ),
  (
    created_document_id,
    auth.uid(),
    'document_uploaded',
    declared_rights_basis,
    'Document metadata was created through the controlled Library upload process.',
    case
      when effective_publish then 'published'
      else 'unpublished'
    end,
    current_terms_id,
    jsonb_build_object(
      'file_name',
      original_file_name,
      'file_size_bytes',
      document_file_size_bytes,
      'mime_type',
      document_mime_type
    )
  );

  return created_document_id;
end;
$$;

-- ============================================================
-- RLS and permissions
-- ============================================================

alter table public.library_document_declarations
enable row level security;

alter table public.library_audit_events
enable row level security;

revoke all on table
  public.library_document_declarations
from anon, authenticated;

revoke all on table
  public.library_audit_events
from anon, authenticated;

grant select on table
  public.library_document_declarations
to authenticated;

grant select on table
  public.library_audit_events
to authenticated;

drop policy if exists
  "library_declarations_read_relevant"
on public.library_document_declarations;

create policy
  "library_declarations_read_relevant"
on public.library_document_declarations
for select
to authenticated
using (
  uploader_id = auth.uid()
  or public.has_platform_role(
    array[
      'admin',
      'moderator',
      'senior_moderator'
    ]
  )
);

drop policy if exists
  "library_audit_events_read_relevant"
on public.library_audit_events;

create policy
  "library_audit_events_read_relevant"
on public.library_audit_events
for select
to authenticated
using (
  actor_id = auth.uid()
  or exists (
    select 1
    from public.library_documents document
    where document.id =
      library_audit_events.document_id
      and document.owner_id = auth.uid()
  )
  or public.has_platform_role(
    array[
      'admin',
      'moderator',
      'senior_moderator'
    ]
  )
);

revoke all on function
  public.enforce_library_compliant_insert()
from public, anon, authenticated;

revoke all on function
  public.create_library_document_with_declaration(
    text,
    text,
    text,
    bigint,
    text,
    text,
    text,
    text,
    boolean,
    text,
    text,
    text,
    text,
    boolean,
    boolean,
    boolean
  )
from public, anon;

grant execute on function
  public.create_library_document_with_declaration(
    text,
    text,
    text,
    bigint,
    text,
    text,
    text,
    text,
    boolean,
    text,
    text,
    text,
    text,
    boolean,
    boolean,
    boolean
  )
to authenticated;

notify pgrst, 'reload schema';
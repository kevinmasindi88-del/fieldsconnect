-- ============================================================
-- FieldsConnect Library: externally hosted link resources
-- ============================================================

-- Align the underlying Library title constraint with the upload and
-- online-link creation functions, which accept titles from 3 to 200 characters.
do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select
      constraint_row.conname
    from pg_constraint constraint_row
    join pg_class table_row
      on table_row.oid = constraint_row.conrelid
    join pg_namespace schema_row
      on schema_row.oid = table_row.relnamespace
    where schema_row.nspname = 'public'
      and table_row.relname = 'library_documents'
      and constraint_row.contype = 'c'
      and pg_get_constraintdef(constraint_row.oid)
        ilike '%char_length(title)%'
  loop
    execute format(
      'alter table public.library_documents drop constraint %I',
      constraint_record.conname
    );
  end loop;
end;
$$;

alter table public.library_documents
  add constraint library_documents_title_length_check
  check (char_length(trim(title)) between 3 and 200);
alter table public.library_documents
  add column if not exists resource_type text
  not null default 'uploaded_file';

alter table public.library_documents
  add column if not exists external_url text;

alter table public.library_documents
  add column if not exists source_title text;

alter table public.library_documents
  add column if not exists source_publisher text;

alter table public.library_documents
  add column if not exists source_accessed_on date;

alter table public.library_documents
  add column if not exists link_access_confirmed boolean
  not null default false;

alter table public.library_documents
  alter column file_name drop not null;

alter table public.library_documents
  alter column file_size_bytes drop not null;

alter table public.library_documents
  alter column mime_type drop not null;

alter table public.library_documents
  alter column storage_bucket drop not null;

alter table public.library_documents
  alter column storage_path drop not null;

alter table public.library_documents
  drop constraint if exists
  library_documents_resource_type_check;

alter table public.library_documents
  add constraint library_documents_resource_type_check
  check (
    resource_type in (
      'uploaded_file',
      'external_link'
    )
  );

alter table public.library_documents
  drop constraint if exists
  library_documents_resource_payload_check;

alter table public.library_documents
  add constraint library_documents_resource_payload_check
  check (
    (
      resource_type = 'uploaded_file'
      and file_name is not null
      and file_size_bytes is not null
      and file_size_bytes > 0
      and file_size_bytes <= 8388608
      and storage_bucket is not null
      and storage_path is not null
      and external_url is null
    )
    or
    (
      resource_type = 'external_link'
      and external_url is not null
      and source_title is not null
      and source_publisher is not null
      and source_accessed_on is not null
      and link_access_confirmed = true
      and file_name is null
      and file_size_bytes is null
      and mime_type is null
      and storage_bucket is null
      and storage_path is null
    )
  );

alter table public.library_documents
  drop constraint if exists
  library_documents_external_url_length_check;

alter table public.library_documents
  add constraint library_documents_external_url_length_check
  check (
    external_url is null
    or char_length(external_url) <= 2048
  );

alter table public.library_documents
  drop constraint if exists
  library_documents_source_title_length_check;

alter table public.library_documents
  add constraint library_documents_source_title_length_check
  check (
    source_title is null
    or char_length(source_title) <= 300
  );

alter table public.library_documents
  drop constraint if exists
  library_documents_source_publisher_length_check;

alter table public.library_documents
  add constraint library_documents_source_publisher_length_check
  check (
    source_publisher is null
    or char_length(source_publisher) <= 300
  );

-- Add external links as a valid declaration basis.

alter table public.library_document_declarations
  drop constraint if exists
  library_declaration_rights_basis_check;

alter table public.library_document_declarations
  add constraint library_declaration_rights_basis_check
  check (
    rights_basis in (
      'original_owner',
      'written_permission',
      'public_domain',
      'open_licence',
      'statutory_exception',
      'external_link'
    )
  );

-- ============================================================
-- Controlled creation of externally hosted resources
-- ============================================================

create or replace function public.create_library_external_link(
  resource_title text,
  resource_description text,
  resource_external_url text,
  resource_source_title text,
  resource_source_publisher text,
  resource_visibility text,
  publish_now boolean,
  no_access_restriction_bypass_confirmed boolean,
  privacy_confirmed boolean,
  accuracy_confirmed boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_terms_id uuid;
  created_document_id uuid;
  cleaned_url text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.has_accepted_current_library_terms(
    auth.uid()
  ) then
    raise exception
      'You must accept the current Library Terms before sharing a resource';
  end if;

  if char_length(
    trim(coalesce(resource_title, ''))
  ) < 3 then
    raise exception
      'A resource title of at least 3 characters is required';
  end if;

  if char_length(trim(resource_title)) > 200 then
    raise exception
      'The resource title may not exceed 200 characters';
  end if;

  if char_length(
    coalesce(resource_description, '')
  ) > 4000 then
    raise exception
      'The resource description may not exceed 4000 characters';
  end if;

  cleaned_url := trim(
    coalesce(resource_external_url, '')
  );

  if char_length(cleaned_url) < 12
    or char_length(cleaned_url) > 2048
  then
    raise exception
      'Enter a valid external resource URL';
  end if;

  if cleaned_url !~* '^https://[^[:space:]]+$' then
    raise exception
      'Only secure HTTPS links may be shared';
  end if;

  if cleaned_url ~* '^https://[^/]*@' then
    raise exception
      'URLs containing embedded usernames or passwords are not allowed';
  end if;

  if char_length(
    trim(coalesce(resource_source_title, ''))
  ) < 3 then
    raise exception
      'The original page or resource title is required';
  end if;

  if char_length(
    trim(coalesce(resource_source_publisher, ''))
  ) < 2 then
    raise exception
      'The author, organisation or publisher is required';
  end if;

  if resource_visibility not in (
    'public',
    'connections'
  ) then
    raise exception 'Invalid resource visibility';
  end if;

  if not no_access_restriction_bypass_confirmed then
    raise exception
      'Confirm that the link does not bypass a login, paywall or technical access restriction';
  end if;

  if not privacy_confirmed then
    raise exception
      'The privacy and confidentiality declaration is required';
  end if;

  if not accuracy_confirmed then
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

  perform set_config(
    'app.library_compliant_insert',
    'enabled',
    true
  );

  insert into public.library_documents (
    owner_id,
    title,
    description,
    resource_type,
    external_url,
    source_title,
    source_publisher,
    source_accessed_on,
    link_access_confirmed,
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
    trim(resource_title),
    nullif(
      trim(coalesce(resource_description, '')),
      ''
    ),
    'external_link',
    cleaned_url,
    trim(resource_source_title),
    trim(resource_source_publisher),
    current_date,
    true,
    null,
    null,
    null,
    null,
    null,
    resource_visibility,
    coalesce(publish_now, false)
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
    'external_link',
    trim(resource_source_publisher)
      || ' â€” '
      || trim(resource_source_title)
      || ' â€” '
      || cleaned_url,
    null,
    null,
    privacy_confirmed,
    true,
    accuracy_confirmed,
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
  values (
    created_document_id,
    auth.uid(),
    'external_link_shared',
    'external_link',
    'The user shared a link to the original online source without uploading a copy.',
    case
      when coalesce(publish_now, false)
        then 'published'
      else 'unpublished'
    end,
    current_terms_id,
    jsonb_build_object(
      'external_url',
      cleaned_url,
      'source_title',
      trim(resource_source_title),
      'source_publisher',
      trim(resource_source_publisher),
      'accessed_on',
      current_date,
      'access_restriction_bypass_confirmed',
      no_access_restriction_bypass_confirmed,
      'visibility',
      resource_visibility
    )
  );

  return created_document_id;
end;
$$;

revoke all on function
  public.create_library_external_link(
    text,
    text,
    text,
    text,
    text,
    text,
    boolean,
    boolean,
    boolean,
    boolean
  )
from public, anon;

grant execute on function
  public.create_library_external_link(
    text,
    text,
    text,
    text,
    text,
    text,
    boolean,
    boolean,
    boolean,
    boolean
  )
to authenticated;

notify pgrst, 'reload schema';

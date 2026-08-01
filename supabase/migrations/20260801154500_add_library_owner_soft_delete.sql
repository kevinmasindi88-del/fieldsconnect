-- Preserve Library declarations and audit history when an owner removes a resource.

begin;

create or replace function public.soft_delete_own_library_document(
  target_document_id uuid
)
returns table (
  resource_type text,
  storage_bucket text,
  storage_path text
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  target_document public.library_documents%rowtype;
  deletion_time timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
  into target_document
  from public.library_documents
  where id = target_document_id
  for update;

  if not found then
    raise exception 'Library resource not found';
  end if;

  if target_document.owner_id <> auth.uid() then
    raise exception 'You may only delete your own Library resources';
  end if;

  if target_document.deleted_at is not null then
    raise exception 'Library resource has already been deleted';
  end if;

  update public.library_documents
  set
    deleted_at = deletion_time,
    is_published = false,
    updated_at = deletion_time
  where id = target_document.id;

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
    target_document.id,
    auth.uid(),
    'owner_deleted',
    'owner_request',
    'The resource owner removed the Library resource.',
    'deleted',
    (
      select declaration.terms_version_id
      from public.library_document_declarations declaration
      where declaration.document_id = target_document.id
    ),
    jsonb_build_object(
      'resource_type', target_document.resource_type,
      'previous_visibility', target_document.visibility,
      'previous_published_status', target_document.is_published,
      'deleted_at', deletion_time
    )
  );

  return query
  select
    target_document.resource_type,
    target_document.storage_bucket,
    target_document.storage_path;
end;
$function$;

revoke all
on function public.soft_delete_own_library_document(uuid)
from public, anon;

grant execute
on function public.soft_delete_own_library_document(uuid)
to authenticated;

drop policy if exists "library_documents_delete_own"
on public.library_documents;

commit;
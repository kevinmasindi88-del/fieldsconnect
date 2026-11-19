-- Privacy hardening: a user's Library Terms acceptance is private.
-- Preserve RPC signature (including the optional candidate argument) for
-- existing clients while preventing callers from checking other accounts.
create or replace function public.has_accepted_current_library_terms(
  candidate uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    (select auth.uid()) is not null
    and candidate = (select auth.uid())
    and exists (
      select 1
      from public.library_terms_versions terms
      join public.library_terms_acceptances acceptance
        on acceptance.terms_version_id = terms.id
      where terms.is_current = true
        and terms.effective_at <= now()
        and acceptance.user_id = (select auth.uid())
    );
$function$;

revoke all on function public.has_accepted_current_library_terms(uuid)
  from public, anon;
grant execute on function public.has_accepted_current_library_terms(uuid)
  to authenticated;

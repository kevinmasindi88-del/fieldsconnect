-- Records a versioned attestation at account creation and protects it from
-- later user_metadata edits. This is not proof of age or guardian consent.
create table public.user_legal_agreements (
  user_id uuid not null references auth.users(id) on delete cascade,
  agreement_version text not null check (agreement_version = '2026-10-24-v1'),
  accepted_at timestamptz not null default now(),
  source text not null check (source in ('signup', 'onboarding')),
  primary key (user_id, agreement_version)
);
alter table public.user_legal_agreements enable row level security;
create policy user_legal_agreements_select_own
  on public.user_legal_agreements
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.user_legal_agreements from public, anon, authenticated;
grant select on public.user_legal_agreements to authenticated;

create function public.capture_fc_signup_agreement_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.raw_user_meta_data ->> 'fc_agreement_version' = '2026-10-24-v1'
     and new.raw_user_meta_data ->> 'fc_agreement_accepted' = 'true' then
    insert into public.user_legal_agreements(user_id, agreement_version, source)
      values (new.id, '2026-10-24-v1', 'signup')
      on conflict do nothing;
  end if;
  return new;
end;
$function$;
revoke all on function public.capture_fc_signup_agreement_v1() from public, anon, authenticated;
create trigger auth_users_capture_fc_signup_agreement_v1
  after insert on auth.users
  for each row execute function public.capture_fc_signup_agreement_v1();

create function public.accept_fc_legal_agreement_v1()
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  acting_user uuid := (select auth.uid());
begin
  if acting_user is null then
    raise exception 'An authenticated user is required';
  end if;
  insert into public.user_legal_agreements(user_id, agreement_version, source)
    values (acting_user, '2026-10-24-v1', 'onboarding')
    on conflict do nothing;
end;
$function$;
revoke all on function public.accept_fc_legal_agreement_v1() from public, anon, authenticated;
grant execute on function public.accept_fc_legal_agreement_v1() to authenticated;

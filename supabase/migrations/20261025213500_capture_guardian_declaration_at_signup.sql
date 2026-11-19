-- Retain the three guardian details and the express approval submitted
-- during the same signup form. This is a self-declaration, not proof that
-- someone independently verified the guardian's identity.
create table public.fc_guardian_declarations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  guardian_name text not null check (char_length(trim(guardian_name)) between 2 and 120),
  guardian_date_of_birth date not null,
  guardian_email text not null check (char_length(trim(guardian_email)) between 5 and 254),
  approval_declared boolean not null check (approval_declared = true),
  policy_version text not null,
  declared_at timestamptz not null default now()
);
alter table public.fc_guardian_declarations enable row level security;

-- Database administrators can audit this record. Do not expose a guardian's
-- DOB or contact information through user profiles, normal client APIs or RLS.
revoke all on table public.fc_guardian_declarations from public, anon, authenticated;

create function public.capture_fc_guardian_declaration_at_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  supplied jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  adult_date date;
  adult_name text;
  adult_email text;
begin
  if supplied ->> 'fc_age_18_plus_declared' = 'false' then
    adult_name := btrim(coalesce(supplied ->> 'fc_guardian_name', ''));
    adult_email := lower(btrim(coalesce(supplied ->> 'fc_guardian_email', '')));

    if supplied ->> 'fc_guardian_approved' is distinct from 'true'
      or char_length(adult_name) not between 2 and 120
      or char_length(adult_email) not between 5 and 254
      or adult_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
      or coalesce(supplied ->> 'fc_guardian_dob', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    then
      raise exception 'Valid guardian details and approval are required';
    end if;

    adult_date := (supplied ->> 'fc_guardian_dob')::date;
    if adult_date > (current_date - interval '18 years')::date then
      raise exception 'Parent or guardian must be 18 or older';
    end if;

    insert into public.fc_guardian_declarations (
      user_id, guardian_name, guardian_date_of_birth,
      guardian_email, approval_declared, policy_version
    ) values (
      new.id, adult_name, adult_date,
      adult_email, true,
      coalesce(nullif(supplied ->> 'fc_agreement_version', ''), '2026-10-24-v1')
    );

    -- Keep guardian details in the private immutable signup declaration
    -- rather than leaving DOB/email in editable user metadata.
    update auth.users
    set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
      - 'fc_guardian_name'
      - 'fc_guardian_dob'
      - 'fc_guardian_email'
      - 'fc_guardian_approved'
    where id = new.id;
  end if;
  return new;
end;
$function$;

revoke all on function public.capture_fc_guardian_declaration_at_signup()
  from public, anon, authenticated;

create trigger auth_users_capture_fc_guardian_declaration
after insert on auth.users
for each row execute function public.capture_fc_guardian_declaration_at_signup();

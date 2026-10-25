-- Optional guardian contact: a parent or guardian may supply a phone
-- number instead of an email address during under-18 signup.
-- Backward-compatible with existing email-based guardian declarations.
alter table public.fc_guardian_declarations
  alter column guardian_email drop not null;

alter table public.fc_guardian_declarations
  add column guardian_phone text;

alter table public.fc_guardian_declarations
  add constraint fc_guardian_declarations_contact_required
    check (guardian_email is not null or guardian_phone is not null),
  add constraint fc_guardian_declarations_phone_valid
    check (
      guardian_phone is null or
      guardian_phone ~ '^([+][1-9][0-9]{6,14}|0[0-9]{9})$'
    );

create or replace function public.capture_fc_guardian_declaration_at_signup()
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
  adult_phone text;
begin
  if supplied ->> 'fc_age_18_plus_declared' = 'false' then
    adult_name := btrim(coalesce(supplied ->> 'fc_guardian_name', ''));
    adult_email := nullif(lower(btrim(coalesce(supplied ->> 'fc_guardian_email', ''))), '');
    adult_phone := nullif(
      regexp_replace(btrim(coalesce(supplied ->> 'fc_guardian_phone', '')),
                     '[[:space:]().-]', '', 'g'), '');

    if supplied ->> 'fc_guardian_approved' is distinct from 'true'
      or char_length(adult_name) not between 2 and 120
      or (adult_email is null and adult_phone is null)
      or (adult_email is not null and
            (char_length(adult_email) not between 5 and 254 or
             adult_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'))
      or (adult_phone is not null and
            adult_phone !~ '^([+][1-9][0-9]{6,14}|0[0-9]{9})$')
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
      guardian_email, guardian_phone, approval_declared, policy_version
    ) values (
      new.id, adult_name, adult_date,
      adult_email, adult_phone, true,
      coalesce(nullif(supplied ->> 'fc_agreement_version', ''), '2026-10-24-v1')
    );

    -- Avoid retaining guardian DOB and contact details in editable auth metadata.
    update auth.users
    set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
      - 'fc_guardian_name'
      - 'fc_guardian_dob'
      - 'fc_guardian_email'
      - 'fc_guardian_phone'
      - 'fc_guardian_approved'
    where id = new.id;
  end if;
  return new;
end;
$function$;

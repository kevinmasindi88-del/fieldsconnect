-- Signup should not assign an invented education/career identity.
-- A new private profile can be provisioned after verified sign-in, and the user
-- can select student, professional or institution later in Profile settings.
alter table public.profiles
  alter column role_type drop not null;

comment on column public.profiles.role_type is
  'User-selected account category. NULL means not selected yet, and must not be exposed as a fabricated student or professional identity.';

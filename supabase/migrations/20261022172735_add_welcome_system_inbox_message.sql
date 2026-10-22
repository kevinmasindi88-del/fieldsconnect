begin;

create table if not exists public.system_inbox_messages (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null
    references public.profiles(id)
    on delete cascade,
  message_type text not null,
  sender_label text not null default 'FC Team',
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint system_inbox_messages_recipient_type_key
    unique (recipient_id, message_type)
);

create index if not exists system_inbox_messages_recipient_created_idx
  on public.system_inbox_messages (
    recipient_id,
    created_at desc
  );

alter table public.system_inbox_messages
  enable row level security;

drop policy if exists "system_inbox_messages_select_own"
  on public.system_inbox_messages;

create policy "system_inbox_messages_select_own"
on public.system_inbox_messages
for select
to authenticated
using (recipient_id = auth.uid());

revoke all
on table public.system_inbox_messages
from anon, authenticated;

grant select
on table public.system_inbox_messages
to authenticated;

create or replace function public.create_welcome_system_inbox_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  recipient_name text;
begin
  if new.terms_accepted_at is null
     or new.privacy_accepted_at is null
     or new.community_guidelines_accepted_at is null
     or new.age_confirmed_at is null then
    return new;
  end if;

  if old.terms_accepted_at is not null
     and old.privacy_accepted_at is not null
     and old.community_guidelines_accepted_at is not null
     and old.age_confirmed_at is not null then
    return new;
  end if;

  recipient_name :=
    coalesce(
      nullif(trim(new.display_name), ''),
      'there'
    );

  insert into public.system_inbox_messages (
    recipient_id,
    message_type,
    sender_label,
    title,
    body
  )
  values (
    new.id,
    'welcome',
    'FC Team',
    'Welcome to FieldsConnect',
    'Welcome '
      || recipient_name
      || ' to FieldsConnect, a platform where you can connect with individuals across fields, share information, mentor, get mentored and build together.'
      || E'\n\n'
      || 'You can search members on the Connections page under "Find people" by name, field, level and more, and begin your journey of connection and collaboration.'
      || E'\n\n'
      || '- FC Team 🙂'
  )
  on conflict (recipient_id, message_type)
  do nothing;

  return new;
end;
$function$;

revoke all
on function public.create_welcome_system_inbox_message()
from public, anon, authenticated;

drop trigger if exists profiles_create_welcome_system_inbox_message
  on public.profiles;

create trigger profiles_create_welcome_system_inbox_message
after update of
  terms_accepted_at,
  privacy_accepted_at,
  community_guidelines_accepted_at,
  age_confirmed_at
on public.profiles
for each row
execute function public.create_welcome_system_inbox_message();

commit;

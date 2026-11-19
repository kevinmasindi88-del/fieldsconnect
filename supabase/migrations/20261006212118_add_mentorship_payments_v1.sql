-- FieldsConnect Mentorship Payments v1 foundation.
-- Adds mentor-controlled pricing, payment-policy snapshots, payout account references,
-- payment orders, participant-safe RLS, and the awaiting_payment request state.
-- Provider secrets and raw bank-account details must never be stored in these tables.

begin;

create table public.mentorship_payment_policies (
  version integer primary key,
  currency text not null default 'ZAR'
    check (currency = upper(currency) and char_length(currency) = 3),
  platform_fee_bps integer not null
    check (platform_fee_bps between 0 and 10000),
  processor_fee_bearer text not null default 'platform'
    check (processor_fee_bearer in ('platform')),
  payment_window_hours integer not null default 48
    check (payment_window_hours between 1 and 168),
  is_active boolean not null default false,
  effective_from timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index mentorship_payment_policies_one_active_idx
  on public.mentorship_payment_policies ((1))
  where is_active;

insert into public.mentorship_payment_policies (
  version,
  currency,
  platform_fee_bps,
  processor_fee_bearer,
  payment_window_hours,
  is_active
)
values (1, 'ZAR', 1500, 'platform', 48, true);

create table public.mentor_payment_accounts (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null unique
    references public.profiles(id)
    on delete cascade,
  provider text not null default 'paystack'
    check (provider in ('paystack')),
  provider_account_code text not null unique,
  status text not null default 'active'
    check (status in ('active', 'disabled', 'pending_verification')),
  display_name text,
  settlement_bank_name text,
  account_last4 text
    check (account_last4 is null or account_last4 ~ '^[0-9]{4}$'),
  can_receive_payments boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger mentor_payment_accounts_set_updated_at
before update on public.mentor_payment_accounts
for each row execute function public.set_updated_at();

create table public.mentorship_payment_offers (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null
    references public.profiles(id)
    on delete cascade,
  duration text not null
    check (
      duration in (
        '3_months',
        '6_months',
        '1_year',
        'ongoing'
      )
    ),
  payment_mode text not null default 'free'
    check (payment_mode in ('free', 'paid')),
  price_amount_minor integer not null default 0
    check (price_amount_minor >= 0),
  currency text not null default 'ZAR'
    check (currency = upper(currency) and char_length(currency) = 3),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mentor_id, duration),
  check (
    (payment_mode = 'free' and price_amount_minor = 0)
    or
    (payment_mode = 'paid' and price_amount_minor > 0)
  )
);

create index mentorship_payment_offers_mentor_idx
  on public.mentorship_payment_offers (
    mentor_id,
    is_active,
    duration
  );

create trigger mentorship_payment_offers_set_updated_at
before update on public.mentorship_payment_offers
for each row execute function public.set_updated_at();

alter table public.mentorship_payment_offers
  add constraint mentorship_payment_offers_ongoing_free_v1_check
  check (
    duration <> 'ongoing'
    or payment_mode = 'free'
  );

alter table public.mentorship_requests
  add column requested_offer_id uuid
    references public.mentorship_payment_offers(id)
    on delete set null,
  add column requested_payment_mode text not null default 'free'
    check (requested_payment_mode in ('free', 'paid')),
  add column requested_price_amount_minor integer not null default 0
    check (requested_price_amount_minor >= 0),
  add column requested_currency text not null default 'ZAR'
    check (
      requested_currency = upper(requested_currency)
      and char_length(requested_currency) = 3
    ),
  add column proposed_offer_id uuid
    references public.mentorship_payment_offers(id)
    on delete set null,
  add column proposed_payment_mode text
    check (
      proposed_payment_mode is null
      or proposed_payment_mode in ('free', 'paid')
    ),
  add column proposed_price_amount_minor integer
    check (
      proposed_price_amount_minor is null
      or proposed_price_amount_minor >= 0
    ),
  add column proposed_currency text
    check (
      proposed_currency is null
      or (
        proposed_currency = upper(proposed_currency)
        and char_length(proposed_currency) = 3
      )
    ),
  add column payment_due_at timestamptz;

alter table public.mentorship_requests
  add constraint mentorship_requests_requested_payment_terms_check
  check (
    (
      requested_payment_mode = 'free'
      and requested_price_amount_minor = 0
    )
    or
    (
      requested_payment_mode = 'paid'
      and requested_price_amount_minor > 0
    )
  );

alter table public.mentorship_requests
  add constraint mentorship_requests_proposed_payment_terms_check
  check (
    (
      proposed_payment_mode is null
      and proposed_price_amount_minor is null
      and proposed_currency is null
      and proposed_offer_id is null
    )
    or
    (
      proposed_payment_mode = 'free'
      and proposed_price_amount_minor = 0
      and proposed_currency is not null
    )
    or
    (
      proposed_payment_mode = 'paid'
      and proposed_price_amount_minor > 0
      and proposed_currency is not null
    )
  );

alter table public.mentorship_requests
  drop constraint mentorship_requests_status_check;

alter table public.mentorship_requests
  add constraint mentorship_requests_status_check
  check (
    status in (
      'pending',
      'change_proposed',
      'awaiting_payment',
      'accepted',
      'declined',
      'cancelled',
      'expired'
    )
  );

drop index public.mentorship_requests_one_open_pair_idx;

create unique index mentorship_requests_one_open_pair_idx
  on public.mentorship_requests (
    mentee_id,
    mentor_id
  )
  where status in (
    'pending',
    'change_proposed',
    'awaiting_payment'
  );

create table public.mentorship_payment_orders (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique
    references public.mentorship_requests(id)
    on delete restrict,
  mentorship_id uuid unique
    references public.mentorships(id)
    on delete restrict,
  mentor_id uuid not null
    references public.profiles(id)
    on delete restrict,
  mentee_id uuid not null
    references public.profiles(id)
    on delete restrict,
  payment_policy_version integer not null
    references public.mentorship_payment_policies(version)
    on delete restrict,
  currency text not null
    check (currency = upper(currency) and char_length(currency) = 3),
  gross_amount_minor integer not null
    check (gross_amount_minor > 0),
  platform_fee_bps integer not null
    check (platform_fee_bps between 0 and 10000),
  platform_fee_amount_minor integer not null
    check (platform_fee_amount_minor >= 0),
  mentor_allocation_amount_minor integer not null
    check (mentor_allocation_amount_minor >= 0),
  processor_fee_amount_minor integer
    check (
      processor_fee_amount_minor is null
      or processor_fee_amount_minor >= 0
    ),
  platform_net_amount_minor integer
    check (
      platform_net_amount_minor is null
      or platform_net_amount_minor >= 0
    ),
  provider text not null default 'paystack'
    check (provider in ('paystack')),
  provider_reference text unique,
  provider_transaction_id text unique,
  provider_channel text,
  status text not null default 'awaiting_payment'
    check (
      status in (
        'awaiting_payment',
        'paid',
        'failed',
        'expired',
        'cancelled',
        'refunded'
      )
    ),
  payment_expires_at timestamptz not null,
  paid_at timestamptz,
  failed_at timestamptz,
  cancelled_at timestamptz,
  refunded_at timestamptz,
  receipt_email_status text not null default 'not_queued'
    check (
      receipt_email_status in (
        'not_queued',
        'queued',
        'sent',
        'failed'
      )
    ),
  receipt_email_sent_at timestamptz,
  receipt_email_last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (mentor_id <> mentee_id),
  check (
    platform_fee_amount_minor
    + mentor_allocation_amount_minor
    = gross_amount_minor
  )
);

create index mentorship_payment_orders_mentor_idx
  on public.mentorship_payment_orders (
    mentor_id,
    status,
    created_at desc
  );

create index mentorship_payment_orders_mentee_idx
  on public.mentorship_payment_orders (
    mentee_id,
    status,
    created_at desc
  );

create index mentorship_payment_orders_pending_expiry_idx
  on public.mentorship_payment_orders (
    payment_expires_at
  )
  where status = 'awaiting_payment';

create trigger mentorship_payment_orders_set_updated_at
before update on public.mentorship_payment_orders
for each row execute function public.set_updated_at();

alter table public.mentorship_payment_policies enable row level security;
alter table public.mentor_payment_accounts enable row level security;
alter table public.mentorship_payment_offers enable row level security;
alter table public.mentorship_payment_orders enable row level security;

create policy mentorship_payment_policies_select_authenticated
on public.mentorship_payment_policies
for select
to authenticated
using (true);

create policy mentor_payment_accounts_select_own
on public.mentor_payment_accounts
for select
to authenticated
using ((select auth.uid()) = mentor_id);

create policy mentorship_payment_offers_select_authenticated
on public.mentorship_payment_offers
for select
to authenticated
using (true);

create policy mentorship_payment_offers_insert_own
on public.mentorship_payment_offers
for insert
to authenticated
with check ((select auth.uid()) = mentor_id);

create policy mentorship_payment_offers_update_own
on public.mentorship_payment_offers
for update
to authenticated
using ((select auth.uid()) = mentor_id)
with check ((select auth.uid()) = mentor_id);

create policy mentorship_payment_orders_select_participants
on public.mentorship_payment_orders
for select
to authenticated
using (
  (select auth.uid()) = mentor_id
  or (select auth.uid()) = mentee_id
);

revoke all on table public.mentorship_payment_policies
from public, anon, authenticated;
revoke all on table public.mentor_payment_accounts
from public, anon, authenticated;
revoke all on table public.mentorship_payment_offers
from public, anon, authenticated;
revoke all on table public.mentorship_payment_orders
from public, anon, authenticated;

grant select on table public.mentorship_payment_policies
to authenticated;
grant select on table public.mentor_payment_accounts
to authenticated;
grant select, insert, update
on table public.mentorship_payment_offers
to authenticated;
grant select on table public.mentorship_payment_orders
to authenticated;

grant all on table public.mentorship_payment_policies
to service_role;
grant all on table public.mentor_payment_accounts
to service_role;
grant all on table public.mentorship_payment_offers
to service_role;
grant all on table public.mentorship_payment_orders
to service_role;

do $assert$
declare
  active_policy_count integer;
  open_pair_index_definition text;
begin
  select count(*)::integer
  into active_policy_count
  from public.mentorship_payment_policies
  where is_active;

  if active_policy_count <> 1 then
    raise exception
      'Expected exactly one active mentorship payment policy, found %',
      active_policy_count;
  end if;

  select indexdef
  into open_pair_index_definition
  from pg_indexes
  where schemaname = 'public'
    and tablename = 'mentorship_requests'
    and indexname = 'mentorship_requests_one_open_pair_idx';

  if open_pair_index_definition is null
    or position(
      'awaiting_payment' in open_pair_index_definition
    ) = 0 then
    raise exception
      'Open mentorship request uniqueness must reserve awaiting-payment requests';
  end if;
end;
$assert$;

commit;

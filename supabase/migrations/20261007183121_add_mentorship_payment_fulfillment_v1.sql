-- FieldsConnect Mentorship Payments v1 fulfillment foundation.
-- Adds immutable paid-mentorship term snapshots, private Paystack checkout
-- initialization state, and service-role-only preparation/finalization RPCs.

begin;

-- ---------------------------------------------------------------------------
-- Paid order term snapshots and reconciliation state.
-- ---------------------------------------------------------------------------

alter table public.mentorship_payment_orders
  add column offer_id uuid
    references public.mentorship_payment_offers(id)
    on delete restrict,
  add column agreed_duration text,
  add column agreed_frequency text,
  add column mentorship_level text,
  add column mentorship_field text,
  add column objective text,
  add column payment_review_reason text;

alter table public.mentorship_payment_orders
  add constraint mentorship_payment_orders_agreed_duration_check
  check (
    agreed_duration in (
      '3_months',
      '6_months',
      '1_year'
    )
  );

alter table public.mentorship_payment_orders
  add constraint mentorship_payment_orders_agreed_frequency_check
  check (
    agreed_frequency in (
      'weekly',
      'fortnightly',
      'monthly',
      'flexible'
    )
  );

alter table public.mentorship_payment_orders
  add constraint mentorship_payment_orders_mentorship_level_check
  check (
    mentorship_level is not null
    and char_length(trim(mentorship_level)) > 0
  );

alter table public.mentorship_payment_orders
  add constraint mentorship_payment_orders_mentorship_field_check
  check (
    mentorship_field is not null
    and char_length(trim(mentorship_field)) > 0
  );

alter table public.mentorship_payment_orders
  add constraint mentorship_payment_orders_objective_check
  check (
    objective is not null
    and char_length(trim(objective)) > 0
  );

alter table public.mentorship_payment_orders
  drop constraint mentorship_payment_orders_status_check;

alter table public.mentorship_payment_orders
  add constraint mentorship_payment_orders_status_check
  check (
    status in (
      'awaiting_payment',
      'paid',
      'failed',
      'expired',
      'cancelled',
      'refunded',
      'review_required'
    )
  );

alter table public.mentorship_payment_orders
  add constraint mentorship_payment_orders_review_reason_check
  check (
    status <> 'review_required'
    or (
      payment_review_reason is not null
      and char_length(trim(payment_review_reason)) > 0
    )
  );

create or replace function
public.populate_mentorship_payment_order_terms()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  request_snapshot public.mentorship_requests%rowtype;
  snapshot_offer_id uuid;
  snapshot_duration text;
  snapshot_frequency text;
  snapshot_payment_mode text;
  snapshot_price_amount_minor integer;
  snapshot_currency text;
begin
  select *
  into request_snapshot
  from public.mentorship_requests
  where id = new.request_id;

  if not found then
    raise exception 'Mentorship request not found for payment order';
  end if;

  if request_snapshot.mentor_id <> new.mentor_id
    or request_snapshot.mentee_id <> new.mentee_id then
    raise exception
      'Payment order participants do not match the mentorship request';
  end if;

  if request_snapshot.status = 'change_proposed'
    and request_snapshot.proposed_payment_mode is not null then
    snapshot_offer_id := request_snapshot.proposed_offer_id;
    snapshot_duration := request_snapshot.proposed_duration;
    snapshot_frequency := request_snapshot.proposed_frequency;
    snapshot_payment_mode := request_snapshot.proposed_payment_mode;
    snapshot_price_amount_minor :=
      request_snapshot.proposed_price_amount_minor;
    snapshot_currency := request_snapshot.proposed_currency;
  else
    snapshot_offer_id := request_snapshot.requested_offer_id;
    snapshot_duration := request_snapshot.requested_duration;
    snapshot_frequency := request_snapshot.requested_frequency;
    snapshot_payment_mode := request_snapshot.requested_payment_mode;
    snapshot_price_amount_minor :=
      request_snapshot.requested_price_amount_minor;
    snapshot_currency := request_snapshot.requested_currency;
  end if;

  if snapshot_payment_mode <> 'paid'
    or snapshot_offer_id is null
    or snapshot_duration is null
    or snapshot_frequency is null
    or snapshot_price_amount_minor is null
    or snapshot_currency is null then
    raise exception
      'Paid mentorship order terms are incomplete';
  end if;

  if snapshot_price_amount_minor <> new.gross_amount_minor
    or snapshot_currency <> new.currency then
    raise exception
      'Payment order economics do not match the accepted mentorship terms';
  end if;

  if not exists (
    select 1
    from public.mentorship_payment_offers offer
    where offer.id = snapshot_offer_id
      and offer.mentor_id = new.mentor_id
      and offer.duration = snapshot_duration
      and offer.payment_mode = 'paid'
      and offer.price_amount_minor = snapshot_price_amount_minor
      and offer.currency = snapshot_currency
  ) then
    raise exception
      'The accepted paid mentorship offer is invalid';
  end if;

  new.offer_id := snapshot_offer_id;
  new.agreed_duration := snapshot_duration;
  new.agreed_frequency := snapshot_frequency;
  new.mentorship_level := request_snapshot.requested_mentorship_level;
  new.mentorship_field := request_snapshot.mentorship_field;
  new.objective := request_snapshot.objective;

  return new;
end;
$function$;

revoke all
on function public.populate_mentorship_payment_order_terms()
from public, anon, authenticated;

create trigger mentorship_payment_orders_populate_terms
before insert
on public.mentorship_payment_orders
for each row
execute function public.populate_mentorship_payment_order_terms();

alter table public.mentorship_payment_orders
  alter column offer_id set not null,
  alter column agreed_duration set not null,
  alter column agreed_frequency set not null,
  alter column mentorship_level set not null,
  alter column mentorship_field set not null,
  alter column objective set not null;

create or replace function
public.guard_mentorship_payment_order_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.id is distinct from old.id
    or new.request_id is distinct from old.request_id
    or new.mentor_id is distinct from old.mentor_id
    or new.mentee_id is distinct from old.mentee_id
    or new.payment_policy_version is distinct from old.payment_policy_version
    or new.currency is distinct from old.currency
    or new.gross_amount_minor is distinct from old.gross_amount_minor
    or new.platform_fee_bps is distinct from old.platform_fee_bps
    or new.platform_fee_amount_minor
      is distinct from old.platform_fee_amount_minor
    or new.mentor_allocation_amount_minor
      is distinct from old.mentor_allocation_amount_minor
    or new.provider is distinct from old.provider
    or new.payment_expires_at is distinct from old.payment_expires_at
    or new.created_at is distinct from old.created_at
    or new.offer_id is distinct from old.offer_id
    or new.agreed_duration is distinct from old.agreed_duration
    or new.agreed_frequency is distinct from old.agreed_frequency
    or new.mentorship_level is distinct from old.mentorship_level
    or new.mentorship_field is distinct from old.mentorship_field
    or new.objective is distinct from old.objective then
    raise exception
      'Payment order economic, participant, and mentorship term snapshots are immutable';
  end if;

  if old.provider_reference is not null
    and new.provider_reference is distinct from old.provider_reference then
    raise exception
      'Payment provider reference cannot be changed once assigned';
  end if;

  if old.provider_transaction_id is not null
    and new.provider_transaction_id
      is distinct from old.provider_transaction_id then
    raise exception
      'Payment provider transaction ID cannot be changed once assigned';
  end if;

  if old.mentorship_id is not null
    and new.mentorship_id is distinct from old.mentorship_id then
    raise exception
      'Payment order mentorship cannot be changed once assigned';
  end if;

  return new;
end;
$function$;

revoke all
on function public.guard_mentorship_payment_order_integrity()
from public, anon, authenticated;

create table public.mentorship_payment_initializations (
  order_id uuid primary key
    references public.mentorship_payment_orders(id)
    on delete cascade,

  provider_reference text not null unique,
  authorization_url text,
  access_code text,
  initialized_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (
    authorization_url is null
    or authorization_url like 'https://checkout.paystack.com/%'
  ),

  check (
    access_code is null
    or char_length(trim(access_code)) > 0
  )
);

alter table public.mentorship_payment_initializations
  enable row level security;

create policy
"mentorship_payment_initializations_service_role"
on public.mentorship_payment_initializations
for all
to service_role
using (true)
with check (true);

create trigger mentorship_payment_initializations_set_updated_at
before update
on public.mentorship_payment_initializations
for each row
execute function public.set_updated_at();

create or replace function
public.prepare_mentorship_payment_initialization_v1(
  target_order_id uuid,
  target_payer_id uuid,
  target_provider_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  target_order public.mentorship_payment_orders%rowtype;
  target_request public.mentorship_requests%rowtype;
  target_account public.mentor_payment_accounts%rowtype;
  cached_initialization
    public.mentorship_payment_initializations%rowtype;
  effective_reference text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required';
  end if;

  if target_payer_id is null then
    raise exception 'Payer is required';
  end if;

  if target_provider_reference is null
    or char_length(trim(target_provider_reference)) = 0
    or target_provider_reference !~ '^[A-Za-z0-9.=-]+$' then
    raise exception 'Invalid Paystack transaction reference';
  end if;

  select *
  into target_order
  from public.mentorship_payment_orders
  where id = target_order_id
  for update;

  if not found then
    raise exception 'Mentorship payment order not found';
  end if;

  if target_order.mentee_id <> target_payer_id then
    raise exception 'Only the mentee may initialize this payment';
  end if;

  if target_order.status = 'paid' then
    return jsonb_build_object(
      'state', 'paid',
      'order_id', target_order.id,
      'mentorship_id', target_order.mentorship_id
    );
  end if;

  if target_order.status <> 'awaiting_payment' then
    return jsonb_build_object(
      'state', target_order.status,
      'order_id', target_order.id
    );
  end if;

  select *
  into target_request
  from public.mentorship_requests
  where id = target_order.request_id
  for update;

  if not found then
    raise exception 'Mentorship request not found';
  end if;

  if target_request.status <> 'awaiting_payment' then
    raise exception
      'Mentorship request is not awaiting payment';
  end if;

  if now() >= target_order.payment_expires_at then
    update public.mentorship_payment_orders
    set status = 'expired'
    where id = target_order.id;

    update public.mentorship_requests
    set status = 'expired'
    where id = target_request.id
      and status = 'awaiting_payment';

    insert into public.mentorship_audit_events (
      request_id,
      actor_id,
      event_type,
      previous_status,
      new_status,
      notes,
      metadata
    )
    values (
      target_request.id,
      target_payer_id,
      'payment_window_expired',
      'awaiting_payment',
      'expired',
      'The mentorship payment window expired before checkout was initialized.',
      jsonb_build_object(
        'payment_order_id', target_order.id,
        'payment_due_at', target_order.payment_expires_at
      )
    );

    return jsonb_build_object(
      'state', 'expired',
      'order_id', target_order.id
    );
  end if;

  select *
  into target_account
  from public.mentor_payment_accounts
  where mentor_id = target_order.mentor_id
    and provider = 'paystack'
    and status = 'active'
    and can_receive_payments = true;

  if not found then
    raise exception
      'The mentor is not ready to receive Paystack payments';
  end if;

  effective_reference :=
    coalesce(
      target_order.provider_reference,
      trim(target_provider_reference)
    );

  if target_order.provider_reference is null then
    update public.mentorship_payment_orders
    set provider_reference = effective_reference
    where id = target_order.id;

    target_order.provider_reference := effective_reference;
  end if;

  insert into public.mentorship_payment_initializations (
    order_id,
    provider_reference
  )
  values (
    target_order.id,
    effective_reference
  )
  on conflict (order_id) do nothing;

  select *
  into cached_initialization
  from public.mentorship_payment_initializations
  where order_id = target_order.id;

  if cached_initialization.provider_reference <> effective_reference then
    raise exception
      'Payment initialization reference mismatch';
  end if;

  return jsonb_build_object(
    'state', 'ready',
    'order_id', target_order.id,
    'reference', effective_reference,
    'amount_minor', target_order.gross_amount_minor,
    'currency', target_order.currency,
    'platform_fee_amount_minor',
      target_order.platform_fee_amount_minor,
    'subaccount_code', target_account.provider_account_code,
    'payment_expires_at', target_order.payment_expires_at,
    'authorization_url',
      cached_initialization.authorization_url,
    'access_code', cached_initialization.access_code,
    'initialized_at', cached_initialization.initialized_at
  );
end;
$function$;

revoke all
on function public.prepare_mentorship_payment_initialization_v1(
  uuid,
  uuid,
  text
)
from public, anon, authenticated;

grant execute
on function public.prepare_mentorship_payment_initialization_v1(
  uuid,
  uuid,
  text
)
to service_role;

create or replace function
public.record_mentorship_payment_initialization_v1(
  target_order_id uuid,
  target_provider_reference text,
  target_authorization_url text,
  target_access_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  target_order public.mentorship_payment_orders%rowtype;
  target_initialization
    public.mentorship_payment_initializations%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required';
  end if;

  if target_authorization_url is null
    or target_authorization_url
      not like 'https://checkout.paystack.com/%' then
    raise exception 'Invalid Paystack authorization URL';
  end if;

  if target_access_code is null
    or char_length(trim(target_access_code)) = 0 then
    raise exception 'Invalid Paystack access code';
  end if;

  select *
  into target_order
  from public.mentorship_payment_orders
  where id = target_order_id
  for update;

  if not found then
    raise exception 'Mentorship payment order not found';
  end if;

  if target_order.provider_reference
    is distinct from target_provider_reference then
    raise exception 'Payment provider reference mismatch';
  end if;

  select *
  into target_initialization
  from public.mentorship_payment_initializations
  where order_id = target_order.id
  for update;

  if not found then
    raise exception 'Payment initialization reservation not found';
  end if;

  if target_initialization.provider_reference
    <> target_provider_reference then
    raise exception 'Payment initialization reference mismatch';
  end if;

  if target_initialization.authorization_url is not null
    and (
      target_initialization.authorization_url
        is distinct from target_authorization_url
      or target_initialization.access_code
        is distinct from target_access_code
    ) then
    raise exception
      'Paystack checkout details cannot be replaced once recorded';
  end if;

  update public.mentorship_payment_initializations
  set
    authorization_url = target_authorization_url,
    access_code = target_access_code,
    initialized_at = coalesce(initialized_at, now())
  where order_id = target_order.id;

  return jsonb_build_object(
    'state', 'initialized',
    'order_id', target_order.id,
    'reference', target_provider_reference,
    'authorization_url', target_authorization_url,
    'access_code', target_access_code
  );
end;
$function$;

revoke all
on function public.record_mentorship_payment_initialization_v1(
  uuid,
  text,
  text,
  text
)
from public, anon, authenticated;

grant execute
on function public.record_mentorship_payment_initialization_v1(
  uuid,
  text,
  text,
  text
)
to service_role;

create or replace function
public.finalize_mentorship_payment_v1(
  target_order_id uuid,
  target_provider_reference text,
  target_provider_transaction_id text,
  target_provider_channel text,
  target_provider_amount_minor integer,
  target_provider_currency text,
  target_processor_fee_amount_minor integer,
  target_provider_paid_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  target_order public.mentorship_payment_orders%rowtype;
  target_request public.mentorship_requests%rowtype;
  mentor_settings public.mentor_profiles%rowtype;
  created_mentorship_id uuid;
  calculated_end_date date;
  active_mentorship_count integer;
  reserved_payment_count integer;
  calculated_platform_net integer;
  review_reason text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required';
  end if;

  if target_provider_reference is null
    or target_provider_transaction_id is null
    or char_length(trim(target_provider_transaction_id)) = 0 then
    raise exception 'Verified Paystack identifiers are required';
  end if;

  if target_provider_amount_minor is null
    or target_provider_amount_minor <= 0
    or target_provider_currency is null
    or target_provider_paid_at is null then
    raise exception 'Verified Paystack payment data is incomplete';
  end if;

  if target_processor_fee_amount_minor is not null
    and target_processor_fee_amount_minor < 0 then
    raise exception 'Processor fee cannot be negative';
  end if;

  select *
  into target_order
  from public.mentorship_payment_orders
  where id = target_order_id
  for update;

  if not found then
    raise exception 'Mentorship payment order not found';
  end if;

  if target_order.status = 'paid' then
    if target_order.provider_reference = target_provider_reference
      and target_order.provider_transaction_id =
        target_provider_transaction_id
      and target_order.mentorship_id is not null then
      return jsonb_build_object(
        'state', 'paid',
        'order_id', target_order.id,
        'mentorship_id', target_order.mentorship_id,
        'idempotent', true
      );
    end if;

    raise exception
      'Paid order does not match the verified Paystack transaction';
  end if;

  if target_order.status = 'review_required'
    and target_order.provider_reference = target_provider_reference
    and target_order.provider_transaction_id =
      target_provider_transaction_id then
    return jsonb_build_object(
      'state', 'review_required',
      'order_id', target_order.id,
      'reason', target_order.payment_review_reason,
      'idempotent', true
    );
  end if;

  if target_order.provider_reference
    is distinct from target_provider_reference then
    raise exception 'Paystack reference does not match the payment order';
  end if;

  if target_provider_amount_minor <> target_order.gross_amount_minor then
    raise exception 'Paystack amount does not match the payment order';
  end if;

  if target_provider_currency <> target_order.currency then
    raise exception 'Paystack currency does not match the payment order';
  end if;

  if exists (
    select 1
    from public.mentorship_payment_orders other_order
    where other_order.provider_transaction_id =
      target_provider_transaction_id
      and other_order.id <> target_order.id
  ) then
    raise exception
      'Paystack transaction is already linked to another payment order';
  end if;

  select *
  into target_request
  from public.mentorship_requests
  where id = target_order.request_id
  for update;

  if not found then
    raise exception 'Mentorship request not found';
  end if;

  calculated_platform_net :=
    case
      when target_processor_fee_amount_minor is null
        then null
      else
        target_order.platform_fee_amount_minor
        - target_processor_fee_amount_minor
    end;

  if target_provider_paid_at > target_order.payment_expires_at then
    review_reason := 'payment_received_after_expiry';
  elsif target_order.status not in (
    'awaiting_payment',
    'expired'
  ) then
    review_reason :=
      'payment_received_for_' || target_order.status || '_order';
  elsif target_request.status not in (
    'awaiting_payment',
    'expired'
  ) then
    review_reason :=
      'payment_received_for_' || target_request.status || '_request';
  end if;

  if review_reason is null then
    select *
    into mentor_settings
    from public.mentor_profiles
    where mentor_id = target_order.mentor_id
    for update;

    if not found then
      review_reason := 'mentor_settings_unavailable';
    else
      select count(*)::integer
      into active_mentorship_count
      from public.mentorships mentorship
      where mentorship.mentor_id = target_order.mentor_id
        and mentorship.status in (
          'active',
          'ending',
          'extension_pending',
          'paused',
          'completion_requested'
        );

      select count(*)::integer
      into reserved_payment_count
      from public.mentorship_requests request
      where request.mentor_id = target_order.mentor_id
        and request.status = 'awaiting_payment'
        and request.payment_due_at > now()
        and request.id <> target_request.id;

      if active_mentorship_count + reserved_payment_count >=
        mentor_settings.maximum_active_mentees then
        review_reason := 'mentor_capacity_unavailable_after_payment';
      end if;
    end if;
  end if;

  if review_reason is not null then
    update public.mentorship_payment_orders
    set
      provider_transaction_id =
        coalesce(
          provider_transaction_id,
          target_provider_transaction_id
        ),
      provider_channel =
        coalesce(
          provider_channel,
          nullif(trim(target_provider_channel), '')
        ),
      processor_fee_amount_minor =
        target_processor_fee_amount_minor,
      platform_net_amount_minor = calculated_platform_net,
      paid_at = target_provider_paid_at,
      status = 'review_required',
      payment_review_reason = review_reason
    where id = target_order.id;

    if target_request.status = 'awaiting_payment' then
      update public.mentorship_requests
      set status = 'expired'
      where id = target_request.id;
    end if;

    insert into public.mentorship_audit_events (
      request_id,
      actor_id,
      event_type,
      previous_status,
      new_status,
      notes,
      metadata
    )
    values (
      target_request.id,
      null,
      'payment_review_required',
      target_request.status,
      'review_required',
      'A verified payment requires manual review before mentorship activation.',
      jsonb_build_object(
        'payment_order_id', target_order.id,
        'provider_reference', target_provider_reference,
        'provider_transaction_id',
          target_provider_transaction_id,
        'reason', review_reason,
        'provider_paid_at', target_provider_paid_at
      )
    );

    return jsonb_build_object(
      'state', 'review_required',
      'order_id', target_order.id,
      'reason', review_reason
    );
  end if;

  if exists (
    select 1
    from public.mentorships mentorship
    where mentorship.mentor_id = target_order.mentor_id
      and mentorship.mentee_id = target_order.mentee_id
      and mentorship.status in (
        'active',
        'ending',
        'extension_pending',
        'paused',
        'completion_requested'
      )
  ) then
    update public.mentorship_payment_orders
    set
      provider_transaction_id = target_provider_transaction_id,
      provider_channel =
        nullif(trim(target_provider_channel), ''),
      processor_fee_amount_minor =
        target_processor_fee_amount_minor,
      platform_net_amount_minor = calculated_platform_net,
      paid_at = target_provider_paid_at,
      status = 'review_required',
      payment_review_reason =
        'active_mentorship_already_exists_after_payment'
    where id = target_order.id;

    if target_request.status = 'awaiting_payment' then
      update public.mentorship_requests
      set status = 'expired'
      where id = target_request.id;
    end if;

    insert into public.mentorship_audit_events (
      request_id,
      actor_id,
      event_type,
      previous_status,
      new_status,
      notes,
      metadata
    )
    values (
      target_request.id,
      null,
      'payment_review_required',
      target_request.status,
      'review_required',
      'A verified payment requires manual review because an active mentorship already exists.',
      jsonb_build_object(
        'payment_order_id', target_order.id,
        'provider_reference', target_provider_reference,
        'provider_transaction_id',
          target_provider_transaction_id,
        'reason',
          'active_mentorship_already_exists_after_payment'
      )
    );

    return jsonb_build_object(
      'state', 'review_required',
      'order_id', target_order.id,
      'reason',
        'active_mentorship_already_exists_after_payment'
    );
  end if;

  calculated_end_date :=
    case target_order.agreed_duration
      when '3_months'
        then (target_provider_paid_at::date + interval '3 months')::date
      when '6_months'
        then (target_provider_paid_at::date + interval '6 months')::date
      when '1_year'
        then (target_provider_paid_at::date + interval '1 year')::date
      else null
    end;

  if calculated_end_date is null then
    raise exception
      'Paid mentorship duration is invalid';
  end if;

  insert into public.mentorships (
    request_id,
    mentor_id,
    mentee_id,
    mentorship_field,
    mentorship_level,
    agreed_duration,
    agreed_frequency,
    objective,
    start_date,
    expected_end_date
  )
  values (
    target_request.id,
    target_order.mentor_id,
    target_order.mentee_id,
    target_order.mentorship_field,
    target_order.mentorship_level,
    target_order.agreed_duration,
    target_order.agreed_frequency,
    target_order.objective,
    target_provider_paid_at::date,
    calculated_end_date
  )
  returning id into created_mentorship_id;

  update public.mentorship_requests
  set
    status = 'accepted',
    responded_at = coalesce(responded_at, now())
  where id = target_request.id;

  update public.mentorship_payment_orders
  set
    mentorship_id = created_mentorship_id,
    provider_transaction_id =
      target_provider_transaction_id,
    provider_channel =
      nullif(trim(target_provider_channel), ''),
    processor_fee_amount_minor =
      target_processor_fee_amount_minor,
    platform_net_amount_minor = calculated_platform_net,
    status = 'paid',
    paid_at = target_provider_paid_at,
    payment_review_reason = null
  where id = target_order.id;

  insert into public.mentorship_audit_events (
    request_id,
    mentorship_id,
    actor_id,
    event_type,
    previous_status,
    new_status,
    notes,
    metadata
  )
  values (
    target_request.id,
    created_mentorship_id,
    null,
    'payment_confirmed',
    target_request.status,
    'active',
    'Paystack payment was verified and the paid mentorship was activated.',
    jsonb_build_object(
      'payment_order_id', target_order.id,
      'provider_reference', target_provider_reference,
      'provider_transaction_id',
        target_provider_transaction_id,
      'provider_channel',
        nullif(trim(target_provider_channel), ''),
      'gross_amount_minor', target_order.gross_amount_minor,
      'currency', target_order.currency,
      'processor_fee_amount_minor',
        target_processor_fee_amount_minor,
      'platform_net_amount_minor', calculated_platform_net,
      'paid_at', target_provider_paid_at
    )
  );

  return jsonb_build_object(
    'state', 'paid',
    'order_id', target_order.id,
    'mentorship_id', created_mentorship_id,
    'idempotent', false
  );
end;
$function$;

revoke all
on function public.finalize_mentorship_payment_v1(
  uuid,
  text,
  text,
  text,
  integer,
  text,
  integer,
  timestamptz
)
from public, anon, authenticated;

grant execute
on function public.finalize_mentorship_payment_v1(
  uuid,
  text,
  text,
  text,
  integer,
  text,
  integer,
  timestamptz
)
to service_role;

do $assert$
begin
  if exists (
    select 1
    from public.mentorship_payment_orders
  ) then
    raise exception
      'Migration expected zero live mentorship payment orders';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'mentorship_payment_orders'
      and column_name = 'offer_id'
      and is_nullable = 'NO'
  ) then
    raise exception 'Paid order offer snapshot is not mandatory';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid =
      'public.mentorship_payment_orders'::regclass
      and tgname =
        'mentorship_payment_orders_populate_terms'
      and not tgisinternal
  ) then
    raise exception
      'Paid order term snapshot trigger was not created';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n
      on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname =
        'prepare_mentorship_payment_initialization_v1'
  ) then
    raise exception
      'Payment initialization preparation function was not created';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n
      on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname =
        'finalize_mentorship_payment_v1'
  ) then
    raise exception
      'Payment fulfillment function was not created';
  end if;
end;
$assert$;

commit;

-- FieldsConnect Mentorship Payments v1 execution hardening.
-- Protects immutable payment-order economics and prevents explicit mentor
-- pricing configuration from silently falling back to free terms.

begin;

-- ---------------------------------------------------------------------------
-- Payment order integrity.
-- Economic and participant snapshots are immutable after order creation.
-- Provider reconciliation fields, processor fees, platform net, status,
-- lifecycle timestamps, receipt state, and mentorship_id may still advance.
-- Once identifiers are assigned, they cannot be replaced or cleared.
-- ---------------------------------------------------------------------------

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
    or new.platform_fee_amount_minor is distinct from old.platform_fee_amount_minor
    or new.mentor_allocation_amount_minor is distinct from old.mentor_allocation_amount_minor
    or new.provider is distinct from old.provider
    or new.payment_expires_at is distinct from old.payment_expires_at
    or new.created_at is distinct from old.created_at then
    raise exception
      'Payment order economic and participant snapshots are immutable';
  end if;

  if old.provider_reference is not null
    and new.provider_reference is distinct from old.provider_reference then
    raise exception
      'Payment provider reference cannot be changed once assigned';
  end if;

  if old.provider_transaction_id is not null
    and new.provider_transaction_id is distinct from old.provider_transaction_id then
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

create trigger mentorship_payment_orders_guard_integrity
before update
on public.mentorship_payment_orders
for each row
execute function public.guard_mentorship_payment_order_integrity();


-- ---------------------------------------------------------------------------
-- Explicit-offer guard.
-- Legacy mentors with no payment offers keep the existing free fallback.
-- Once a mentor has created any payment offer, requests and counterproposals
-- must resolve to an active offer for the selected duration. This prevents a
-- missing or inactive configured duration from silently becoming free.
-- ---------------------------------------------------------------------------

create or replace function
public.guard_mentorship_request_offer_configuration()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  mentor_has_explicit_offers boolean;
begin
  select exists (
    select 1
    from public.mentorship_payment_offers offer
    where offer.mentor_id = new.mentor_id
  )
  into mentor_has_explicit_offers;

  if not mentor_has_explicit_offers then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.requested_offer_id is null then
      raise exception
        'This mentor has configured mentorship pricing, but no active offer exists for the selected duration';
    end if;

    if not exists (
      select 1
      from public.mentorship_payment_offers offer
      where offer.id = new.requested_offer_id
        and offer.mentor_id = new.mentor_id
        and offer.duration = new.requested_duration
        and offer.is_active = true
        and offer.payment_mode = new.requested_payment_mode
        and offer.price_amount_minor = new.requested_price_amount_minor
        and offer.currency = new.requested_currency
    ) then
      raise exception
        'The requested mentorship payment snapshot does not match the active mentor offer';
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE'
    and new.status = 'change_proposed'
    and new.proposed_duration is not null then
    if new.proposed_offer_id is null then
      raise exception
        'This mentor has configured mentorship pricing, but no active offer exists for the proposed duration';
    end if;

    if not exists (
      select 1
      from public.mentorship_payment_offers offer
      where offer.id = new.proposed_offer_id
        and offer.mentor_id = new.mentor_id
        and offer.duration = new.proposed_duration
        and offer.is_active = true
        and offer.payment_mode = new.proposed_payment_mode
        and offer.price_amount_minor = new.proposed_price_amount_minor
        and offer.currency = new.proposed_currency
    ) then
      raise exception
        'The proposed mentorship payment snapshot does not match the active mentor offer';
    end if;
  end if;

  return new;
end;
$function$;

revoke all
on function public.guard_mentorship_request_offer_configuration()
from public, anon, authenticated;

create trigger mentorship_requests_guard_explicit_offer_insert
before insert
on public.mentorship_requests
for each row
execute function public.guard_mentorship_request_offer_configuration();

create trigger mentorship_requests_guard_explicit_offer_proposal
before update of
  proposed_duration,
  proposed_offer_id,
  proposed_payment_mode,
  proposed_price_amount_minor,
  proposed_currency
on public.mentorship_requests
for each row
execute function public.guard_mentorship_request_offer_configuration();


-- ---------------------------------------------------------------------------
-- Migration assertions.
-- ---------------------------------------------------------------------------

do $assert$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.mentorship_payment_orders'::regclass
      and tgname = 'mentorship_payment_orders_guard_integrity'
      and not tgisinternal
  ) then
    raise exception
      'Payment order integrity trigger was not created';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.mentorship_requests'::regclass
      and tgname = 'mentorship_requests_guard_explicit_offer_insert'
      and not tgisinternal
  ) then
    raise exception
      'Mentorship request explicit-offer insert guard was not created';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.mentorship_requests'::regclass
      and tgname = 'mentorship_requests_guard_explicit_offer_proposal'
      and not tgisinternal
  ) then
    raise exception
      'Mentorship request explicit-offer proposal guard was not created';
  end if;
end;
$assert$;

commit;

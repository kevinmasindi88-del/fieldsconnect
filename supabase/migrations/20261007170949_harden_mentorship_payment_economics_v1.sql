-- FieldsConnect Mentorship Payments v1 economics hardening.
-- Enforces ZAR-only snapshots across payment records and permits platform net
-- to become negative when FieldsConnect absorbs processor fees.

begin;

-- v1 supports ZAR only across every persisted payment-economic snapshot.
alter table public.mentorship_payment_policies
  add constraint mentorship_payment_policies_zar_v1_check
  check (currency = 'ZAR');

alter table public.mentorship_requests
  add constraint mentorship_requests_requested_currency_zar_v1_check
  check (requested_currency = 'ZAR');

alter table public.mentorship_requests
  add constraint mentorship_requests_proposed_currency_zar_v1_check
  check (
    proposed_currency is null
    or proposed_currency = 'ZAR'
  );

alter table public.mentorship_payment_orders
  add constraint mentorship_payment_orders_currency_zar_v1_check
  check (currency = 'ZAR');

-- FieldsConnect absorbs ordinary processor fees from its platform fee.
-- For sufficiently small transactions, processor fees may exceed the platform
-- fee. Preserve the true economics rather than rejecting a negative FC net.
alter table public.mentorship_payment_orders
  drop constraint mentorship_payment_orders_platform_net_amount_minor_check;

-- Assertions: all payment-economic currency snapshots remain ZAR-only, and the
-- old non-negative platform-net constraint is no longer present.
do $assert$
begin
  if exists (
    select 1
    from public.mentorship_payment_policies
    where currency <> 'ZAR'
  ) then
    raise exception
      'Non-ZAR mentorship payment policy found';
  end if;

  if exists (
    select 1
    from public.mentorship_payment_offers
    where currency <> 'ZAR'
  ) then
    raise exception
      'Non-ZAR mentorship payment offer found';
  end if;

  if exists (
    select 1
    from public.mentorship_requests
    where requested_currency <> 'ZAR'
       or (
         proposed_currency is not null
         and proposed_currency <> 'ZAR'
       )
  ) then
    raise exception
      'Non-ZAR mentorship request payment snapshot found';
  end if;

  if exists (
    select 1
    from public.mentorship_payment_orders
    where currency <> 'ZAR'
  ) then
    raise exception
      'Non-ZAR mentorship payment order found';
  end if;

  if exists (
    select 1
    from pg_constraint
    where connamespace = 'public'::regnamespace
      and conrelid =
        'public.mentorship_payment_orders'::regclass
      and conname =
        'mentorship_payment_orders_platform_net_amount_minor_check'
  ) then
    raise exception
      'Platform net must allow negative values when processor fees exceed the FC fee';
  end if;
end;
$assert$;

commit;

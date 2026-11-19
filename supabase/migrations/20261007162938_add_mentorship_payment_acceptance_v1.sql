-- FieldsConnect Mentorship Payments v1 acceptance flow.
-- Adds payment-aware request snapshots, paid acceptance reservations,
-- capacity accounting, and payment-required notifications.
-- This migration does not call Paystack and does not activate paid mentorships.

begin;

-- ---------------------------------------------------------------------------
-- v1 commercial guardrails.
-- Paid mentorships are ZAR-only and require an active Paystack payout account.
-- Ongoing paid mentorships remain prohibited by the v1 foundation constraint.
-- ---------------------------------------------------------------------------

alter table public.mentorship_payment_offers
  add constraint mentorship_payment_offers_zar_v1_check
  check (currency = 'ZAR');

alter table public.mentorship_requests
  add constraint mentorship_requests_awaiting_payment_due_check
  check (
    status <> 'awaiting_payment'
    or payment_due_at is not null
  );

create index mentorship_requests_payment_reservation_idx
  on public.mentorship_requests (
    mentor_id,
    payment_due_at
  )
  where status = 'awaiting_payment';


create or replace function
public.validate_mentorship_payment_offer_readiness()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.payment_mode = 'paid' then
    if new.duration = 'ongoing' then
      raise exception
        'Paid ongoing mentorships are not available in this release';
    end if;

    if new.currency <> 'ZAR' then
      raise exception
        'Paid mentorships currently support ZAR only';
    end if;

    if not exists (
      select 1
      from public.mentor_payment_accounts account
      where account.mentor_id = new.mentor_id
        and account.provider = 'paystack'
        and account.status = 'active'
        and account.can_receive_payments = true
    ) then
      raise exception
        'Connect an active payout account before publishing a paid mentorship offer';
    end if;
  end if;

  return new;
end;
$function$;

revoke all
on function public.validate_mentorship_payment_offer_readiness()
from public, anon, authenticated;

create trigger mentorship_payment_offers_validate_readiness
before insert or update of
  mentor_id,
  duration,
  payment_mode,
  currency
on public.mentorship_payment_offers
for each row
execute function public.validate_mentorship_payment_offer_readiness();


-- ---------------------------------------------------------------------------
-- Capacity helper.
-- Active mentorships and unexpired awaiting-payment requests both consume a
-- mentor slot. The current request is excluded when it later becomes active.
-- Locking mentor_profiles serializes competing acceptance operations per mentor.
-- ---------------------------------------------------------------------------

create or replace function public.assert_mentorship_capacity_available(
  target_mentor_id uuid,
  target_request_id uuid default null,
  target_mentorship_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  mentor_settings public.mentor_profiles%rowtype;
  active_mentorship_count integer;
  reserved_payment_count integer;
begin
  select *
  into mentor_settings
  from public.mentor_profiles
  where mentor_id = target_mentor_id
  for update;

  if not found then
    raise exception
      'This mentor has not configured mentorship settings';
  end if;

  select count(*)::integer
  into active_mentorship_count
  from public.mentorships mentorship
  where mentorship.mentor_id = target_mentor_id
    and mentorship.status in (
      'active',
      'ending',
      'extension_pending',
      'paused',
      'completion_requested'
    )
    and (
      target_mentorship_id is null
      or mentorship.id <> target_mentorship_id
    );

  select count(*)::integer
  into reserved_payment_count
  from public.mentorship_requests request
  where request.mentor_id = target_mentor_id
    and request.status = 'awaiting_payment'
    and request.payment_due_at > now()
    and (
      target_request_id is null
      or request.id <> target_request_id
    );

  if active_mentorship_count + reserved_payment_count >=
    mentor_settings.maximum_active_mentees then
    raise exception
      'This mentor has reached their maximum active mentee capacity';
  end if;
end;
$function$;

revoke all
on function public.assert_mentorship_capacity_available(
  uuid,
  uuid,
  uuid
)
from public, anon, authenticated;


create or replace function
public.enforce_mentorship_capacity_and_level()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  mentor_settings public.mentor_profiles%rowtype;
begin
  if new.status not in (
    'active',
    'ending',
    'extension_pending',
    'paused',
    'completion_requested'
  ) then
    return new;
  end if;

  select *
  into mentor_settings
  from public.mentor_profiles
  where mentor_id = new.mentor_id
  for update;

  if not found then
    raise exception
      'This mentor has not configured mentorship settings';
  end if;

  if new.mentorship_level is null
    or not (
      new.mentorship_level =
        any(mentor_settings.mentoring_levels)
    ) then
    raise exception
      'This mentor is not accepting mentorship at the selected level';
  end if;

  perform public.assert_mentorship_capacity_available(
    new.mentor_id,
    new.request_id,
    new.id
  );

  return new;
end;
$function$;

revoke all
on function public.enforce_mentorship_capacity_and_level()
from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- Request creation.
-- Snapshot the mentor's current offer so later price edits cannot change an
-- existing request. Mentors without an explicit offer remain free by default,
-- preserving the existing mentorship flow during rollout.
-- ---------------------------------------------------------------------------

create or replace function public.create_mentorship_request(
  target_mentor_id uuid,
  requested_mentorship_field text,
  requested_objective text,
  requested_motivation text,
  requested_period text,
  requested_contact_frequency text,
  requested_mentorship_level text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  created_request_id uuid;
  mentor_settings public.mentor_profiles%rowtype;
  mentor_is_available boolean;
  normalized_mentorship_level text;
  selected_offer public.mentorship_payment_offers%rowtype;
  request_offer_id uuid;
  request_payment_mode text := 'free';
  request_price_amount_minor integer := 0;
  request_currency text := 'ZAR';
  stale_payment_request public.mentorship_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if target_mentor_id = auth.uid() then
    raise exception 'You cannot request mentorship from yourself';
  end if;

  normalized_mentorship_level :=
    nullif(trim(requested_mentorship_level), '');

  if normalized_mentorship_level is null then
    raise exception 'Select a mentorship level offered by this mentor';
  end if;

  select profile.mentor_available
  into mentor_is_available
  from public.profiles profile
  where profile.id = target_mentor_id
    and profile.deleted_at is null
    and profile.is_active = true;

  if coalesce(mentor_is_available, false) = false then
    raise exception
      'This user is not currently available as a mentor';
  end if;

  select *
  into mentor_settings
  from public.mentor_profiles
  where mentor_id = target_mentor_id
    and is_accepting_requests = true;

  if not found then
    raise exception
      'This mentor is not currently accepting requests';
  end if;

  if not (
    normalized_mentorship_level =
      any(mentor_settings.mentoring_levels)
  ) then
    raise exception
      'This mentor does not offer mentorship at the selected level';
  end if;

  if not (
    case requested_period
      when '3_months'
        then mentor_settings.accepts_3_month
      when '6_months'
        then mentor_settings.accepts_6_month
      when '1_year'
        then mentor_settings.accepts_1_year
      when 'ongoing'
        then mentor_settings.accepts_ongoing
      else false
    end
  ) then
    raise exception
      'The mentor is not accepting this mentorship period';
  end if;

  -- Clean up an expired paid reservation for this same pair before the
  -- unique open-request constraint is evaluated.
  select *
  into stale_payment_request
  from public.mentorship_requests request
  where request.mentee_id = auth.uid()
    and request.mentor_id = target_mentor_id
    and request.status = 'awaiting_payment'
    and (
      request.payment_due_at is null
      or request.payment_due_at <= now()
    )
  order by request.created_at desc
  limit 1
  for update;

  if found then
    update public.mentorship_payment_orders
    set
      status = 'expired'
    where request_id = stale_payment_request.id
      and status = 'awaiting_payment';

    update public.mentorship_requests
    set
      status = 'expired'
    where id = stale_payment_request.id;

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
      stale_payment_request.id,
      auth.uid(),
      'payment_window_expired',
      'awaiting_payment',
      'expired',
      'The mentorship payment window expired before payment was completed.',
      jsonb_build_object(
        'payment_due_at', stale_payment_request.payment_due_at
      )
    );
  end if;

  if exists (
    select 1
    from public.mentorships mentorship
    where mentorship.mentor_id = target_mentor_id
      and mentorship.mentee_id = auth.uid()
      and mentorship.status in (
        'active',
        'ending',
        'extension_pending',
        'paused',
        'completion_requested'
      )
  ) then
    raise exception
      'An active mentorship already exists with this mentor';
  end if;

  select *
  into selected_offer
  from public.mentorship_payment_offers offer
  where offer.mentor_id = target_mentor_id
    and offer.duration = requested_period
    and offer.is_active = true
  limit 1;

  if found then
    request_offer_id := selected_offer.id;
    request_payment_mode := selected_offer.payment_mode;
    request_price_amount_minor := selected_offer.price_amount_minor;
    request_currency := selected_offer.currency;
  end if;

  insert into public.mentorship_requests (
    mentee_id,
    mentor_id,
    mentorship_field,
    objective,
    motivation,
    requested_duration,
    requested_frequency,
    requested_mentorship_level,
    requested_offer_id,
    requested_payment_mode,
    requested_price_amount_minor,
    requested_currency
  )
  values (
    auth.uid(),
    target_mentor_id,
    trim(requested_mentorship_field),
    trim(requested_objective),
    trim(requested_motivation),
    requested_period,
    requested_contact_frequency,
    normalized_mentorship_level,
    request_offer_id,
    request_payment_mode,
    request_price_amount_minor,
    request_currency
  )
  returning id into created_request_id;

  insert into public.mentorship_audit_events (
    request_id,
    actor_id,
    event_type,
    new_status,
    notes,
    metadata
  )
  values (
    created_request_id,
    auth.uid(),
    'request_created',
    'pending',
    'The mentee submitted a mentorship request.',
    jsonb_build_object(
      'requested_duration', requested_period,
      'requested_frequency', requested_contact_frequency,
      'mentorship_field', trim(requested_mentorship_field),
      'requested_mentorship_level', normalized_mentorship_level,
      'payment_mode', request_payment_mode,
      'price_amount_minor', request_price_amount_minor,
      'currency', request_currency,
      'offer_id', request_offer_id
    )
  );

  return created_request_id;
end;
$function$;


create or replace function public.create_mentorship_request(
  target_mentor_id uuid,
  requested_mentorship_field text,
  requested_objective text,
  requested_motivation text,
  requested_period text,
  requested_contact_frequency text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  requester_level text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select profile.role_type
  into requester_level
  from public.profiles profile
  where profile.id = auth.uid()
    and profile.deleted_at is null
    and profile.is_active = true;

  if requester_level is null then
    raise exception 'Your profile level is unavailable';
  end if;

  return public.create_mentorship_request(
    target_mentor_id,
    requested_mentorship_field,
    requested_objective,
    requested_motivation,
    requested_period,
    requested_contact_frequency,
    requester_level
  );
end;
$function$;


-- ---------------------------------------------------------------------------
-- Payment-aware acceptance.
-- Free: preserve immediate activation.
-- Paid: create an immutable economics snapshot, reserve capacity, and move the
-- request to awaiting_payment. No mentorship row exists until verified payment.
-- ---------------------------------------------------------------------------

create or replace function public.respond_to_mentorship_request(
  target_request_id uuid,
  response_action text,
  counterproposal_duration text default null,
  counterproposal_frequency text default null,
  response_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  target_request public.mentorship_requests%rowtype;
  mentor_settings public.mentor_profiles%rowtype;
  selected_offer public.mentorship_payment_offers%rowtype;
  active_policy public.mentorship_payment_policies%rowtype;
  created_mentorship_id uuid;
  created_payment_order_id uuid;
  final_offer_id uuid;
  final_duration text;
  final_frequency text;
  final_payment_mode text;
  final_price_amount_minor integer;
  final_currency text;
  calculated_end_date date;
  payment_due_at_value timestamptz;
  platform_fee_amount integer;
  mentor_allocation_amount integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
  into target_request
  from public.mentorship_requests
  where id = target_request_id
  for update;

  if not found then
    raise exception 'Mentorship request not found';
  end if;

  if target_request.status not in (
    'pending',
    'change_proposed'
  ) then
    raise exception
      'This mentorship request cannot be changed';
  end if;

  if target_request.status = 'pending'
    and target_request.mentor_id <> auth.uid() then
    raise exception
      'Only the requested mentor may respond to a new request';
  end if;

  if target_request.status = 'change_proposed'
    and target_request.mentee_id <> auth.uid() then
    raise exception
      'Only the mentee may accept or decline the proposed terms';
  end if;

  if target_request.expires_at <= now() then
    update public.mentorship_requests
    set
      status = 'expired',
      responded_at = now()
    where id = target_request.id;

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
      auth.uid(),
      'request_expired',
      target_request.status,
      'expired',
      'The mentorship request expired before a response was completed.',
      jsonb_build_object(
        'expires_at', target_request.expires_at
      )
    );

    return null;
  end if;

  if response_action = 'decline' then
    update public.mentorship_requests
    set
      status = 'declined',
      responded_at = now(),
      proposal_message =
        nullif(trim(response_message), '')
    where id = target_request.id;

    insert into public.mentorship_audit_events (
      request_id,
      actor_id,
      event_type,
      previous_status,
      new_status,
      notes
    )
    values (
      target_request.id,
      auth.uid(),
      'request_declined',
      target_request.status,
      'declined',
      nullif(trim(response_message), '')
    );

    return null;
  end if;

  if response_action = 'counterpropose' then
    if target_request.status <> 'pending'
      or target_request.mentor_id <> auth.uid() then
      raise exception
        'Only the mentor may propose changes to a new request';
    end if;

    if counterproposal_duration is null
      or counterproposal_frequency is null then
      raise exception
        'A counterproposal requires a duration and frequency';
    end if;

    select *
    into mentor_settings
    from public.mentor_profiles
    where mentor_id = target_request.mentor_id;

    if not found then
      raise exception
        'This mentor has not configured mentorship settings';
    end if;

    if not (
      case counterproposal_duration
        when '3_months'
          then mentor_settings.accepts_3_month
        when '6_months'
          then mentor_settings.accepts_6_month
        when '1_year'
          then mentor_settings.accepts_1_year
        when 'ongoing'
          then mentor_settings.accepts_ongoing
        else false
      end
    ) then
      raise exception
        'The mentor is not accepting this mentorship period';
    end if;

    select *
    into selected_offer
    from public.mentorship_payment_offers offer
    where offer.mentor_id = target_request.mentor_id
      and offer.duration = counterproposal_duration
      and offer.is_active = true
    limit 1;

    if found then
      final_offer_id := selected_offer.id;
      final_payment_mode := selected_offer.payment_mode;
      final_price_amount_minor := selected_offer.price_amount_minor;
      final_currency := selected_offer.currency;
    else
      final_offer_id := null;
      final_payment_mode := 'free';
      final_price_amount_minor := 0;
      final_currency := 'ZAR';
    end if;

    update public.mentorship_requests
    set
      status = 'change_proposed',
      proposed_duration = counterproposal_duration,
      proposed_frequency = counterproposal_frequency,
      proposal_message =
        nullif(trim(response_message), ''),
      proposed_offer_id = final_offer_id,
      proposed_payment_mode = final_payment_mode,
      proposed_price_amount_minor = final_price_amount_minor,
      proposed_currency = final_currency,
      responded_at = now()
    where id = target_request.id;

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
      auth.uid(),
      'change_proposed',
      target_request.status,
      'change_proposed',
      nullif(trim(response_message), ''),
      jsonb_build_object(
        'proposed_duration', counterproposal_duration,
        'proposed_frequency', counterproposal_frequency,
        'payment_mode', final_payment_mode,
        'price_amount_minor', final_price_amount_minor,
        'currency', final_currency,
        'offer_id', final_offer_id
      )
    );

    return null;
  end if;

  if response_action <> 'accept' then
    raise exception 'Invalid mentorship response';
  end if;

  if target_request.status = 'change_proposed'
    and target_request.proposed_payment_mode is not null then
    final_offer_id := target_request.proposed_offer_id;
    final_duration := target_request.proposed_duration;
    final_frequency := target_request.proposed_frequency;
    final_payment_mode := target_request.proposed_payment_mode;
    final_price_amount_minor := target_request.proposed_price_amount_minor;
    final_currency := target_request.proposed_currency;
  else
    final_offer_id := target_request.requested_offer_id;
    final_duration := coalesce(
      target_request.proposed_duration,
      target_request.requested_duration
    );
    final_frequency := coalesce(
      target_request.proposed_frequency,
      target_request.requested_frequency
    );
    final_payment_mode := target_request.requested_payment_mode;
    final_price_amount_minor := target_request.requested_price_amount_minor;
    final_currency := target_request.requested_currency;
  end if;

  if final_duration is null
    or final_frequency is null
    or final_payment_mode is null
    or final_price_amount_minor is null
    or final_currency is null then
    raise exception
      'The mentorship terms are incomplete';
  end if;

  calculated_end_date :=
    case final_duration
      when '3_months'
        then (current_date + interval '3 months')::date
      when '6_months'
        then (current_date + interval '6 months')::date
      when '1_year'
        then (current_date + interval '1 year')::date
      when 'ongoing'
        then null
      else null
    end;

  if final_payment_mode = 'paid' then
    if final_duration = 'ongoing' then
      raise exception
        'Paid ongoing mentorships are not available in this release';
    end if;

    if final_price_amount_minor <= 0 then
      raise exception
        'A paid mentorship requires a positive price';
    end if;

    select *
    into active_policy
    from public.mentorship_payment_policies policy
    where policy.is_active = true
    order by policy.effective_from desc
    limit 1;

    if not found then
      raise exception
        'No active mentorship payment policy is configured';
    end if;

    if final_currency <> active_policy.currency then
      raise exception
        'The mentorship currency does not match the active payment policy';
    end if;

    if not exists (
      select 1
      from public.mentor_payment_accounts account
      where account.mentor_id = target_request.mentor_id
        and account.provider = 'paystack'
        and account.status = 'active'
        and account.can_receive_payments = true
    ) then
      raise exception
        'The mentor is not ready to receive paid mentorship payments';
    end if;

    select *
    into mentor_settings
    from public.mentor_profiles
    where mentor_id = target_request.mentor_id
    for update;

    if not found then
      raise exception
        'This mentor has not configured mentorship settings';
    end if;

    if target_request.requested_mentorship_level is null
      or not (
        target_request.requested_mentorship_level =
          any(mentor_settings.mentoring_levels)
      ) then
      raise exception
        'This mentor is not accepting mentorship at the selected level';
    end if;

    perform public.assert_mentorship_capacity_available(
      target_request.mentor_id,
      target_request.id,
      null
    );

    payment_due_at_value :=
      now() + make_interval(
        hours => active_policy.payment_window_hours
      );

    platform_fee_amount :=
      round(
        final_price_amount_minor::numeric
        * active_policy.platform_fee_bps::numeric
        / 10000::numeric
      )::integer;

    mentor_allocation_amount :=
      final_price_amount_minor - platform_fee_amount;

    insert into public.mentorship_payment_orders (
      request_id,
      mentor_id,
      mentee_id,
      payment_policy_version,
      currency,
      gross_amount_minor,
      platform_fee_bps,
      platform_fee_amount_minor,
      mentor_allocation_amount_minor,
      provider,
      status,
      payment_expires_at
    )
    values (
      target_request.id,
      target_request.mentor_id,
      target_request.mentee_id,
      active_policy.version,
      final_currency,
      final_price_amount_minor,
      active_policy.platform_fee_bps,
      platform_fee_amount,
      mentor_allocation_amount,
      'paystack',
      'awaiting_payment',
      payment_due_at_value
    )
    returning id into created_payment_order_id;

    update public.mentorship_requests
    set
      status = 'awaiting_payment',
      responded_at = now(),
      payment_due_at = payment_due_at_value
    where id = target_request.id;

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
      auth.uid(),
      'payment_required',
      target_request.status,
      'awaiting_payment',
      'The mentorship terms were accepted and payment is required before activation.',
      jsonb_build_object(
        'payment_order_id', created_payment_order_id,
        'offer_id', final_offer_id,
        'agreed_duration', final_duration,
        'agreed_frequency', final_frequency,
        'payment_mode', final_payment_mode,
        'gross_amount_minor', final_price_amount_minor,
        'currency', final_currency,
        'platform_fee_bps', active_policy.platform_fee_bps,
        'platform_fee_amount_minor', platform_fee_amount,
        'mentor_allocation_amount_minor', mentor_allocation_amount,
        'payment_due_at', payment_due_at_value
      )
    );

    return null;
  end if;

  if final_payment_mode <> 'free'
    or final_price_amount_minor <> 0 then
    raise exception
      'Free mentorship terms are inconsistent';
  end if;

  update public.mentorship_requests
  set
    status = 'accepted',
    responded_at = now(),
    payment_due_at = null
  where id = target_request.id;

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
    target_request.mentor_id,
    target_request.mentee_id,
    target_request.mentorship_field,
    target_request.requested_mentorship_level,
    final_duration,
    final_frequency,
    target_request.objective,
    current_date,
    calculated_end_date
  )
  returning id into created_mentorship_id;

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
    auth.uid(),
    'request_accepted',
    target_request.status,
    'active',
    'The mentorship terms were accepted.',
    jsonb_build_object(
      'agreed_duration', final_duration,
      'agreed_frequency', final_frequency,
      'mentorship_level', target_request.requested_mentorship_level,
      'payment_mode', 'free',
      'start_date', current_date,
      'expected_end_date', calculated_end_date
    )
  );

  return created_mentorship_id;
end;
$function$;


-- ---------------------------------------------------------------------------
-- Request notifications.
-- awaiting_payment notifies the mentee that accepted paid terms now require
-- payment. Free accepted requests preserve the existing notification behavior.
-- ---------------------------------------------------------------------------

create or replace function
public.notify_mentorship_request_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  acting_user_id uuid;
  notification_recipient_id uuid;
  actor_name text;
  next_notification_type text;
  next_title text;
  next_body text;
begin
  acting_user_id := auth.uid();

  if tg_op = 'INSERT' then
    if new.status <> 'pending' then
      return new;
    end if;

    notification_recipient_id := new.mentor_id;
    acting_user_id := new.mentee_id;
    next_notification_type := 'mentorship_request';
    next_title := 'New mentorship request';

    select profile.display_name
    into actor_name
    from public.profiles profile
    where profile.id = new.mentee_id;

    next_body :=
      coalesce(actor_name, 'Someone')
      || ' requested mentorship in '
      || new.mentorship_field
      || '.';
  elsif tg_op = 'UPDATE' then
    if old.status is not distinct from new.status then
      return new;
    end if;

    if new.status = 'change_proposed' then
      notification_recipient_id := new.mentee_id;
      acting_user_id := new.mentor_id;
      next_notification_type :=
        'mentorship_change_proposed';
      next_title := 'Mentorship changes proposed';

      select profile.display_name
      into actor_name
      from public.profiles profile
      where profile.id = new.mentor_id;

      next_body :=
        coalesce(actor_name, 'Your requested mentor')
        || ' proposed changes to your mentorship request.';
    elsif new.status = 'awaiting_payment' then
      notification_recipient_id := new.mentee_id;
      acting_user_id := new.mentor_id;
      next_notification_type :=
        'mentorship_payment_required';
      next_title := 'Payment required';

      select profile.display_name
      into actor_name
      from public.profiles profile
      where profile.id = new.mentor_id;

      next_body :=
        'Payment is required to activate your mentorship with '
        || coalesce(actor_name, 'your mentor')
        || '.';
    elsif new.status = 'accepted' then
      if acting_user_id = new.mentee_id then
        notification_recipient_id := new.mentor_id;
      else
        notification_recipient_id := new.mentee_id;
        acting_user_id := new.mentor_id;
      end if;

      next_notification_type :=
        'mentorship_accepted';
      next_title := 'Mentorship request accepted';

      select profile.display_name
      into actor_name
      from public.profiles profile
      where profile.id = acting_user_id;

      next_body :=
        coalesce(actor_name, 'Someone')
        || ' accepted the mentorship request.';
    elsif new.status = 'declined' then
      if acting_user_id = new.mentee_id then
        notification_recipient_id := new.mentor_id;
      else
        notification_recipient_id := new.mentee_id;
        acting_user_id := new.mentor_id;
      end if;

      next_notification_type :=
        'mentorship_declined';
      next_title := 'Mentorship request declined';

      select profile.display_name
      into actor_name
      from public.profiles profile
      where profile.id = acting_user_id;

      next_body :=
        coalesce(actor_name, 'Someone')
        || ' declined the mentorship request.';
    else
      return new;
    end if;
  else
    return new;
  end if;

  if notification_recipient_id is null
    or notification_recipient_id = acting_user_id then
    return new;
  end if;

  insert into public.notifications (
    recipient_id,
    actor_id,
    notification_type,
    entity_type,
    entity_id,
    title,
    body
  )
  values (
    notification_recipient_id,
    acting_user_id,
    next_notification_type,
    'mentorship_request',
    new.id,
    next_title,
    next_body
  );

  return new;
end;
$function$;

revoke all
on function public.notify_mentorship_request_activity()
from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- Explicit RPC permissions.
-- ---------------------------------------------------------------------------

revoke all
on function public.create_mentorship_request(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text
)
from public, anon;

grant execute
on function public.create_mentorship_request(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text
)
to authenticated;

revoke all
on function public.create_mentorship_request(
  uuid,
  text,
  text,
  text,
  text,
  text
)
from public, anon;

grant execute
on function public.create_mentorship_request(
  uuid,
  text,
  text,
  text,
  text,
  text
)
to authenticated;

revoke all
on function public.respond_to_mentorship_request(
  uuid,
  text,
  text,
  text,
  text
)
from public, anon;

grant execute
on function public.respond_to_mentorship_request(
  uuid,
  text,
  text,
  text,
  text
)
to authenticated;


-- ---------------------------------------------------------------------------
-- Migration assertions.
-- ---------------------------------------------------------------------------

do $assert$
declare
  awaiting_payment_index_definition text;
  request_status_constraint text;
begin
  select indexdef
  into awaiting_payment_index_definition
  from pg_indexes
  where schemaname = 'public'
    and tablename = 'mentorship_requests'
    and indexname = 'mentorship_requests_payment_reservation_idx';

  if awaiting_payment_index_definition is null
    or position(
      'awaiting_payment' in awaiting_payment_index_definition
    ) = 0 then
    raise exception
      'Expected awaiting-payment capacity reservation index';
  end if;

  select pg_get_constraintdef(oid)
  into request_status_constraint
  from pg_constraint
  where connamespace = 'public'::regnamespace
    and conrelid = 'public.mentorship_requests'::regclass
    and conname = 'mentorship_requests_status_check';

  if request_status_constraint is null
    or position(
      'awaiting_payment' in request_status_constraint
    ) = 0 then
    raise exception
      'Mentorship request status constraint must include awaiting_payment';
  end if;

  if not exists (
    select 1
    from pg_proc procedure
    join pg_namespace namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = 'assert_mentorship_capacity_available'
  ) then
    raise exception
      'Capacity assertion helper was not created';
  end if;
end;
$assert$;

commit;

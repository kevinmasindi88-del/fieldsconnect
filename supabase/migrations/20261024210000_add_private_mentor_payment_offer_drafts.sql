-- Private paid mentorship pricing drafts. Do not publish or alter current offers.
-- Checkout and Paystack payout functions remain independently gated.
create table if not exists public.mentorship_payment_offer_drafts (
  mentor_id uuid not null references public.profiles(id) on delete cascade,
  duration text not null check (duration in ('3_months','6_months','1_year','ongoing')),
  payment_mode text not null check (payment_mode in ('free','paid')),
  price_amount_minor integer not null check (price_amount_minor >= 0),
  currency text not null default 'ZAR' check (currency = 'ZAR'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (mentor_id, duration),
  constraint mentorship_draft_price_valid check (
    (payment_mode = 'free' and price_amount_minor = 0) or
    (payment_mode = 'paid' and price_amount_minor > 0 and duration <> 'ongoing')
  )
);
alter table public.mentorship_payment_offer_drafts enable row level security;
create policy mentorship_payment_drafts_own_select
  on public.mentorship_payment_offer_drafts for select to authenticated
  using (mentor_id = auth.uid());
create policy mentorship_payment_drafts_own_insert
  on public.mentorship_payment_offer_drafts for insert to authenticated
  with check (mentor_id = auth.uid());
create policy mentorship_payment_drafts_own_update
  on public.mentorship_payment_offer_drafts for update to authenticated
  using (mentor_id = auth.uid()) with check (mentor_id = auth.uid());
create trigger mentorship_payment_drafts_updated_at
  before update on public.mentorship_payment_offer_drafts
  for each row execute function public.set_updated_at();
revoke all on public.mentorship_payment_offer_drafts from public, anon;
grant select, insert, update on public.mentorship_payment_offer_drafts to authenticated;

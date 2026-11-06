-- FieldsConnect: baseline independence control for FCModerators.
-- Forward-looking rules only: do not alter historical resolved decisions.
begin;

create or replace function public.enforce_moderation_review_independence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if new.reported_user_id is null then
    return new;
  end if;

  if new.assigned_to = new.reported_user_id and
     (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to) then
    raise exception 'A reported user cannot be assigned their own moderation ticket';
  end if;

  if tg_op = 'UPDATE'
     and (select auth.uid()) = new.reported_user_id
     and (
       new.status is distinct from old.status or
       new.resolution_action is distinct from old.resolution_action or
       new.resolved_by is distinct from old.resolved_by or
       new.escalated_by is distinct from old.escalated_by
     ) then
    raise exception 'The reported user cannot decide or escalate their own ticket';
  end if;

  return new;
end;
$function$;

drop trigger if exists reports_enforce_review_independence on public.reports;
create trigger reports_enforce_review_independence
before insert or update on public.reports
for each row execute function public.enforce_moderation_review_independence();

create or replace function public.prevent_accused_moderation_action()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_reported uuid;
begin
  select r.reported_user_id into v_reported
  from public.reports r where r.id = new.report_id;

  if v_reported is not null
     and (v_reported = new.performed_by or v_reported = (select auth.uid())) then
    raise exception 'A reported user cannot record moderation actions on their own ticket';
  end if;
  return new;
end;
$function$;

drop trigger if exists moderation_action_log_prevent_self_review on public.moderation_action_log;
create trigger moderation_action_log_prevent_self_review
before insert on public.moderation_action_log
for each row execute function public.prevent_accused_moderation_action();

revoke all on function public.enforce_moderation_review_independence() from public, anon, authenticated;
revoke all on function public.prevent_accused_moderation_action() from public, anon, authenticated;

commit;

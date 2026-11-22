-- FieldsConnect post reactions: keep one reaction per member per post.
-- Preserve existing 'like' rows while allowing three additional choices.
alter table public.reactions
  add constraint reactions_supported_types
  check (reaction_type in ('like', 'love', 'thanks', 'applause'));

-- Update must be explicitly scoped to the authenticated reaction owner.
drop policy if exists reactions_update_own on public.reactions;
create policy reactions_update_own
on public.reactions
for update
to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

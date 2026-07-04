-- FieldsConnect Messaging RLS Extension
-- Scope: allow authenticated users to create 1:1 conversations only for accepted connections.

create policy "conversations_insert_for_accepted_connection"
on public.conversations
for insert
to authenticated
with check (
  exists (
    select 1
    from public.connections c
    where c.id = conversations.connection_id
      and c.status = 'accepted'
      and (
        c.requester_id = auth.uid()
        or c.recipient_id = auth.uid()
      )
  )
);

create policy "conversation_members_insert_for_accepted_connection"
on public.conversation_members
for insert
to authenticated
with check (
  exists (
    select 1
    from public.conversations cv
    join public.connections c on c.id = cv.connection_id
    where cv.id = conversation_members.conversation_id
      and c.status = 'accepted'
      and (
        c.requester_id = auth.uid()
        or c.recipient_id = auth.uid()
      )
      and (
        conversation_members.profile_id = c.requester_id
        or conversation_members.profile_id = c.recipient_id
      )
  )
);

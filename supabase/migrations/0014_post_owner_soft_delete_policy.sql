-- Allow authenticated users to edit or soft-delete only their own posts.

create policy "posts_update_own"
on public.posts
for update
to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid());

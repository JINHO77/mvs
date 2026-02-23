-- Enable RLS and minimum policies for student_guardians.
-- Execute in Supabase SQL Editor.

drop policy if exists sg_parent_select_own on public.student_guardians;
drop policy if exists sg_parent_delete_own on public.student_guardians;

alter table public.student_guardians enable row level security;

create policy sg_parent_select_own
on public.student_guardians
for select
to authenticated
using (guardian_id = auth.uid());

create policy sg_parent_delete_own
on public.student_guardians
for delete
to authenticated
using (guardian_id = auth.uid());

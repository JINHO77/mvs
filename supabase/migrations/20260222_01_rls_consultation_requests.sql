-- Enable RLS and enforce parent INSERT scope for consultation_requests.
-- Execute in Supabase SQL Editor.

drop policy if exists cr_parent_insert_own_students on public.consultation_requests;
drop policy if exists cr_parent_select_own on public.consultation_requests;

alter table public.consultation_requests enable row level security;

create policy cr_parent_insert_own_students
on public.consultation_requests
for insert
to authenticated
with check (
  guardian_id = auth.uid()
  and student_id is not null
  and exists (
    select 1
    from public.student_guardians sg
    where sg.guardian_id = auth.uid()
      and sg.student_id = consultation_requests.student_id
  )
);

create policy cr_parent_select_own
on public.consultation_requests
for select
to authenticated
using (guardian_id = auth.uid());

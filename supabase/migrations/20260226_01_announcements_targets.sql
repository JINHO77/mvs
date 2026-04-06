-- Targeted announcements (all/grade/class/student) with RLS-aware visibility.

create table if not exists public.announcement_targets (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  target_type text not null check (target_type in ('all', 'grade', 'class', 'student')),
  grade smallint,
  class_label text,
  student_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  constraint announcement_targets_payload_ck check (
    (target_type = 'all' and grade is null and class_label is null and student_id is null)
    or (target_type = 'grade' and grade is not null and class_label is null and student_id is null)
    or (target_type = 'class' and class_label is not null and grade is null and student_id is null)
    or (target_type = 'student' and student_id is not null and grade is null and class_label is null)
  )
);

create index if not exists idx_announcement_targets_announcement_id on public.announcement_targets(announcement_id);
create index if not exists idx_announcement_targets_target_type on public.announcement_targets(target_type);
create index if not exists idx_announcement_targets_grade on public.announcement_targets(grade) where target_type = 'grade';
create index if not exists idx_announcement_targets_class_label on public.announcement_targets(class_label) where target_type = 'class';
create index if not exists idx_announcement_targets_student_id on public.announcement_targets(student_id) where target_type = 'student';

alter table public.announcement_targets enable row level security;

grant select, insert, update, delete on public.announcement_targets to authenticated;

drop policy if exists at_staff_select on public.announcement_targets;
drop policy if exists at_staff_insert on public.announcement_targets;
drop policy if exists at_staff_update on public.announcement_targets;
drop policy if exists at_staff_delete on public.announcement_targets;
drop policy if exists at_user_select_visible on public.announcement_targets;

create policy at_staff_select
on public.announcement_targets
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role in ('owner', 'teacher')
  )
);

create policy at_staff_insert
on public.announcement_targets
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role in ('owner', 'teacher')
  )
);

create policy at_staff_update
on public.announcement_targets
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role in ('owner', 'teacher')
  )
)
with check (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role in ('owner', 'teacher')
  )
);

create policy at_staff_delete
on public.announcement_targets
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role in ('owner', 'teacher')
  )
);

create policy at_user_select_visible
on public.announcement_targets
for select
to authenticated
using (
  target_type = 'all'
  or exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role = 'student'
      and (
        (announcement_targets.target_type = 'student' and announcement_targets.student_id = me.id)
        or (announcement_targets.target_type = 'grade' and announcement_targets.grade = me.grade)
        or (announcement_targets.target_type = 'class' and announcement_targets.class_label = me.class_label)
      )
  )
  or exists (
    select 1
    from public.profiles me
    join public.student_guardians sg
      on sg.guardian_id = me.id
    join public.profiles st
      on st.id = sg.student_id
    where me.id = auth.uid()
      and me.role = 'guardian'
      and (
        (announcement_targets.target_type = 'student' and announcement_targets.student_id = st.id)
        or (announcement_targets.target_type = 'grade' and announcement_targets.grade = st.grade)
        or (announcement_targets.target_type = 'class' and announcement_targets.class_label = st.class_label)
      )
  )
);

create or replace function public.can_current_user_read_announcement(p_announcement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.profiles me
      where me.id = auth.uid()
        and me.role in ('owner', 'teacher')
    )
    or not exists (
      select 1
      from public.announcement_targets t0
      where t0.announcement_id = p_announcement_id
    )
    or exists (
      select 1
      from public.announcement_targets t
      where t.announcement_id = p_announcement_id
        and (
          t.target_type = 'all'
          or exists (
            select 1
            from public.profiles me
            where me.id = auth.uid()
              and me.role = 'student'
              and (
                (t.target_type = 'student' and t.student_id = me.id)
                or (t.target_type = 'grade' and t.grade = me.grade)
                or (t.target_type = 'class' and t.class_label = me.class_label)
              )
          )
          or exists (
            select 1
            from public.profiles me
            join public.student_guardians sg
              on sg.guardian_id = me.id
            join public.profiles st
              on st.id = sg.student_id
            where me.id = auth.uid()
              and me.role = 'guardian'
              and (
                (t.target_type = 'student' and t.student_id = st.id)
                or (t.target_type = 'grade' and t.grade = st.grade)
                or (t.target_type = 'class' and t.class_label = st.class_label)
              )
          )
        )
    );
$$;

grant execute on function public.can_current_user_read_announcement(uuid) to authenticated;

alter table public.announcements enable row level security;
drop policy if exists announcements_select_visible_targets on public.announcements;

create policy announcements_select_visible_targets
as restrictive
on public.announcements
for select
to authenticated
using (public.can_current_user_read_announcement(id));

create or replace function public.get_visible_announcements(p_limit integer default null)
returns table (
  id uuid,
  title text,
  body text,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select a.id, a.title, a.body, a.created_at
  from public.announcements a
  where public.can_current_user_read_announcement(a.id)
  order by a.created_at desc
  limit p_limit;
$$;

grant execute on function public.get_visible_announcements(integer) to authenticated;

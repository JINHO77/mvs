-- Enforce school_level consistency for grade/class targets and tighten visibility matching.

alter table if exists public.announcement_targets
  drop constraint if exists announcement_targets_payload_ck;

alter table if exists public.announcement_targets
  add constraint announcement_targets_payload_ck check (
    (target_type = 'all' and school_level is null and grade is null and class_label is null and student_id is null)
    or (target_type = 'school_level' and school_level is not null and grade is null and class_label is null and student_id is null)
    or (target_type = 'grade' and school_level is not null and grade is not null and class_label is null and student_id is null)
    or (target_type = 'class' and school_level is not null and grade is not null and class_label is not null and student_id is null)
    or (target_type = 'student' and student_id is not null and school_level is null and grade is null and class_label is null)
  );

create or replace function public.can_current_user_read_announcement(p_announcement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select id, role, school_level, grade, class_label
    from public.profiles
    where id = auth.uid()
  ),
  role_gate as (
    select 1
    from public.announcements a
    join me on true
    where a.id = p_announcement_id
      and (
        me.role in ('owner', 'teacher')
        or (me.role = 'student' and coalesce(a.audience_role, 'all') in ('all', 'student'))
        or (me.role in ('parent', 'guardian') and coalesce(a.audience_role, 'all') in ('all', 'parent'))
      )
  ),
  has_target as (
    select exists (
      select 1
      from public.announcement_targets t0
      where t0.announcement_id = p_announcement_id
    ) as value
  ),
  student_target_match as (
    select exists (
      select 1
      from public.announcement_targets t
      join me on me.role = 'student'
      where t.announcement_id = p_announcement_id
        and (
          t.target_type = 'all'
          or (t.target_type = 'student' and t.student_id = me.id)
          or (t.target_type = 'school_level' and t.school_level = me.school_level)
          or (t.target_type = 'grade' and t.school_level = me.school_level and t.grade = me.grade)
          or (
            t.target_type = 'class'
            and t.school_level = me.school_level
            and t.grade = me.grade
            and t.class_label = me.class_label
          )
        )
    ) as value
  )
  select
    exists (select 1 from role_gate)
    and (
      exists (select 1 from me where role in ('owner', 'teacher'))
      or exists (select 1 from me where role in ('parent', 'guardian'))
      or (
        exists (select 1 from me where role = 'student')
        and (
          not (select value from has_target)
          or (select value from student_target_match)
        )
      )
    );
$$;

grant execute on function public.can_current_user_read_announcement(uuid) to authenticated;


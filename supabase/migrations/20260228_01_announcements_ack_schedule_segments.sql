-- ACK + scheduled announcement visibility, recipient sample RPC, and reusable segments.

alter table if exists public.announcements
  add column if not exists requires_ack boolean not null default false;

alter table if exists public.announcements
  add column if not exists scheduled_at timestamptz;

create index if not exists idx_announcements_scheduled_at
  on public.announcements(scheduled_at);

alter table if exists public.announcement_reads
  add column if not exists read_at timestamptz;

alter table if exists public.announcement_reads
  add column if not exists acknowledged_at timestamptz;

-- Backfill read_at for legacy rows.
update public.announcement_reads
set read_at = coalesce(read_at, created_at, now())
where read_at is null;

-- Align visibility logic so parent/guardian also honor target filters.
create or replace function public.can_current_user_read_announcement(p_announcement_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select id, role, school_level, grade, btrim(coalesce(class_label, '')) as class_label
    from public.profiles
    where id = auth.uid()
  ),
  arow as (
    select
      a.id,
      coalesce(a.audience_role, 'all') as audience_role
    from public.announcements a
    where a.id = p_announcement_id
  ),
  linked_students as (
    select
      st.id,
      st.school_level,
      st.grade,
      btrim(coalesce(st.class_label, '')) as class_label
    from me
    join public.student_guardians sg
      on sg.guardian_id = me.id
    join public.profiles st
      on st.id = sg.student_id
    where me.role in ('parent', 'guardian')
      and st.role = 'student'
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
            and btrim(coalesce(t.class_label, '')) = me.class_label
          )
        )
    ) as value
  ),
  parent_target_match as (
    select exists (
      select 1
      from public.announcement_targets t
      join linked_students ls on true
      where t.announcement_id = p_announcement_id
        and (
          t.target_type = 'all'
          or (t.target_type = 'student' and t.student_id = ls.id)
          or (t.target_type = 'school_level' and t.school_level = ls.school_level)
          or (t.target_type = 'grade' and t.school_level = ls.school_level and t.grade = ls.grade)
          or (
            t.target_type = 'class'
            and t.school_level = ls.school_level
            and t.grade = ls.grade
            and btrim(coalesce(t.class_label, '')) = ls.class_label
          )
        )
    ) as value
  ),
  role_allowed as (
    select exists (
      select 1
      from arow a
      join me on true
      where
        me.role in ('owner', 'teacher')
        or (me.role = 'student' and a.audience_role in ('all', 'student'))
        or (me.role in ('parent', 'guardian') and a.audience_role in ('all', 'parent'))
    ) as value
  )
  select
    exists (select 1 from arow)
    and (select value from role_allowed)
    and (
      exists (select 1 from me where role in ('owner', 'teacher'))
      or not (select value from has_target)
      or (
        exists (select 1 from me where role = 'student')
        and (select value from student_target_match)
      )
      or (
        exists (select 1 from me where role in ('parent', 'guardian'))
        and (select value from parent_target_match)
      )
    );
$$;

grant execute on function public.can_current_user_read_announcement(uuid) to authenticated;

-- Keep target row visibility aligned with current role names.
drop policy if exists at_user_select_visible on public.announcement_targets;

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
        or (announcement_targets.target_type = 'school_level' and announcement_targets.school_level = me.school_level)
        or (
          announcement_targets.target_type = 'grade'
          and announcement_targets.school_level = me.school_level
          and announcement_targets.grade = me.grade
        )
        or (
          announcement_targets.target_type = 'class'
          and announcement_targets.school_level = me.school_level
          and announcement_targets.grade = me.grade
          and btrim(coalesce(announcement_targets.class_label, '')) = btrim(coalesce(me.class_label, ''))
        )
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
      and me.role in ('parent', 'guardian')
      and (
        (announcement_targets.target_type = 'student' and announcement_targets.student_id = st.id)
        or (announcement_targets.target_type = 'school_level' and announcement_targets.school_level = st.school_level)
        or (
          announcement_targets.target_type = 'grade'
          and announcement_targets.school_level = st.school_level
          and announcement_targets.grade = st.grade
        )
        or (
          announcement_targets.target_type = 'class'
          and announcement_targets.school_level = st.school_level
          and announcement_targets.grade = st.grade
          and btrim(coalesce(announcement_targets.class_label, '')) = btrim(coalesce(st.class_label, ''))
        )
      )
  )
);

create or replace function public.get_visible_announcements(p_limit integer default null)
returns table (
  id uuid,
  title text,
  body text,
  created_at timestamptz,
  requires_ack boolean,
  scheduled_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    a.id,
    a.title,
    a.body,
    a.created_at,
    coalesce(a.requires_ack, false) as requires_ack,
    a.scheduled_at
  from public.announcements a
  where public.can_current_user_read_announcement(a.id)
    and coalesce(a.is_deleted, false) = false
    and (a.scheduled_at is null or a.scheduled_at <= now())
  order by a.created_at desc
  limit p_limit;
$$;

grant execute on function public.get_visible_announcements(integer) to authenticated;

create or replace function public.get_unread_announcement_count()
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::integer
  from public.announcements a
  where public.can_current_user_read_announcement(a.id)
    and coalesce(a.is_deleted, false) = false
    and (a.scheduled_at is null or a.scheduled_at <= now())
    and not exists (
      select 1
      from public.announcement_reads ar
      where ar.announcement_id = a.id
        and ar.legacy_reader_id = auth.uid()
        and ar.read_at is not null
    );
$$;

grant execute on function public.get_unread_announcement_count() to authenticated;

create or replace function public.get_unacknowledged_announcements(p_limit integer default null)
returns table (
  id uuid,
  title text,
  body text,
  created_at timestamptz,
  requires_ack boolean,
  scheduled_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    a.id,
    a.title,
    a.body,
    a.created_at,
    coalesce(a.requires_ack, false) as requires_ack,
    a.scheduled_at
  from public.announcements a
  left join public.announcement_reads ar
    on ar.announcement_id = a.id
    and ar.legacy_reader_id = auth.uid()
  where public.can_current_user_read_announcement(a.id)
    and coalesce(a.is_deleted, false) = false
    and coalesce(a.requires_ack, false) = true
    and (a.scheduled_at is null or a.scheduled_at <= now())
    and ar.acknowledged_at is null
  order by a.created_at desc
  limit p_limit;
$$;

grant execute on function public.get_unacknowledged_announcements(integer) to authenticated;

create or replace function public.get_target_students_for_announcement(
  p_target_type text,
  p_school_level text default null,
  p_grade integer default null,
  p_class_label text default null,
  p_student_id uuid default null
)
returns table (
  student_id uuid,
  school_level text,
  grade integer,
  class_label text,
  name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id as student_id,
    p.school_level,
    p.grade::integer as grade,
    p.class_label,
    p.name
  from public.profiles p
  where p.role = 'student'
    and (
      p_target_type = 'all'
      or (p_target_type = 'school_level' and p.school_level = p_school_level)
      or (p_target_type = 'grade' and p.school_level = p_school_level and p.grade = p_grade)
      or (
        p_target_type = 'class'
        and p.school_level = p_school_level
        and p.grade = p_grade
        and btrim(coalesce(p.class_label, '')) = btrim(coalesce(p_class_label, ''))
      )
      or (p_target_type = 'student' and p.id = p_student_id)
    );
$$;

grant execute on function public.get_target_students_for_announcement(text, text, integer, text, uuid) to authenticated;

create or replace function public.get_announcement_recipient_count(
  p_audience_role text,
  p_target_type text,
  p_school_level text default null,
  p_grade integer default null,
  p_class_label text default null,
  p_student_id uuid default null
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select role
    from public.profiles
    where id = auth.uid()
  ),
  student_set as (
    select *
    from public.get_target_students_for_announcement(
      p_target_type,
      p_school_level,
      p_grade,
      p_class_label,
      p_student_id
    )
  ),
  student_recipients as (
    select
      s.student_id as user_id,
      'student'::text as role
    from student_set s
  ),
  parent_recipients as (
    select distinct
      g.id as user_id,
      'parent'::text as role
    from student_set s
    join public.student_guardians sg
      on sg.student_id = s.student_id
    join public.profiles g
      on g.id = sg.guardian_id
    where g.role in ('parent', 'guardian')
  ),
  merged as (
    select * from student_recipients where p_audience_role in ('student', 'all')
    union
    select * from parent_recipients where p_audience_role in ('parent', 'all')
  )
  select
    case
      when exists (select 1 from me where role in ('owner', 'teacher'))
        then (select count(*)::integer from merged)
      else 0
    end;
$$;

grant execute on function public.get_announcement_recipient_count(text, text, text, integer, text, uuid) to authenticated;

create or replace function public.get_announcement_recipient_sample(
  p_audience_role text,
  p_target_type text,
  p_school_level text default null,
  p_grade integer default null,
  p_class_label text default null,
  p_student_id uuid default null
)
returns table (
  user_id uuid,
  role text,
  school_level text,
  grade integer,
  class_label text,
  name text
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select role
    from public.profiles
    where id = auth.uid()
  ),
  student_set as (
    select *
    from public.get_target_students_for_announcement(
      p_target_type,
      p_school_level,
      p_grade,
      p_class_label,
      p_student_id
    )
  ),
  student_recipients as (
    select
      s.student_id as user_id,
      'student'::text as role,
      s.school_level,
      s.grade,
      s.class_label,
      s.name
    from student_set s
  ),
  parent_recipients as (
    select
      g.id as user_id,
      'parent'::text as role,
      min(s.school_level) as school_level,
      min(s.grade)::integer as grade,
      min(s.class_label) as class_label,
      g.name
    from student_set s
    join public.student_guardians sg
      on sg.student_id = s.student_id
    join public.profiles g
      on g.id = sg.guardian_id
    where g.role in ('parent', 'guardian')
    group by g.id, g.name
  ),
  merged as (
    select * from student_recipients where p_audience_role in ('student', 'all')
    union
    select * from parent_recipients where p_audience_role in ('parent', 'all')
  )
  select
    m.user_id,
    m.role,
    m.school_level,
    m.grade,
    m.class_label,
    m.name
  from merged m
  where exists (select 1 from me where role in ('owner', 'teacher'))
  order by m.role, m.name nulls last, m.user_id
  limit 10;
$$;

grant execute on function public.get_announcement_recipient_sample(text, text, text, integer, text, uuid) to authenticated;

create table if not exists public.announcement_segments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  audience_role text not null check (audience_role in ('all', 'student', 'parent')),
  target_type text not null check (target_type in ('all', 'school_level', 'grade', 'class', 'student')),
  school_level text,
  grade integer,
  class_label text,
  student_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_announcement_segments_owner_created
  on public.announcement_segments(owner_id, created_at desc);

alter table public.announcement_segments enable row level security;

grant select, insert, update, delete on public.announcement_segments to authenticated;

drop policy if exists announcement_segments_staff_select_own on public.announcement_segments;
drop policy if exists announcement_segments_staff_insert_own on public.announcement_segments;
drop policy if exists announcement_segments_staff_update_own on public.announcement_segments;
drop policy if exists announcement_segments_staff_delete_own on public.announcement_segments;

create policy announcement_segments_staff_select_own
on public.announcement_segments
for select
to authenticated
using (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role in ('owner', 'teacher')
  )
);

create policy announcement_segments_staff_insert_own
on public.announcement_segments
for insert
to authenticated
with check (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role in ('owner', 'teacher')
  )
);

create policy announcement_segments_staff_update_own
on public.announcement_segments
for update
to authenticated
using (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role in ('owner', 'teacher')
  )
)
with check (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role in ('owner', 'teacher')
  )
);

create policy announcement_segments_staff_delete_own
on public.announcement_segments
for delete
to authenticated
using (
  owner_id = auth.uid()
  and exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role in ('owner', 'teacher')
  )
);

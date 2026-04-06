-- Harden announcement visibility and reads semantics.

-- 1) announcement_targets: add school_level target type support.
alter table if exists public.announcement_targets
  add column if not exists school_level text;

alter table if exists public.announcement_targets
  drop constraint if exists announcement_targets_payload_ck;

alter table if exists public.announcement_targets
  add constraint announcement_targets_payload_ck check (
    (target_type = 'all' and school_level is null and grade is null and class_label is null and student_id is null)
    or (target_type = 'school_level' and school_level is not null and grade is null and class_label is null and student_id is null)
    or (target_type = 'grade' and grade is not null and school_level is null and class_label is null and student_id is null)
    or (target_type = 'class' and class_label is not null and school_level is null and grade is null and student_id is null)
    or (target_type = 'student' and student_id is not null and school_level is null and grade is null and class_label is null)
  );

alter table if exists public.announcement_targets
  drop constraint if exists announcement_targets_target_type_check;

alter table if exists public.announcement_targets
  add constraint announcement_targets_target_type_check
  check (target_type in ('all', 'school_level', 'grade', 'class', 'student'));

create index if not exists idx_announcement_targets_school_level
  on public.announcement_targets(school_level)
  where target_type = 'school_level';

-- 2) Recreate visibility function with EXISTS-based logic (no duplicate risk).
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
  linked_students as (
    select st.id, st.school_level, st.grade, st.class_label
    from me
    join public.student_guardians sg
      on sg.guardian_id = me.id
    join public.profiles st
      on st.id = sg.student_id
    where me.role = 'guardian'
  )
  select
    exists (
      select 1
      from me
      where role in ('owner', 'teacher')
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
          or (
            t.target_type = 'student'
            and exists (
              select 1
              from me
              where role = 'student'
                and id = t.student_id
            )
          )
          or (
            t.target_type = 'school_level'
            and exists (
              select 1
              from me
              where role = 'student'
                and school_level = t.school_level
            )
          )
          or (
            t.target_type = 'grade'
            and exists (
              select 1
              from me
              where role = 'student'
                and grade = t.grade
            )
          )
          or (
            t.target_type = 'class'
            and exists (
              select 1
              from me
              where role = 'student'
                and class_label = t.class_label
            )
          )
          or (
            t.target_type = 'student'
            and exists (
              select 1 from linked_students ls where ls.id = t.student_id
            )
          )
          or (
            t.target_type = 'school_level'
            and exists (
              select 1 from linked_students ls where ls.school_level = t.school_level
            )
          )
          or (
            t.target_type = 'grade'
            and exists (
              select 1 from linked_students ls where ls.grade = t.grade
            )
          )
          or (
            t.target_type = 'class'
            and exists (
              select 1 from linked_students ls where ls.class_label = t.class_label
            )
          )
        )
    );
$$;

grant execute on function public.can_current_user_read_announcement(uuid) to authenticated;

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

-- 3) announcement_reads normalize: legacy_reader_id + unique(announcement_id, legacy_reader_id)
create table if not exists public.announcement_reads (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  legacy_reader_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (announcement_id, legacy_reader_id)
);

alter table if exists public.announcement_reads
  add column if not exists legacy_reader_id uuid;

-- Backfill from legacy user_id column if it exists.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'announcement_reads'
      and column_name = 'user_id'
  ) then
    execute 'update public.announcement_reads set legacy_reader_id = user_id where legacy_reader_id is null';
  end if;
end $$;

alter table if exists public.announcement_reads
  alter column legacy_reader_id set not null;

delete from public.announcement_reads a
using public.announcement_reads b
where a.ctid < b.ctid
  and a.announcement_id = b.announcement_id
  and a.legacy_reader_id = b.legacy_reader_id;

create unique index if not exists uq_announcement_reads_announcement_reader
  on public.announcement_reads(announcement_id, legacy_reader_id);

-- Keep old unique key compatibility if legacy PK existed differently.
alter table if exists public.announcement_reads
  drop constraint if exists announcement_reads_pkey;

alter table if exists public.announcement_reads
  add constraint announcement_reads_pkey primary key using index uq_announcement_reads_announcement_reader;

alter table if exists public.announcement_reads enable row level security;

grant select, insert, update, delete on public.announcement_reads to authenticated;

drop policy if exists ar_select_own on public.announcement_reads;
drop policy if exists ar_insert_own on public.announcement_reads;
drop policy if exists ar_update_own on public.announcement_reads;
drop policy if exists ar_delete_own on public.announcement_reads;

create policy ar_select_own
on public.announcement_reads
for select
to authenticated
using (legacy_reader_id = auth.uid());

create policy ar_insert_own
on public.announcement_reads
for insert
to authenticated
with check (legacy_reader_id = auth.uid());

create policy ar_update_own
on public.announcement_reads
for update
to authenticated
using (legacy_reader_id = auth.uid())
with check (legacy_reader_id = auth.uid());

create policy ar_delete_own
on public.announcement_reads
for delete
to authenticated
using (legacy_reader_id = auth.uid());

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
    and not exists (
      select 1
      from public.announcement_reads ar
      where ar.announcement_id = a.id
        and ar.legacy_reader_id = auth.uid()
    );
$$;

grant execute on function public.get_unread_announcement_count() to authenticated;

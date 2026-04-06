alter table if exists public.announcements
  add column if not exists category text not null default 'general';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'announcements_category_ck'
      and conrelid = 'public.announcements'::regclass
  ) then
    alter table public.announcements
      add constraint announcements_category_ck
      check (category in ('general', 'notice', 'homework', 'report'));
  end if;
end
$$;

alter table if exists public.announcement_targets
  add column if not exists school_level text;

alter table if exists public.announcement_targets
  drop constraint if exists announcement_targets_payload_ck;

do $$
declare
  rec record;
begin
  for rec in
    select conname
    from pg_constraint
    where conrelid = 'public.announcement_targets'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%target_type%'
  loop
    execute format('alter table public.announcement_targets drop constraint if exists %I', rec.conname);
  end loop;
end
$$;

alter table public.announcement_targets
  add constraint announcement_targets_target_type_ck
  check (target_type in ('all', 'school_level', 'grade', 'class', 'student'));

alter table public.announcement_targets
  add constraint announcement_targets_payload_ck
  check (
    (target_type = 'all' and school_level is null and grade is null and class_label is null and student_id is null)
    or (target_type = 'school_level' and school_level is not null and grade is null and class_label is null and student_id is null)
    or (target_type = 'grade' and school_level is not null and grade is not null and class_label is null and student_id is null)
    or (target_type = 'class' and school_level is not null and grade is not null and class_label is not null and student_id is null)
    or (target_type = 'student' and student_id is not null and school_level is null and grade is null and class_label is null)
  ) not valid;

create table if not exists public.announcement_direct_recipients (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (announcement_id, recipient_id)
);

alter table public.announcement_direct_recipients enable row level security;
grant select, insert, delete on public.announcement_direct_recipients to authenticated;

drop policy if exists adr_staff_all on public.announcement_direct_recipients;
drop policy if exists adr_recipient_select on public.announcement_direct_recipients;

create policy adr_staff_all
on public.announcement_direct_recipients
for all
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

create policy adr_recipient_select
on public.announcement_direct_recipients
for select
to authenticated
using (recipient_id = auth.uid());

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
  announcement_row as (
    select id, coalesce(audience_role, 'all') as audience_role
    from public.announcements
    where id = p_announcement_id
  ),
  has_target as (
    select exists(select 1 from public.announcement_targets where announcement_id = p_announcement_id) as value
  ),
  direct_match as (
    select exists(
      select 1
      from public.announcement_direct_recipients adr
      where adr.announcement_id = p_announcement_id
        and adr.recipient_id = auth.uid()
    ) as value
  ),
  target_match as (
    select exists(
      select 1
      from public.announcement_targets t
      join me on true
      where t.announcement_id = p_announcement_id
        and (
          t.target_type = 'all'
          or (
            me.role = 'student'
            and (
              (t.target_type = 'student' and t.student_id = me.id)
              or (t.target_type = 'school_level' and t.school_level = me.school_level)
              or (t.target_type = 'grade' and t.school_level = me.school_level and t.grade = me.grade)
              or (t.target_type = 'class' and t.school_level = me.school_level and t.grade = me.grade and t.class_label = me.class_label)
            )
          )
          or (
            me.role in ('parent', 'guardian')
            and exists (
              select 1
              from public.student_guardians sg
              join public.profiles st on st.id = sg.student_id
              where sg.guardian_id = me.id
                and (
                  (t.target_type = 'student' and t.student_id = st.id)
                  or (t.target_type = 'school_level' and t.school_level = st.school_level)
                  or (t.target_type = 'grade' and t.school_level = st.school_level and t.grade = st.grade)
                  or (t.target_type = 'class' and t.school_level = st.school_level and t.grade = st.grade and t.class_label = st.class_label)
                )
            )
          )
        )
    ) as value
  )
  select exists(select 1 from me)
    and (
      exists(select 1 from me where role in ('owner', 'teacher'))
      or (select value from direct_match)
      or (
        exists(
          select 1
          from me, announcement_row a
          where (me.role = 'student' and a.audience_role in ('all', 'student'))
             or (me.role in ('parent', 'guardian') and a.audience_role in ('all', 'parent'))
        )
        and (
          not (select value from has_target)
          or (select value from target_match)
        )
      )
    );
$$;

grant execute on function public.can_current_user_read_announcement(uuid) to authenticated;

create or replace function public.get_announcement_snapshot_recipients(p_announcement_id uuid)
returns table (recipient_id uuid, cutoff_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with a as (
    select id, coalesce(audience_role, 'all') as audience_role, created_at
    from public.announcements
    where id = p_announcement_id
      and coalesce(is_deleted, false) = false
  ),
  has_target as (
    select exists(select 1 from public.announcement_targets where announcement_id = p_announcement_id) as value
  ),
  student_candidates as (
    select st.id as student_id
    from public.profiles st
    join a on true
    where st.role = 'student'
      and (
        not (select value from has_target)
        or exists (
          select 1
          from public.announcement_targets t
          where t.announcement_id = p_announcement_id
            and (
              t.target_type = 'all'
              or (t.target_type = 'student' and t.student_id = st.id)
              or (t.target_type = 'school_level' and t.school_level = st.school_level)
              or (t.target_type = 'grade' and t.school_level = st.school_level and t.grade = st.grade)
              or (t.target_type = 'class' and t.school_level = st.school_level and t.grade = st.grade and btrim(coalesce(t.class_label, '')) = btrim(coalesce(st.class_label, '')))
            )
        )
      )
  ),
  student_recipients as (
    select st.id as recipient_id, st.created_at as cutoff_at
    from student_candidates sc
    join public.profiles st on st.id = sc.student_id
    join a on true
    where a.audience_role in ('all', 'student')
  ),
  parent_recipients as (
    select g.id as recipient_id, coalesce(min(sg.created_at), g.created_at) as cutoff_at
    from student_candidates sc
    join public.student_guardians sg on sg.student_id = sc.student_id
    join public.profiles g on g.id = sg.guardian_id
    join a on true
    where a.audience_role in ('all', 'parent')
      and g.role in ('parent', 'guardian')
    group by g.id, g.created_at
  ),
  direct_recipients as (
    select adr.recipient_id, a.created_at as cutoff_at
    from public.announcement_direct_recipients adr
    join a on a.id = adr.announcement_id
  ),
  merged as (
    select * from student_recipients
    union all
    select * from parent_recipients
    union all
    select * from direct_recipients
  )
  select recipient_id, min(cutoff_at) as cutoff_at
  from merged
  group by recipient_id;
$$;

grant execute on function public.get_announcement_snapshot_recipients(uuid) to authenticated;

drop trigger if exists trg_refresh_deliveries_on_direct_recipient on public.announcement_direct_recipients;
create trigger trg_refresh_deliveries_on_direct_recipient
after insert or update or delete
on public.announcement_direct_recipients
for each row
execute function public.tg_refresh_announcement_read_rollups();

drop function if exists public.get_my_announcements(integer, integer, text, text, text, boolean, boolean);
create or replace function public.get_my_announcements(
  p_limit integer default 20,
  p_offset integer default 0,
  p_query text default null,
  p_sort text default 'latest',
  p_status text default 'all',
  p_has_attachments boolean default null,
  p_include_before_approval boolean default false
)
returns jsonb
language sql
security definer
set search_path to 'public'
as $$
  with me as (
    select p.id, p.created_at, p.approved_at, coalesce(p.account_status, 'active') as account_status
    from public.profiles p
    where p.id = auth.uid()
  ),
  visible as (
    select a.*
    from public.announcements a
    join me on true
    where coalesce(a.is_deleted, false) = false
      and (a.scheduled_at is null or a.scheduled_at <= now())
      and me.account_status = 'active'
      and (p_include_before_approval = true or a.created_at >= coalesce(me.approved_at, me.created_at))
      and public.can_current_user_read_announcement(a.id)
      and (p_query is null or a.title ilike '%' || p_query || '%' or a.body ilike '%' || p_query || '%')
  ),
  enriched as (
    select
      v.id, v.title, v.body, v.created_at, coalesce(v.requires_ack, false) as requires_ack, v.scheduled_at,
      coalesce(v.audience_role, 'all') as audience_role, coalesce(v.category, 'general') as category,
      r.read_at, r.acknowledged_at, r.is_pinned,
      exists (select 1 from public.announcement_attachments aa where aa.announcement_id = v.id and coalesce(aa.is_deleted, false) = false) as has_attachments
    from visible v
    left join public.announcement_reads r on r.announcement_id = v.id and r.user_id = auth.uid()
  ),
  filtered as (
    select * from enriched
    where (p_has_attachments is null or has_attachments = p_has_attachments)
      and (
        p_status = 'all'
        or (p_status = 'unread' and read_at is null)
        or (p_status = 'unacknowledged' and requires_ack = true and acknowledged_at is null)
        or (p_status = 'pinned' and coalesce(is_pinned, false) = true)
      )
  ),
  total_counts as (
    select
      count(*)::int as total,
      count(*) filter (where read_at is null)::int as unread,
      count(*) filter (where requires_ack = true and acknowledged_at is null)::int as unacknowledged,
      count(*) filter (where coalesce(is_pinned, false) = true)::int as pinned,
      count(*) filter (where has_attachments = true)::int as with_attachments
    from enriched
  ),
  sliced as (
    select *
    from filtered
    order by case when p_sort = 'oldest' then created_at end asc, case when p_sort <> 'oldest' then created_at end desc
    limit greatest(coalesce(p_limit, 20), 0)
    offset greatest(coalesce(p_offset, 0), 0)
  )
  select jsonb_build_object(
    'items',
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'title', s.title, 'body', s.body, 'created_at', s.created_at,
        'requires_ack', s.requires_ack, 'scheduled_at', s.scheduled_at, 'audience_role', s.audience_role,
        'category', s.category, 'read_at', s.read_at, 'acknowledged_at', s.acknowledged_at,
        'is_read', s.read_at is not null, 'is_acknowledged', s.acknowledged_at is not null,
        'is_pinned', coalesce(s.is_pinned, false), 'has_attachments', s.has_attachments,
        'attachment_count', (select count(*)::int from public.announcement_attachments aa where aa.announcement_id = s.id and coalesce(aa.is_deleted, false) = false),
        'target_summary', coalesce((select string_agg(
          case
            when t.target_type = 'all' then '?꾩껜'
            when t.target_type = 'school_level' then coalesce(t.school_level, '?숆탳湲?)
            when t.target_type = 'grade' then concat(coalesce(t.school_level, ''), ' ', coalesce(t.grade::text, '-'), '?숇뀈')
            when t.target_type = 'class' then concat(coalesce(t.school_level, ''), ' ', coalesce(t.grade::text, '-'), '?숇뀈 ', coalesce(t.class_label, '-'), '諛?)
            when t.target_type = 'student' then '?숈깮 媛쒕퀎'
            else t.target_type
          end, ', ')
          from public.announcement_targets t where t.announcement_id = s.id), '-')
      )) from sliced s), '[]'::jsonb),
    'counts',
    (select jsonb_build_object('total', coalesce(tc.total, 0), 'unread', coalesce(tc.unread, 0), 'unacknowledged', coalesce(tc.unacknowledged, 0), 'pinned', coalesce(tc.pinned, 0), 'with_attachments', coalesce(tc.with_attachments, 0)) from total_counts tc)
  );
$$;

grant execute on function public.get_my_announcements(integer, integer, text, text, text, boolean, boolean)
to authenticated;

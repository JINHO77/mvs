-- B -> A -> C: mailbox RPC stabilization + cutoff + delivery snapshot.

-- 1) student_guardians.created_at guard
alter table if exists public.student_guardians
  add column if not exists created_at timestamptz not null default now();

-- 2) announcement_reads standard columns
alter table if exists public.announcement_reads
  add column if not exists read_at timestamptz;

alter table if exists public.announcement_reads
  add column if not exists acknowledged_at timestamptz;

alter table if exists public.announcement_reads
  add column if not exists archived_at timestamptz;

update public.announcement_reads
set read_at = coalesce(read_at, created_at, now())
where read_at is null;

-- Keep legacy user_id column (if present) dedup-safe without breaking current legacy_reader_id schema.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'announcement_reads'
      and column_name = 'user_id'
  ) then
    execute '
      create unique index if not exists uq_announcement_reads_user_announcement
      on public.announcement_reads(user_id, announcement_id)
      where user_id is not null
    ';
  end if;
end
$$;

create unique index if not exists uq_announcement_reads_reader_announcement
  on public.announcement_reads(legacy_reader_id, announcement_id)
  where legacy_reader_id is not null;

-- 3) delivery snapshot table
create table if not exists public.announcement_read_rollups (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  delivered_at timestamptz not null default now(),
  read_at timestamptz,
  acknowledged_at timestamptz,
  archived_at timestamptz,
  primary key (announcement_id, recipient_id)
);

create index if not exists idx_announcement_read_rollups_recipient_delivered
  on public.announcement_read_rollups(recipient_id, delivered_at desc);

create index if not exists idx_announcement_read_rollups_recipient_archived
  on public.announcement_read_rollups(recipient_id, archived_at);

alter table public.announcement_read_rollups enable row level security;

grant select, insert, update, delete on public.announcement_read_rollups to authenticated;

drop policy if exists ad_select_own on public.announcement_read_rollups;
drop policy if exists ad_update_own on public.announcement_read_rollups;
drop policy if exists ad_insert_own on public.announcement_read_rollups;
drop policy if exists ad_delete_own on public.announcement_read_rollups;
drop policy if exists ad_staff_all on public.announcement_read_rollups;

create policy ad_select_own
on public.announcement_read_rollups
for select
to authenticated
using (recipient_id = auth.uid());

create policy ad_insert_own
on public.announcement_read_rollups
for insert
to authenticated
with check (recipient_id = auth.uid());

create policy ad_update_own
on public.announcement_read_rollups
for update
to authenticated
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

create policy ad_delete_own
on public.announcement_read_rollups
for delete
to authenticated
using (recipient_id = auth.uid());

create policy ad_staff_all
on public.announcement_read_rollups
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

-- 4) recipient calculator (snapshot source of truth)
create or replace function public.get_announcement_snapshot_recipients(p_announcement_id uuid)
returns table (
  recipient_id uuid,
  cutoff_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with a as (
    select
      x.id,
      coalesce(x.audience_role, 'all') as audience_role,
      x.created_at
    from public.announcements x
    where x.id = p_announcement_id
      and coalesce(x.is_deleted, false) = false
  ),
  has_target as (
    select exists (
      select 1
      from public.announcement_targets t
      where t.announcement_id = p_announcement_id
    ) as value
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
              or (
                t.target_type = 'class'
                and t.school_level = st.school_level
                and t.grade = st.grade
                and btrim(coalesce(t.class_label, '')) = btrim(coalesce(st.class_label, ''))
              )
            )
        )
      )
  ),
  student_recipients as (
    select
      st.id as recipient_id,
      coalesce(
        nullif(to_jsonb(st) ->> 'approved_at', '')::timestamptz,
        st.created_at
      ) as cutoff_at
    from student_candidates sc
    join public.profiles st
      on st.id = sc.student_id
    join a on true
    where a.audience_role in ('all', 'student')
  ),
  parent_recipients as (
    select
      g.id as recipient_id,
      coalesce(min(sg.created_at), g.created_at) as cutoff_at
    from student_candidates sc
    join public.student_guardians sg
      on sg.student_id = sc.student_id
    join public.profiles g
      on g.id = sg.guardian_id
    join a on true
    where a.audience_role in ('all', 'parent')
      and g.role in ('parent', 'guardian')
    group by g.id, g.created_at
  ),
  merged as (
    select * from student_recipients
    union all
    select * from parent_recipients
  )
  select
    m.recipient_id,
    min(m.cutoff_at) as cutoff_at
  from merged m
  group by m.recipient_id;
$$;

grant execute on function public.get_announcement_snapshot_recipients(uuid) to authenticated;

-- 5) refresh deliveries for one announcement
create or replace function public.refresh_announcement_read_rollups(p_announcement_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.announcement_read_rollups d
  where d.announcement_id = p_announcement_id;

  insert into public.announcement_read_rollups (
    announcement_id,
    recipient_id,
    delivered_at,
    read_at,
    acknowledged_at,
    archived_at
  )
  select
    a.id,
    r.recipient_id,
    a.created_at as delivered_at,
    ar.read_at,
    ar.acknowledged_at,
    ar.archived_at
  from public.announcements a
  join public.get_announcement_snapshot_recipients(a.id) r on true
  left join public.announcement_reads ar
    on ar.announcement_id = a.id
    and ar.legacy_reader_id = r.recipient_id
  where a.id = p_announcement_id
    and a.created_at >= coalesce(r.cutoff_at, a.created_at)
  on conflict (announcement_id, recipient_id) do update
  set
    delivered_at = excluded.delivered_at,
    read_at = coalesce(public.announcement_read_rollups.read_at, excluded.read_at),
    acknowledged_at = coalesce(public.announcement_read_rollups.acknowledged_at, excluded.acknowledged_at),
    archived_at = coalesce(public.announcement_read_rollups.archived_at, excluded.archived_at);
end;
$$;

grant execute on function public.refresh_announcement_read_rollups(uuid) to authenticated;

-- 6) trigger: keep snapshot in sync on create/target change
create or replace function public.tg_refresh_announcement_read_rollups()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_announcement_id uuid;
begin
  v_announcement_id := coalesce(new.announcement_id, old.announcement_id, new.id, old.id);
  if v_announcement_id is not null then
    perform public.refresh_announcement_read_rollups(v_announcement_id);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_refresh_deliveries_on_target on public.announcement_targets;
create trigger trg_refresh_deliveries_on_target
after insert or update or delete
on public.announcement_targets
for each row
execute function public.tg_refresh_announcement_read_rollups();

drop trigger if exists trg_refresh_deliveries_on_announcement on public.announcements;
create trigger trg_refresh_deliveries_on_announcement
after insert or update of audience_role, is_deleted, created_at
on public.announcements
for each row
execute function public.tg_refresh_announcement_read_rollups();

-- 7) one-time backfill for existing announcements
insert into public.announcement_read_rollups (
  announcement_id,
  recipient_id,
  delivered_at,
  read_at,
  acknowledged_at,
  archived_at
)
select
  a.id,
  r.recipient_id,
  a.created_at as delivered_at,
  ar.read_at,
  ar.acknowledged_at,
  ar.archived_at
from public.announcements a
join public.get_announcement_snapshot_recipients(a.id) r on true
left join public.announcement_reads ar
  on ar.announcement_id = a.id
  and ar.legacy_reader_id = r.recipient_id
where coalesce(a.is_deleted, false) = false
  and a.created_at >= coalesce(r.cutoff_at, a.created_at)
on conflict (announcement_id, recipient_id) do update
set
  read_at = coalesce(public.announcement_read_rollups.read_at, excluded.read_at),
  acknowledged_at = coalesce(public.announcement_read_rollups.acknowledged_at, excluded.acknowledged_at),
  archived_at = coalesce(public.announcement_read_rollups.archived_at, excluded.archived_at);

-- 8) fallback RPC (used when get_my_announcements unavailable)
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
  from public.announcement_read_rollups d
  join public.announcements a
    on a.id = d.announcement_id
  where d.recipient_id = auth.uid()
    and coalesce(a.is_deleted, false) = false
    and d.archived_at is null
    and (a.scheduled_at is null or a.scheduled_at <= now())
  order by a.created_at desc
  limit p_limit;
$$;

grant execute on function public.get_visible_announcements(integer) to authenticated;

-- 9) mailbox RPC used by frontend
drop function if exists public.get_my_announcements(text, text, boolean, text, integer, integer);
drop function if exists public.get_my_announcements(boolean, integer, integer, text, text, text);

create or replace function public.get_my_announcements(
  p_has_attachments boolean default null,
  p_limit integer default 20,
  p_offset integer default 0,
  p_query text default null,
  p_sort text default 'latest',
  p_status text default 'all'
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select
      p.id,
      coalesce(nullif(to_jsonb(p) ->> 'account_status', ''), 'active') as account_status
    from public.profiles p
    where p.id = auth.uid()
  ),
  base as (
    select
      a.id,
      a.title,
      a.body,
      a.created_at,
      coalesce(a.requires_ack, false) as requires_ack,
      a.scheduled_at,
      coalesce(a.audience_role, 'all') as audience_role,
      d.read_at,
      d.acknowledged_at,
      d.archived_at,
      coalesce(att.attachment_count, 0) as attachment_count,
      false::boolean as is_pinned,
      coalesce(tg.target_summary, '-') as target_summary
    from me
    join public.announcement_read_rollups d
      on d.recipient_id = me.id
    join public.announcements a
      on a.id = d.announcement_id
    left join lateral (
      select count(*)::integer as attachment_count
      from public.announcement_attachments aa
      where aa.announcement_id = a.id
    ) att on true
    left join lateral (
      select string_agg(label, ', ' order by label) as target_summary
      from (
        select distinct
          case
            when t.target_type = 'all' then '?꾩껜'
            when t.target_type = 'school_level' then '?숆탳湲?
            when t.target_type = 'grade' then '?숇뀈'
            when t.target_type = 'class' then '諛?
            when t.target_type = 'student' then '媛쒖씤'
            else '???
          end as label
        from public.announcement_targets t
        where t.announcement_id = a.id
      ) s
    ) tg on true
    where coalesce(a.is_deleted, false) = false
      and (a.scheduled_at is null or a.scheduled_at <= now())
      and d.archived_at is null
      and me.account_status = 'active'
  ),
  filtered as (
    select b.*
    from base b
    where
      (
        p_status is null
        or p_status = ''
        or p_status = 'all'
        or (p_status = 'unread' and b.read_at is null)
        or (p_status = 'unacknowledged' and b.acknowledged_at is null)
        or (p_status = 'pinned' and b.is_pinned = true)
      )
      and (
        p_query is null
        or btrim(p_query) = ''
        or b.title ilike '%' || p_query || '%'
        or b.body ilike '%' || p_query || '%'
      )
      and (
        p_has_attachments is null
        or (p_has_attachments = true and b.attachment_count > 0)
        or (p_has_attachments = false and b.attachment_count = 0)
      )
  ),
  counts as (
    select
      count(*)::integer as total_count,
      count(*) filter (where read_at is null)::integer as unread_count,
      count(*) filter (where acknowledged_at is null)::integer as unacknowledged_count,
      count(*) filter (where is_pinned = true)::integer as pinned_count,
      count(*) filter (where attachment_count > 0)::integer as with_attachments_count
    from base
  ),
  paged as (
    select *
    from filtered
    order by
      case when coalesce(p_sort, 'latest') = 'unread_first' then (case when read_at is null then 0 else 1 end) else 0 end asc,
      case when coalesce(p_sort, 'latest') = 'oldest' then created_at end asc,
      case when coalesce(p_sort, 'latest') <> 'oldest' then created_at end desc
    limit greatest(coalesce(p_limit, 20), 1)
    offset greatest(coalesce(p_offset, 0), 0)
  )
  select jsonb_build_object(
    'items',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'title', p.title,
            'body', p.body,
            'created_at', p.created_at,
            'requires_ack', p.requires_ack,
            'scheduled_at', p.scheduled_at,
            'audience_role', p.audience_role,
            'is_read', p.read_at is not null,
            'is_acknowledged', p.acknowledged_at is not null,
            'is_pinned', p.is_pinned,
            'attachment_count', p.attachment_count,
            'target_summary', p.target_summary
          )
          order by p.created_at desc
        )
        from paged p
      ),
      '[]'::jsonb
    ),
    'counts',
    (
      select jsonb_build_object(
        'total', c.total_count,
        'unread', c.unread_count,
        'unacknowledged', c.unacknowledged_count,
        'pinned', c.pinned_count,
        'with_attachments', c.with_attachments_count
      )
      from counts c
    )
  );
$$;

grant execute on function public.get_my_announcements(boolean, integer, integer, text, text, text) to authenticated;

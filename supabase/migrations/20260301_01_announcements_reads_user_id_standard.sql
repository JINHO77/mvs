-- Standardize mailbox read/ack tracking on announcement_reads(announcement_id, user_id).
-- Keep include-before-approval option in get_my_announcements for future policy toggles.

alter table if exists public.announcement_reads
  add column if not exists user_id uuid references public.profiles(id) on delete cascade;

update public.announcement_reads
set user_id = legacy_reader_id
where user_id is null
  and legacy_reader_id is not null;

create unique index if not exists uq_announcement_reads_announcement_user
  on public.announcement_reads(announcement_id, user_id)
  where user_id is not null;

drop policy if exists ar_select_own on public.announcement_reads;
drop policy if exists ar_insert_own on public.announcement_reads;
drop policy if exists ar_update_own on public.announcement_reads;
drop policy if exists ar_delete_own on public.announcement_reads;

create policy ar_select_own
on public.announcement_reads
for select
to authenticated
using (user_id = auth.uid());

create policy ar_insert_own
on public.announcement_reads
for insert
to authenticated
with check (user_id = auth.uid());

create policy ar_update_own
on public.announcement_reads
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy ar_delete_own
on public.announcement_reads
for delete
to authenticated
using (user_id = auth.uid());

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
        and ar.user_id = auth.uid()
    );
$$;

grant execute on function public.get_unread_announcement_count() to authenticated;

drop function if exists public.get_my_announcements(integer, integer, text, text, text, boolean, boolean);
drop function if exists public.get_my_announcements(integer, integer, text, text, text, boolean);

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
    select
      p.id,
      p.role::text as role,
      p.school_level,
      p.grade,
      btrim(coalesce(p.class_label, '')) as class_label,
      p.created_at,
      p.approved_at,
      coalesce(p.account_status, 'active') as account_status
    from public.profiles p
    where p.id = auth.uid()
  ),
  active_me as (
    select *
    from me
    where account_status = 'active'
  ),
  visible as (
    select a.*
    from public.announcements a
    join active_me me on true
    where coalesce(a.is_deleted, false) = false
      and (a.scheduled_at is null or a.scheduled_at <= now())
      and (
        p_include_before_approval = true
        or a.created_at >= coalesce(me.approved_at, me.created_at)
      )
      and (
        coalesce(a.audience_role, 'all') = 'all'
        or coalesce(a.audience_role, 'all') = me.role
      )
      and exists (
        select 1
        from public.announcement_targets t
        where t.announcement_id = a.id
          and (
            t.target_type = 'all'
            or (t.target_type = 'school_level' and t.school_level is not null and t.school_level = me.school_level)
            or (t.target_type = 'grade' and t.grade is not null and t.grade = me.grade)
            or (
              t.target_type = 'class'
              and t.class_label is not null
              and btrim(t.class_label) = me.class_label
            )
            or (t.target_type = 'student' and t.student_id is not null and t.student_id = auth.uid())
          )
      )
      and (
        p_query is null
        or a.title ilike '%' || p_query || '%'
        or a.body ilike '%' || p_query || '%'
      )
  ),
  enriched as (
    select
      v.id,
      v.title,
      v.body,
      v.created_at,
      coalesce(v.requires_ack, false) as requires_ack,
      v.scheduled_at,
      coalesce(v.audience_role, 'all') as audience_role,
      r.read_at,
      r.acknowledged_at,
      r.is_pinned,
      exists (
        select 1
        from public.announcement_attachments aa
        where aa.announcement_id = v.id
          and coalesce(aa.is_deleted, false) = false
      ) as has_attachments
    from visible v
    left join public.announcement_reads r
      on r.announcement_id = v.id
     and r.user_id = auth.uid()
  ),
  filtered as (
    select *
    from enriched
    where
      (p_has_attachments is null or has_attachments = p_has_attachments)
      and (
        p_status = 'all'
        or (p_status = 'unread' and read_at is null)
        or (p_status = 'unacknowledged' and requires_ack = true and acknowledged_at is null)
        or (p_status = 'pinned' and coalesce(is_pinned, false) = true)
      )
  ),
  ordered as (
    select *
    from filtered
    order by
      case when p_sort = 'oldest' then created_at end asc,
      case when p_sort <> 'oldest' then created_at end desc
    offset greatest(p_offset, 0)
    limit least(greatest(coalesce(p_limit, 20), 1), 100)
  ),
  counts as (
    select
      count(*)::integer as total,
      count(*) filter (where read_at is null)::integer as unread,
      count(*) filter (where requires_ack = true and acknowledged_at is null)::integer as unacknowledged,
      count(*) filter (where coalesce(is_pinned, false) = true)::integer as pinned,
      count(*) filter (where has_attachments = true)::integer as with_attachments
    from enriched
  )
  select jsonb_build_object(
    'items',
    coalesce(
      (
        select jsonb_agg(to_jsonb(o) order by o.created_at desc)
        from ordered o
      ),
      '[]'::jsonb
    ),
    'counts',
    coalesce((select to_jsonb(c) from counts c), jsonb_build_object(
      'total', 0,
      'unread', 0,
      'unacknowledged', 0,
      'pinned', 0,
      'with_attachments', 0
    ))
  );
$$;

create or replace function public.get_my_announcements(
  p_limit integer default 20,
  p_offset integer default 0,
  p_query text default null,
  p_sort text default 'latest',
  p_status text default 'all',
  p_has_attachments boolean default null
)
returns jsonb
language sql
security definer
set search_path to 'public'
as $$
  select public.get_my_announcements(
    p_limit => p_limit,
    p_offset => p_offset,
    p_query => p_query,
    p_sort => p_sort,
    p_status => p_status,
    p_has_attachments => p_has_attachments,
    p_include_before_approval => false
  );
$$;

grant execute on function public.get_my_announcements(integer, integer, text, text, text, boolean, boolean) to authenticated;
grant execute on function public.get_my_announcements(integer, integer, text, text, text, boolean) to authenticated;

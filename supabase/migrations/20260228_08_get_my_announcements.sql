-- Mailbox RPC for announcements page.
-- Legacy function public.get_visible_announcements is kept for backward compatibility,
-- but UI should use public.get_my_announcements.

alter table if exists public.profiles
  add column if not exists approved_at timestamptz;

alter table if exists public.announcement_reads
  add column if not exists user_id uuid;

update public.announcement_reads
set user_id = legacy_reader_id
where user_id is null
  and legacy_reader_id is not null;

alter table if exists public.announcement_reads
  add column if not exists is_pinned boolean not null default false;

alter table if exists public.announcement_attachments
  add column if not exists is_deleted boolean not null default false;

drop function if exists public.get_my_announcements(integer, integer, text, text, text, boolean);

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
  with me as (
    select p.*
    from public.profiles p
    where p.id = auth.uid()
  ),
  cutoff as (
    select
      case
        when (select role::text from me) = 'student'
          then coalesce((select approved_at from me), (select created_at from me))
        else (select created_at from me)
      end as since_at
  ),
  visible as (
    select a.*
    from public.announcements a
    join me on true
    join cutoff c on true
    where coalesce(a.is_deleted, false) = false
      and a.created_at >= c.since_at
      and (
        coalesce(a.audience_role, 'all') = 'all'
        or coalesce(a.audience_role, 'all') = (me.role::text)
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
              and btrim(t.class_label) = btrim(coalesce(me.class_label, ''))
            )
            or (t.target_type = 'student' and t.student_id is not null and t.student_id = auth.uid())
          )
      )
      and (
        p_query is null
        or (a.title ilike '%' || p_query || '%')
        or (a.body ilike '%' || p_query || '%')
      )
  ),
  enriched as (
    select
      v.*,
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
     and coalesce(r.user_id, r.legacy_reader_id) = auth.uid()
  ),
  filtered as (
    select *
    from enriched
    where
      (p_has_attachments is null or has_attachments = p_has_attachments)
      and (
        p_status = 'all'
        or (p_status = 'unread' and read_at is null)
        or (p_status = 'unacknowledged' and acknowledged_at is null)
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
      (select count(*) from enriched) as total,
      (select count(*) from enriched where read_at is null) as unread,
      (select count(*) from enriched where acknowledged_at is null) as unacknowledged,
      (select count(*) from enriched where coalesce(is_pinned, false) = true) as pinned,
      (select count(*) from enriched where has_attachments = true) as with_attachments
  )
  select jsonb_build_object(
    'items', coalesce(jsonb_agg(to_jsonb(ordered) order by ordered.created_at desc), '[]'::jsonb),
    'counts', to_jsonb(counts)
  )
  from ordered, counts;
$$;

grant execute on function public.get_my_announcements(integer, integer, text, text, text, boolean) to authenticated;


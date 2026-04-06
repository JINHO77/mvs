-- Ensure parent/guardian can receive student-targeted announcements in mailbox RPC.
-- Reuse can_current_user_read_announcement() to keep visibility logic consistent.

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
      and public.can_current_user_read_announcement(a.id)
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
    order by
      case when p_sort = 'oldest' then created_at end asc,
      case when p_sort <> 'oldest' then created_at end desc
    limit greatest(coalesce(p_limit, 20), 0)
    offset greatest(coalesce(p_offset, 0), 0)
  ),
  target_summaries as (
    select
      t.announcement_id,
      string_agg(
        case
          when t.target_type = 'all' then '전체'
          when t.target_type = 'school_level' then '학교급'
          when t.target_type = 'grade' then '학년'
          when t.target_type = 'class' then '반'
          when t.target_type = 'student' then '개인'
          else t.target_type
        end,
        ', '
        order by
          case t.target_type
            when 'all' then 1
            when 'school_level' then 2
            when 'grade' then 3
            when 'class' then 4
            when 'student' then 5
            else 99
          end
      ) as target_summary
    from public.announcement_targets t
    where t.announcement_id in (select id from sliced)
    group by t.announcement_id
  )
  select jsonb_build_object(
    'items',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'title', s.title,
            'body', s.body,
            'created_at', s.created_at,
            'requires_ack', s.requires_ack,
            'scheduled_at', s.scheduled_at,
            'audience_role', s.audience_role,
            'read_at', s.read_at,
            'acknowledged_at', s.acknowledged_at,
            'is_read', s.read_at is not null,
            'is_acknowledged', s.acknowledged_at is not null,
            'is_pinned', coalesce(s.is_pinned, false),
            'has_attachments', s.has_attachments,
            'attachment_count',
              (
                select count(*)::int
                from public.announcement_attachments aa
                where aa.announcement_id = s.id
                  and coalesce(aa.is_deleted, false) = false
              ),
            'target_summary', coalesce(ts.target_summary, '-')
          )
          order by
            case when p_sort = 'oldest' then s.created_at end asc,
            case when p_sort <> 'oldest' then s.created_at end desc
        )
        from sliced s
        left join target_summaries ts on ts.announcement_id = s.id
      ),
      '[]'::jsonb
    ),
    'counts',
    (
      select jsonb_build_object(
        'total', coalesce(tc.total, 0),
        'unread', coalesce(tc.unread, 0),
        'unacknowledged', coalesce(tc.unacknowledged, 0),
        'pinned', coalesce(tc.pinned, 0),
        'with_attachments', coalesce(tc.with_attachments, 0)
      )
      from total_counts tc
    )
  );
$$;

grant execute on function public.get_my_announcements(integer, integer, text, text, text, boolean, boolean)
to authenticated;

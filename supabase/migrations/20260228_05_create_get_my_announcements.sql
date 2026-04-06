-- Recreate get_my_announcements with the exact requested signature.

drop function if exists public.get_my_announcements(text, text, boolean, text, integer, integer);
drop function if exists public.get_my_announcements(boolean, integer, integer, text, text, text);

create or replace function public.get_my_announcements(
  p_has_attachments boolean,
  p_limit integer,
  p_offset integer,
  p_query text,
  p_sort text,
  p_status text
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select
      id,
      role,
      coalesce(account_status, 'active') as account_status
    from public.profiles
    where id = auth.uid()
  ),
  visible as (
    select
      a.id,
      a.title,
      a.body,
      a.created_at,
      coalesce(a.requires_ack, false) as requires_ack,
      a.scheduled_at,
      coalesce(a.audience_role, 'all') as audience_role
    from public.announcements a
    where public.can_current_user_read_announcement(a.id)
      and coalesce(a.is_deleted, false) = false
      and (a.scheduled_at is null or a.scheduled_at <= now())
      and exists (
        select 1
        from me
        where account_status = 'active'
      )
  ),
  enriched as (
    select
      v.*,
      ar.read_at is not null as is_read,
      ar.acknowledged_at is not null as is_acknowledged,
      coalesce(att.attachment_count, 0) as attachment_count,
      false::boolean as is_pinned,
      coalesce(tg.target_summary, '-') as target_summary
    from visible v
    left join public.announcement_reads ar
      on ar.announcement_id = v.id
      and ar.legacy_reader_id = auth.uid()
    left join lateral (
      select count(*)::integer as attachment_count
      from public.announcement_attachments aa
      where aa.announcement_id = v.id
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
        where t.announcement_id = v.id
      ) s
    ) tg on true
  ),
  filtered as (
    select e.*
    from enriched e
    where
      (
        p_status is null
        or p_status = ''
        or p_status = 'all'
        or (p_status = 'unread' and e.is_read = false)
        or (p_status = 'unacknowledged' and e.requires_ack = true and e.is_acknowledged = false)
        or (p_status = 'pinned' and e.is_pinned = true)
      )
      and (
        p_query is null
        or btrim(p_query) = ''
        or e.title ilike '%' || p_query || '%'
        or e.body ilike '%' || p_query || '%'
      )
      and (
        p_has_attachments is null
        or (p_has_attachments = true and e.attachment_count > 0)
        or (p_has_attachments = false and e.attachment_count = 0)
      )
  ),
  counts as (
    select
      count(*)::integer as total_count,
      count(*) filter (where is_read = false)::integer as unread_count,
      count(*) filter (where requires_ack = true and is_acknowledged = false)::integer as unacknowledged_count,
      count(*) filter (where is_pinned = true)::integer as pinned_count,
      count(*) filter (where attachment_count > 0)::integer as with_attachments_count
    from enriched
  ),
  paged as (
    select *
    from filtered
    order by
      case when coalesce(p_sort, 'latest') = 'unread_first' then (case when is_read then 1 else 0 end) else 0 end asc,
      created_at desc
    limit greatest(coalesce(p_limit, 50), 1)
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
            'is_read', p.is_read,
            'is_acknowledged', p.is_acknowledged,
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

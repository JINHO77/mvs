create or replace function public.get_my_announcements(
  p_has_attachments boolean default null,
  p_limit integer default 50,
  p_offset integer default 0,
  p_query text default null,
  p_sort text default 'latest',
  p_status text default 'all'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_cutoff timestamptz;
  v_items jsonb;
  v_total int;
  v_unread int;
  v_unack int;
  v_pinned int;
  v_with_attach int;
begin
  select *
    into v_profile
  from public.profiles
  where id = auth.uid();

  if v_profile.id is null then
    return jsonb_build_object('items', jsonb_build_array(), 'counts',
      jsonb_build_object('total',0,'unread',0,'unacknowledged',0,'pinned',0,'with_attachments',0)
    );
  end if;

  v_cutoff := coalesce(v_profile.approved_at, v_profile.created_at);

  with base as (
    select
      a.*,
      r.read_at,
      r.acknowledged_at,
      (r.read_at is not null) as is_read,
      (r.acknowledged_at is not null) as is_acknowledged,
      false as is_pinned,
      coalesce(att.attachment_count,0) as attachment_count,
      case when coalesce(att.attachment_count,0) > 0 then true else false end as has_attachments,
      (
        select
          case
            when exists (select 1 from public.announcement_targets t where t.announcement_id=a.id and t.target_type='all') then '?꾩껜'
            else '???
          end
      ) as target_summary
    from public.announcements a
    join public.profiles p
      on p.id = auth.uid()
    left join public.announcement_reads r
      on r.announcement_id = a.id
     and r.legacy_reader_id = auth.uid()
    left join (
      select announcement_id, count(*)::int as attachment_count
      from public.announcement_attachments
      group by announcement_id
    ) att
      on att.announcement_id = a.id
    where a.is_deleted = false
      and a.created_at >= v_cutoff
      and (
        a.audience_role = 'all'
        or a.audience_role = (p.role::text)
      )
      and exists (
        select 1
        from public.announcement_targets t
        where t.announcement_id = a.id
          and (
            t.target_type = 'all'
            or (t.target_type = 'school_level' and t.school_level is not null and t.school_level = p.school_level)
            or (t.target_type = 'grade' and t.grade is not null and t.grade = p.grade)
            or (t.target_type = 'class' and t.class_label is not null and t.class_label = p.class_label)
            or (t.target_type = 'student' and t.student_id is not null and t.student_id = auth.uid())
          )
      )
      and (
        p_query is null
        or (a.title ilike ('%'||p_query||'%') or a.body ilike ('%'||p_query||'%'))
      )
      and (
        p_has_attachments is null
        or (p_has_attachments = true and coalesce(att.attachment_count,0) > 0)
        or (p_has_attachments = false and coalesce(att.attachment_count,0) = 0)
      )
  ),
  counts as (
    select
      count(*)::int as total,
      count(*) filter (where read_at is null)::int as unread,
      count(*) filter (where requires_ack = true and acknowledged_at is null)::int as unacknowledged,
      count(*) filter (where is_pinned = true)::int as pinned,
      count(*) filter (where has_attachments = true)::int as with_attachments
    from base
  ),
  filtered as (
    select *
    from base
    where
      p_status = 'all'
      or (p_status = 'unread' and read_at is null)
      or (p_status = 'unacknowledged' and requires_ack = true and acknowledged_at is null)
      or (p_status = 'pinned' and is_pinned = true)
    order by
      case when p_sort = 'oldest' then created_at end asc,
      case when p_sort <> 'oldest' then created_at end desc
    limit coalesce(p_limit,50)
    offset coalesce(p_offset,0)
  )
  select
    jsonb_agg(to_jsonb(filtered) - 'is_deleted' - 'updated_at')
  into v_items
  from filtered;

  select total, unread, unacknowledged, pinned, with_attachments
    into v_total, v_unread, v_unack, v_pinned, v_with_attach
  from counts;

  return jsonb_build_object(
    'items', coalesce(v_items, jsonb_build_array()),
    'counts', jsonb_build_object(
      'total', coalesce(v_total,0),
      'unread', coalesce(v_unread,0),
      'unacknowledged', coalesce(v_unack,0),
      'pinned', coalesce(v_pinned,0),
      'with_attachments', coalesce(v_with_attach,0)
    )
  );
end;
$$;

grant execute on function public.get_my_announcements(boolean, integer, integer, text, text, text) to authenticated;

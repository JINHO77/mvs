-- Rank units that need backfill first

with coverage as (
  with active_units as (
    select
      cu.id,
      cu.subject,
      cu.school_level,
      cu.grade,
      cu.unit_key,
      cu.unit_name
    from curriculum_units cu
    where cu.is_active = true
  ),
  published_missions as (
    select
      gm.id,
      gm.subject,
      gm.unit_id,
      case
        when gm.difficulty = 'challenge' then 'hard'
        else gm.difficulty
      end as difficulty
    from generated_missions gm
    where gm.status = 'published'
      and gm.is_active = true
      and gm.published_at is not null
  )
  select
    au.id as unit_id,
    au.subject,
    au.school_level,
    au.grade,
    au.unit_key,
    au.unit_name,
    count(pm.id) as mission_count,
    count(*) filter (where pm.difficulty = 'easy') as easy_count,
    count(*) filter (where pm.difficulty = 'normal') as normal_count,
    count(*) filter (where pm.difficulty = 'hard') as hard_count
  from active_units au
  left join published_missions pm
    on pm.unit_id = au.id
   and pm.subject = au.subject
  group by au.id, au.subject, au.school_level, au.grade, au.unit_key, au.unit_name
)
select
  subject,
  school_level,
  grade,
  unit_key,
  unit_name,
  mission_count,
  easy_count,
  normal_count,
  hard_count,
  concat_ws(
    ',',
    case when mission_count = 0 then 'mission_count_zero' end,
    case when easy_count = 0 then 'missing_easy' end,
    case when normal_count = 0 then 'missing_normal' end,
    case when hard_count = 0 then 'missing_hard' end,
    case when mission_count < 5 then 'cannot_fill_weekly_path' end
  ) as gap_reason,
  case
    when mission_count = 0 then 1
    when easy_count = 0 or normal_count = 0 or hard_count = 0 then 2
    when mission_count < 5 then 3
    else 9
  end as priority_rank
from coverage
where mission_count = 0
   or easy_count = 0
   or normal_count = 0
   or hard_count = 0
   or mission_count < 5
order by
  priority_rank,
  mission_count,
  subject,
  school_level,
  grade,
  unit_key;

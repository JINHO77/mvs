-- Full curriculum coverage audit for math + english

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
  au.subject,
  au.school_level,
  au.grade,
  au.unit_key,
  au.unit_name,
  count(pm.id) as mission_count,
  count(*) filter (where pm.difficulty = 'easy') as easy_count,
  count(*) filter (where pm.difficulty = 'normal') as normal_count,
  count(*) filter (where pm.difficulty = 'hard') as hard_count,
  case
    when count(pm.id) = 0 then 'generate_now'
    when count(pm.id) between 1 and 2 then 'very_low'
    when count(pm.id) between 3 and 4 then 'needs_boost'
    else 'weekly_ready'
  end as coverage_status
from active_units au
left join published_missions pm
  on pm.unit_id = au.id
 and pm.subject = au.subject
group by
  au.subject,
  au.school_level,
  au.grade,
  au.unit_key,
  au.unit_name
order by
  au.subject,
  au.school_level,
  au.grade,
  au.unit_key;

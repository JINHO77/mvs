-- English published mission audit for weekly-path candidates

with target_units as (
  select
    id,
    unit_key,
    unit_name,
    school_level,
    grade
  from curriculum_units
  where unit_key in (
    'elem-eng-school-locations',
    'elem-eng-food-ordering',
    'elem-eng-digital-safety',
    'mid-eng-careers-interests',
    'mid-eng-collaboration-problem-solving',
    'mid-eng-social-issues-opinion'
  )
),
published_english_missions as (
  select
    u.unit_key,
    u.unit_name,
    gm.id as mission_id,
    gm.title,
    gm.difficulty,
    gm.estimated_minutes,
    coalesce(gm.mission_json ->> 'missionKey', gm.mission_json ->> 'mission_key', gm.id::text) as "missionKey"
  from generated_missions gm
  join target_units u on u.id = gm.unit_id
  where gm.subject = 'english'
    and gm.status = 'published'
    and gm.is_active = true
    and gm.published_at is not null
)
select
  unit_key,
  unit_name,
  mission_id,
  title,
  difficulty,
  estimated_minutes,
  "missionKey"
from published_english_missions
order by unit_key, difficulty, title;

with target_units as (
  select
    id,
    unit_key,
    unit_name
  from curriculum_units
  where unit_key in (
    'elem-eng-school-locations',
    'elem-eng-food-ordering',
    'elem-eng-digital-safety',
    'mid-eng-careers-interests',
    'mid-eng-collaboration-problem-solving',
    'mid-eng-social-issues-opinion'
  )
),
published_english_missions as (
  select
    u.unit_key,
    u.unit_name,
    gm.difficulty
  from generated_missions gm
  join target_units u on u.id = gm.unit_id
  where gm.subject = 'english'
    and gm.status = 'published'
    and gm.is_active = true
    and gm.published_at is not null
)
select
  unit_key,
  unit_name,
  count(*) filter (where difficulty = 'easy') as easy_count,
  count(*) filter (where difficulty = 'normal') as normal_count,
  count(*) filter (where difficulty = 'hard') as hard_count
from published_english_missions
group by unit_key, unit_name
order by unit_key;

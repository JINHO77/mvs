-- Candidate mission audit for middle grade 2 (review/current/preview)

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
    and cu.school_level = 'middle'
    and cu.grade between 7 and 9
),
published_missions as (
  select
    gm.id as mission_id,
    gm.subject,
    gm.unit_id,
    gm.title,
    case
      when gm.difficulty = 'challenge' then 'hard'
      else gm.difficulty
    end as difficulty,
    gm.estimated_minutes,
    gm.created_at,
    coalesce(gm.mission_json ->> 'missionKey', gm.mission_json ->> 'mission_key', gm.id::text) as mission_key
  from generated_missions gm
  where gm.status = 'published'
    and gm.is_active = true
    and gm.published_at is not null
),
path_usage as (
  select distinct mission_id
  from learning_path_recommendations
  where is_active = true
),
bucketed as (
  select
    pm.subject,
    case
      when au.grade = 7 then 'review'
      when au.grade = 8 then 'current'
      when au.grade = 9 then 'preview'
    end as bucket,
    au.school_level,
    au.grade,
    au.unit_key,
    au.unit_name,
    pm.mission_id,
    pm.title,
    pm.difficulty,
    pm.estimated_minutes,
    pm.mission_key,
    case when pu.mission_id is null then false else true end as already_in_learning_path
  from published_missions pm
  join active_units au
    on au.id = pm.unit_id
   and au.subject = pm.subject
  left join path_usage pu
    on pu.mission_id = pm.mission_id
)
select
  subject,
  bucket,
  school_level,
  grade,
  unit_key,
  unit_name,
  mission_id,
  title,
  difficulty,
  estimated_minutes,
  mission_key,
  already_in_learning_path
from bucketed
order by
  subject,
  case bucket when 'review' then 1 when 'current' then 2 else 3 end,
  grade,
  unit_key,
  case difficulty when 'easy' then 1 when 'normal' then 2 else 3 end,
  estimated_minutes,
  title;

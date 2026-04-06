-- English weekly-path upsert for learning_path_recommendations
-- Reuses the same table as math and only inserts complete 5-step paths.

begin;

with path_blueprints as (
  select *
  from (
    values
      ('english_elem4_school_weekly_path_v1', 'english', 'elementary', 4, 'elem-eng-school-locations'),
      ('english_elem5_food_weekly_path_v1', 'english', 'elementary', 5, 'elem-eng-food-ordering'),
      ('english_elem6_digital_weekly_path_v1', 'english', 'elementary', 6, 'elem-eng-digital-safety'),
      ('english_mid1_career_weekly_path_v1', 'english', 'middle', 7, 'mid-eng-careers-interests'),
      ('english_mid2_collab_weekly_path_v1', 'english', 'middle', 8, 'mid-eng-collaboration-problem-solving'),
      ('english_mid3_issue_weekly_path_v1', 'english', 'middle', 9, 'mid-eng-social-issues-opinion')
  ) as t(path_key, subject, school_level, grade, unit_key)
),
required_steps as (
  select *
  from (
    values
      (1, '월', 'easy', 10),
      (2, '화', 'easy', 12),
      (3, '수', 'normal', 18),
      (4, '목', 'normal', 22),
      (5, '금', 'hard', 30)
  ) as t(step_order, weekday_label, difficulty, reward_xp)
),
target_units as (
  select
    pb.path_key,
    pb.subject,
    pb.school_level,
    pb.grade,
    cu.id as unit_id,
    cu.unit_key
  from path_blueprints pb
  join curriculum_units cu
    on cu.unit_key = pb.unit_key
   and cu.subject = pb.subject
   and cu.school_level = pb.school_level
   and cu.grade = pb.grade
   and cu.is_active = true
),
candidate_missions as (
  select
    tu.path_key,
    tu.subject,
    tu.school_level,
    tu.grade,
    tu.unit_id,
    gm.id as mission_id,
    gm.difficulty,
    row_number() over (
      partition by tu.path_key, gm.difficulty
      order by gm.published_at asc, gm.created_at asc, gm.id asc
    ) as difficulty_rank
  from target_units tu
  join generated_missions gm
    on gm.unit_id = tu.unit_id
  where gm.subject = 'english'
    and gm.status = 'published'
    and gm.is_active = true
    and gm.published_at is not null
),
selected_missions as (
  select
    tu.path_key,
    tu.subject,
    tu.school_level,
    tu.grade,
    tu.unit_id,
    rs.weekday_label,
    rs.step_order,
    rs.difficulty,
    rs.reward_xp,
    cm.mission_id
  from target_units tu
  join required_steps rs
    on true
  join candidate_missions cm
    on cm.path_key = tu.path_key
   and cm.difficulty = rs.difficulty
   and cm.difficulty_rank = case
     when rs.step_order = 1 then 1
     when rs.step_order = 2 then 2
     when rs.step_order = 3 then 1
     when rs.step_order = 4 then 2
     when rs.step_order = 5 then 1
     else 1
   end
),
complete_paths as (
  select path_key
  from selected_missions
  group by path_key
  having count(*) = 5
),
payload as (
  select
    sm.path_key,
    sm.subject,
    sm.school_level,
    sm.grade,
    sm.unit_id,
    sm.mission_id,
    sm.weekday_label,
    sm.step_order,
    sm.difficulty,
    sm.reward_xp,
    true as is_active
  from selected_missions sm
  join complete_paths cp
    on cp.path_key = sm.path_key
)
delete from learning_path_recommendations
where path_key in (select path_key from path_blueprints);

insert into learning_path_recommendations (
  path_key,
  subject,
  school_level,
  grade,
  unit_id,
  mission_id,
  weekday_label,
  step_order,
  difficulty,
  reward_xp,
  is_active
)
select
  path_key,
  subject,
  school_level,
  grade,
  unit_id,
  mission_id,
  weekday_label,
  step_order,
  difficulty,
  reward_xp,
  is_active
from payload
where not exists (
  select 1
  from learning_path_recommendations existing
  where existing.path_key = payload.path_key
    and existing.step_order = payload.step_order
    and existing.mission_id = payload.mission_id
);

commit;

with path_blueprints as (
  select *
  from (
    values
      ('english_elem4_school_weekly_path_v1', 'english', 'elementary', 4, 'elem-eng-school-locations'),
      ('english_elem5_food_weekly_path_v1', 'english', 'elementary', 5, 'elem-eng-food-ordering'),
      ('english_elem6_digital_weekly_path_v1', 'english', 'elementary', 6, 'elem-eng-digital-safety'),
      ('english_mid1_career_weekly_path_v1', 'english', 'middle', 7, 'mid-eng-careers-interests'),
      ('english_mid2_collab_weekly_path_v1', 'english', 'middle', 8, 'mid-eng-collaboration-problem-solving'),
      ('english_mid3_issue_weekly_path_v1', 'english', 'middle', 9, 'mid-eng-social-issues-opinion')
  ) as t(path_key, subject, school_level, grade, unit_key)
),
required_steps as (
  select *
  from (
    values
      (1, '월', 'easy', 1),
      (2, '화', 'easy', 2),
      (3, '수', 'normal', 1),
      (4, '목', 'normal', 2),
      (5, '금', 'hard', 1)
  ) as t(step_order, weekday_label, difficulty, required_rank)
),
candidate_missions as (
  select
    pb.path_key,
    pb.unit_key,
    gm.difficulty,
    row_number() over (
      partition by pb.path_key, gm.difficulty
      order by gm.published_at asc, gm.created_at asc, gm.id asc
    ) as difficulty_rank
  from path_blueprints pb
  join curriculum_units cu
    on cu.unit_key = pb.unit_key
   and cu.subject = pb.subject
   and cu.school_level = pb.school_level
   and cu.grade = pb.grade
   and cu.is_active = true
  join generated_missions gm
    on gm.unit_id = cu.id
  where gm.subject = 'english'
    and gm.status = 'published'
    and gm.is_active = true
    and gm.published_at is not null
)
select
  pb.path_key,
  pb.unit_key,
  rs.step_order,
  rs.weekday_label,
  rs.difficulty,
  rs.required_rank
from path_blueprints pb
cross join required_steps rs
left join candidate_missions cm
  on cm.path_key = pb.path_key
 and cm.difficulty = rs.difficulty
 and cm.difficulty_rank = rs.required_rank
where cm.path_key is null
order by pb.path_key, rs.step_order;

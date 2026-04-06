-- Rebalanced weekly paths for middle grade 2
-- Ratio target: review 20% / current 60% / preview 20%
-- Math path is fully backed by existing missions.
-- English path expects the two new easy missions inserted by mission_backfill_priority_inserts.sql.

begin;

delete from learning_path_recommendations
where path_key in (
  'math_middle_8_core_weekly_v1',
  'english_middle_8_core_weekly_v1'
);

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
  payload.path_key,
  payload.subject,
  payload.school_level,
  payload.grade,
  cu.id as unit_id,
  gm.id as mission_id,
  payload.weekday_label,
  payload.step_order,
  payload.difficulty,
  payload.reward_xp,
  true as is_active
from (
  values
    ('math_middle_8_core_weekly_v1', 'math', 'middle', 8, 'middle-1-integers-rationals', 'c5f3d9c2-7b41-4f11-9a01-400000000701', '월', 1, 'easy', 10),
    ('math_middle_8_core_weekly_v1', 'math', 'middle', 8, 'middle-2-linear-functions', 'bdce4b57-d437-4053-9e18-37da10d93066', '화', 2, 'easy', 12),
    ('math_middle_8_core_weekly_v1', 'math', 'middle', 8, 'middle-2-linear-functions', '3f93d7c9-9e3c-4baf-a033-ad4f3c9e3003', '수', 3, 'normal', 18),
    ('math_middle_8_core_weekly_v1', 'math', 'middle', 8, 'middle-2-simultaneous-equations', '45e52f01-90ab-4e5c-b5fc-19984cbbe230', '목', 4, 'normal', 22),
    ('math_middle_8_core_weekly_v1', 'math', 'middle', 8, 'middle-3-pythagorean', 'a9b4fbf9-2bcb-4b48-bcda-d411613372b9', '금', 5, 'hard', 30),

    ('english_middle_8_core_weekly_v1', 'english', 'middle', 8, 'mid-eng-past-experience', 'eng_mid1_past_experience_easy_v1', '월', 1, 'easy', 10),
    ('english_middle_8_core_weekly_v1', 'english', 'middle', 8, 'mid-eng-advice-problem-solving', 'eng_mid2_advice_easy_v1', '화', 2, 'easy', 12),
    ('english_middle_8_core_weekly_v1', 'english', 'middle', 8, 'mid-eng-advice-problem-solving', 'd9ed2133-393f-4b81-b3a7-2469a2892d94', '수', 3, 'normal', 18),
    ('english_middle_8_core_weekly_v1', 'english', 'middle', 8, 'mid-eng-daily-comparison', '60a619f9-b844-45e6-a3df-b5b2268f2300', '목', 4, 'normal', 22),
    ('english_middle_8_core_weekly_v1', 'english', 'middle', 8, 'mid-eng-social-issues-opinion', '472a67b4-7234-448c-9572-d75a4de56720', '금', 5, 'hard', 30)
) as payload(path_key, subject, school_level, grade, unit_key, mission_key, weekday_label, step_order, difficulty, reward_xp)
join curriculum_units cu
  on cu.unit_key = payload.unit_key
 and cu.subject = payload.subject
 and cu.school_level = payload.school_level
 and cu.grade = case
   when payload.path_key = 'math_middle_8_core_weekly_v1' and payload.step_order = 1 then 7
   when payload.path_key = 'math_middle_8_core_weekly_v1' and payload.step_order = 5 then 9
   when payload.path_key = 'english_middle_8_core_weekly_v1' and payload.step_order = 1 then 7
   when payload.path_key = 'english_middle_8_core_weekly_v1' and payload.step_order = 5 then 9
   else 8
 end
join generated_missions gm
  on gm.unit_id = cu.id
 and (
   gm.id::text = payload.mission_key
   or gm.mission_json ->> 'missionKey' = payload.mission_key
   or gm.mission_json ->> 'mission_key' = payload.mission_key
 )
where gm.subject = payload.subject
  and gm.status = 'published'
  and gm.is_active = true
  and gm.published_at is not null
  and not exists (
    select 1
    from learning_path_recommendations existing
    where existing.path_key = payload.path_key
      and existing.step_order = payload.step_order
      and existing.mission_id = gm.id
  );

commit;

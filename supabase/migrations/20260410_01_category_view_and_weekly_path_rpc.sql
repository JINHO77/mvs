-- v_missions_by_category: computed category label for career-themed missions
create or replace view public.v_missions_by_category as
select
  gm.*,
  case
    when (lower(
      coalesce(gm.title, '') || ' ' ||
      coalesce(gm.mission_json->>'scenario', '') || ' ' ||
      coalesce(gm.mission_json->>'mainConcept', '')
    )) ~ '게임|아이템|보상|game'
      then 'game'
    when (lower(
      coalesce(gm.title, '') || ' ' ||
      coalesce(gm.mission_json->>'scenario', '') || ' ' ||
      coalesce(gm.mission_json->>'mainConcept', '')
    )) ~ '강아지|고양이|동물|수의사|반려|animal'
      then 'animal'
    when (lower(
      coalesce(gm.title, '') || ' ' ||
      coalesce(gm.mission_json->>'scenario', '') || ' ' ||
      coalesce(gm.mission_json->>'mainConcept', '')
    )) ~ '로봇|robot'
      then 'robot'
    when (lower(
      coalesce(gm.title, '') || ' ' ||
      coalesce(gm.mission_json->>'scenario', '') || ' ' ||
      coalesce(gm.mission_json->>'mainConcept', '')
    )) ~ '카페|음료|창업|가격|cafe'
      then 'cafe'
    when (lower(
      coalesce(gm.title, '') || ' ' ||
      coalesce(gm.mission_json->>'scenario', '') || ' ' ||
      coalesce(gm.mission_json->>'mainConcept', '')
    )) ~ '드론|촬영|카메라|유튜브|유튜버|drone|camera|creator|youtube'
      then 'drone'
    when (lower(
      coalesce(gm.title, '') || ' ' ||
      coalesce(gm.mission_json->>'scenario', '') || ' ' ||
      coalesce(gm.mission_json->>'mainConcept', '')
    )) ~ '배달|이동|여행|택시|요금|자전거|달리기'
      then 'delivery'
    else 'other'
  end as main_category
from public.generated_missions gm
where gm.status = 'published'
  and gm.is_active = true
  and gm.published_at is not null;

-- RLS: authenticated users can read
grant select on public.v_missions_by_category to authenticated;


-- upsert_student_weekly_path: atomically finds or creates the weekly path assignment.
-- If a row already exists for (p_student_id, p_subject, p_week_key) it is returned unchanged.
-- Otherwise the function selects the best matching path_key from learning_path_recommendations
-- (filtered by subject and the student's curriculum grade) and inserts a new row.
create or replace function public.upsert_student_weekly_path(
  p_student_id uuid,
  p_subject     text,
  p_week_key    integer
)
returns public.student_weekly_paths
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row              public.student_weekly_paths;
  v_path_key         text;
  v_curriculum_grade integer;
begin
  -- Fast path: return existing assignment
  select * into v_row
  from public.student_weekly_paths
  where student_id = p_student_id
    and subject    = p_subject
    and week_key   = p_week_key;

  if found then
    return v_row;
  end if;

  -- Derive curriculum grade from profile.
  -- curriculum_units now uses relative grades within each school_level (1..6 for elementary, 1..3 for middle, 1..3 for high),
  -- matching what profiles store. No conversion needed.
  select grade
  into v_curriculum_grade
  from public.profiles
  where id = p_student_id;

  -- Pick the oldest path that matches subject + grade (grade-agnostic rows are also eligible)
  select path_key into v_path_key
  from (
    select
      path_key,
      max(created_at) as max_created,
      min(step_order) as min_step
    from public.learning_path_recommendations
    where subject = p_subject
      and (is_active is null or is_active = true)
      and (
        v_curriculum_grade is null
        or grade is null
        or grade = v_curriculum_grade
      )
    group by path_key
    order by max_created asc, min_step asc, path_key asc
    limit 1
  ) sub;

  if v_path_key is null then
    return null;
  end if;

  -- Insert, ignoring a concurrent insert on the same key
  insert into public.student_weekly_paths (student_id, subject, week_key, path_key)
  values (p_student_id, p_subject, p_week_key, v_path_key)
  on conflict (student_id, subject, week_key) do nothing
  returning * into v_row;

  -- If another process won the race, read their row
  if v_row is null then
    select * into v_row
    from public.student_weekly_paths
    where student_id = p_student_id
      and subject    = p_subject
      and week_key   = p_week_key;
  end if;

  return v_row;
end;
$$;

grant execute on function public.upsert_student_weekly_path(uuid, text, integer) to authenticated;

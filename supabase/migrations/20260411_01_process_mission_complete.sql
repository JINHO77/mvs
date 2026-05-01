-- process_mission_complete: atomic mission completion handler
-- Marks attempt complete, updates badges + mastery, returns XP/level/streak/new_badges.
-- Duration is computed server-side from started_at, so client needs no prior attempt fetch.
create or replace function public.process_mission_complete(
  p_student_id      uuid,
  p_attempt_id      uuid,
  p_mission_id      uuid,
  p_subject         text,
  p_difficulty      text,
  p_score           integer,
  p_correct_steps   integer,
  p_total_steps     integer,
  p_hint_used_count integer,
  p_unit_id         uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now               timestamptz := now();
  v_started_at        timestamptz;
  v_duration_sec      integer;

  -- XP
  v_base_xp           integer;
  v_xp_earned         integer;
  v_prev_total_xp     integer;
  v_new_total_xp      integer;
  v_prev_level        integer;
  v_new_level         integer;
  v_leveled_up        boolean;
  v_xp_to_next        integer;

  -- Badge counters
  v_total_completed    integer;
  v_correct_streak     integer;
  v_distinct_units     integer;
  v_hard_count         integer;
  v_math_count         integer;
  v_graph_count        integer;
  v_geometry_count     integer;
  v_logic_count        integer;
  v_english_count      integer;
  v_reading_count      integer;
  v_speaking_count     integer;
  v_english_day_streak integer;

  -- Streak + result
  v_day_streak        integer;
  v_new_badges        jsonb := '[]'::jsonb;

  -- Mastery
  v_accuracy          numeric;
  v_cur_attempt_count integer;
  v_cur_solved_count  integer;
  v_cur_mastery       numeric;
  v_next_attempt_count integer;
  v_next_solved_count  integer;
  v_next_mastery      numeric;
  v_recent_speed      numeric;
  v_confidence_level  text;
begin
  -- ── 0. LOAD ATTEMPT (for duration) ───────────────────────────────────────
  select started_at into v_started_at
  from   public.mission_attempts
  where  id         = p_attempt_id
    and  student_id = p_student_id;

  if not found then
    raise exception 'Mission attempt not found: %', p_attempt_id;
  end if;

  v_duration_sec := greatest(1,
    extract(epoch from (v_now - v_started_at))::integer
  );

  -- ── 1. XP ─────────────────────────────────────────────────────────────────
  v_base_xp := case
    when lower(p_difficulty) in ('hard', 'challenge') then 15
    else 10
  end;

  v_xp_earned := greatest(1, floor(v_base_xp * case
    when p_hint_used_count <= 0 then 1.0
    when p_hint_used_count = 1  then 0.9
    when p_hint_used_count = 2  then 0.75
    else                             0.6
  end)::integer);

  -- ── 2. PRE-COMPLETION LEVEL (subject-scoped XP) ──────────────────────────
  select coalesce(sum(coalesce(xp_earned, 0)), 0)
  into   v_prev_total_xp
  from   public.mission_attempts
  where  student_id = p_student_id
    and  status     = 'completed'
    and  subject    = p_subject;

  v_prev_level := floor(v_prev_total_xp::numeric / 30)::integer + 1;

  -- ── 3. MARK ATTEMPT COMPLETE ─────────────────────────────────────────────
  update public.mission_attempts
  set
    status        = 'completed',
    completed_at  = v_now,
    total_steps   = p_total_steps,
    correct_steps = p_correct_steps,
    score         = p_score,
    duration_sec  = v_duration_sec,
    subject       = p_subject,
    unit_id       = p_unit_id,
    xp_earned     = v_xp_earned,
    updated_at    = v_now
  where id         = p_attempt_id
    and student_id = p_student_id;

  -- ── 4. POST-COMPLETION LEVEL ─────────────────────────────────────────────
  v_new_total_xp := v_prev_total_xp + v_xp_earned;
  v_new_level    := floor(v_new_total_xp::numeric / 30)::integer + 1;
  v_leveled_up   := v_new_level > v_prev_level;
  v_xp_to_next   := greatest(0, v_new_level * 30 - v_new_total_xp);

  -- ── 5. BADGE CONTEXT ─────────────────────────────────────────────────────

  select count(distinct mission_id)
  into   v_total_completed
  from   public.mission_attempts
  where  student_id = p_student_id
    and  status     = 'completed';

  select count(distinct unit_id)
  into   v_distinct_units
  from   public.mission_attempts
  where  student_id = p_student_id
    and  status     = 'completed'
    and  unit_id    is not null;

  select count(distinct ma.mission_id)
  into   v_hard_count
  from   public.mission_attempts ma
  join   public.generated_missions gm on gm.id = ma.mission_id
  where  ma.student_id = p_student_id
    and  ma.status     = 'completed'
    and  lower(gm.difficulty) in ('hard', 'challenge');

  select count(distinct mission_id)
  into   v_math_count
  from   public.mission_attempts
  where  student_id = p_student_id
    and  status     = 'completed'
    and  subject    = 'math';

  select count(distinct mission_id)
  into   v_english_count
  from   public.mission_attempts
  where  student_id = p_student_id
    and  status     = 'completed'
    and  subject    = 'english';

  select count(distinct ma.mission_id)
  into   v_graph_count
  from   public.mission_attempts ma
  join   public.generated_missions gm on gm.id = ma.mission_id
  where  ma.student_id = p_student_id
    and  ma.status     = 'completed'
    and  ma.subject    = 'math'
    and  lower(
           coalesce(gm.title, '') || ' ' ||
           coalesce(gm.mission_json->>'mainConcept', '') || ' ' ||
           coalesce(gm.mission_json->>'scenario', '') || ' ' ||
           coalesce(gm.mission_json->>'conceptSummary', '') || ' ' ||
           coalesce(gm.mission_json->>'learningGoal', '') || ' ' ||
           coalesce(gm.mission_json->>'essentialQuestion', '')
         ) ~ 'graph|function|slope|coordinate|linear|quadratic|그래프|함수|좌표|기울기|일차함수|이차함수';

  select count(distinct ma.mission_id)
  into   v_geometry_count
  from   public.mission_attempts ma
  join   public.generated_missions gm on gm.id = ma.mission_id
  where  ma.student_id = p_student_id
    and  ma.status     = 'completed'
    and  ma.subject    = 'math'
    and  lower(
           coalesce(gm.title, '') || ' ' ||
           coalesce(gm.mission_json->>'mainConcept', '') || ' ' ||
           coalesce(gm.mission_json->>'scenario', '')
         ) ~ 'geometry|triangle|circle|angle|shape|scale|pythagorean|도형|삼각형|원|각|닮음|축척|피타고라스';

  select count(distinct ma.mission_id)
  into   v_logic_count
  from   public.mission_attempts ma
  join   public.generated_missions gm on gm.id = ma.mission_id
  where  ma.student_id = p_student_id
    and  ma.status     = 'completed'
    and  ma.subject    = 'math'
    and  lower(
           coalesce(gm.title, '') || ' ' ||
           coalesce(gm.mission_json->>'mainConcept', '') || ' ' ||
           coalesce(gm.mission_json->>'scenario', '')
         ) ~ 'expression|equation|inequality|probability|ratio|문자|방정식|연립|부등식|경우|확률|비와';

  select count(distinct ma.mission_id)
  into   v_reading_count
  from   public.mission_attempts ma
  join   public.generated_missions gm on gm.id = ma.mission_id
  where  ma.student_id = p_student_id
    and  ma.status     = 'completed'
    and  ma.subject    = 'english'
    and  lower(
           coalesce(gm.title, '') || ' ' ||
           coalesce(gm.mission_json->>'mainConcept', '') || ' ' ||
           coalesce(gm.mission_json->>'scenario', '')
         ) ~ 'read|reading|reader|notice|poster|story|article|announce|독해|읽기|안내문|포스터';

  select count(distinct ma.mission_id)
  into   v_speaking_count
  from   public.mission_attempts ma
  join   public.generated_missions gm on gm.id = ma.mission_id
  where  ma.student_id = p_student_id
    and  ma.status     = 'completed'
    and  ma.subject    = 'english'
    and  lower(
           coalesce(gm.title, '') || ' ' ||
           coalesce(gm.mission_json->>'mainConcept', '') || ' ' ||
           coalesce(gm.mission_json->>'scenario', '')
         ) ~ 'speak|speaking|speaker|conversation|dialogue|opinion|presentation|talk|말하기|대화|표현|발표|의견';

  -- Longest consecutive correct step streak (gap-and-island)
  with step_data as (
    select
      coalesce(is_correct, false) as ic,
      sum(case when coalesce(is_correct, false) = false then 1 else 0 end)
        over (order by coalesce(answered_at, created_at), step_order
              rows between unbounded preceding and current row) as fg
    from public.mission_step_attempts
    where student_id = p_student_id
  ),
  streaks as (
    select fg, count(*) as n
    from   step_data
    where  ic = true
    group  by fg
  )
  select coalesce(max(n), 0) into v_correct_streak from streaks;

  -- English day streak (consecutive KST calendar days ending at most-recent)
  with kst_days as (
    select distinct
      (completed_at at time zone 'UTC' at time zone 'Asia/Seoul')::date as d
    from public.mission_attempts
    where student_id = p_student_id
      and status     = 'completed'
      and subject    = 'english'
      and completed_at is not null
  ),
  ranked as (
    select d, (row_number() over (order by d desc) - 1) as offset_days
    from   kst_days
  )
  select coalesce(count(*), 0) into v_english_day_streak
  from   ranked
  where  d = (select max(d) from kst_days) - offset_days * interval '1 day';

  -- Overall day streak (all subjects, for response payload)
  with kst_days as (
    select distinct
      (completed_at at time zone 'UTC' at time zone 'Asia/Seoul')::date as d
    from public.mission_attempts
    where student_id = p_student_id
      and status     = 'completed'
      and completed_at is not null
  ),
  ranked as (
    select d, (row_number() over (order by d desc) - 1) as offset_days
    from   kst_days
  )
  select coalesce(count(*), 0) into v_day_streak
  from   ranked
  where  d = (select max(d) from kst_days) - offset_days * interval '1 day';

  -- ── 6. NEW BADGES (capture before upsert) ────────────────────────────────
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'key',         b.badge_key,
      'title',       b.title,
      'description', b.description,
      'iconUrl',     b.icon_url,
      'subject',     b.subject_scope,
      'earnedAt',    v_now
    ) order by b.title
  ), '[]'::jsonb)
  into v_new_badges
  from public.badges b
  left join public.student_badges sb
    on  sb.student_id = p_student_id
    and sb.badge_key  = b.badge_key
  where b.is_active = true
    and (b.subject_scope = 'common' or b.subject_scope = p_subject)
    and not coalesce(sb.is_earned, false)
    and (
      case b.badge_key
        when 'first_mission_complete' then v_total_completed
        when 'three_correct_streak'   then v_correct_streak
        when 'five_correct_streak'    then v_correct_streak
        when 'explorer_three_units'   then v_distinct_units
        when 'hard_challenger'        then v_hard_count
        when 'math_first_step'        then v_math_count
        when 'graph_explorer'         then v_graph_count
        when 'geometry_starter'       then v_geometry_count
        when 'logic_builder'          then v_logic_count
        when 'english_first_step'     then v_english_count
        when 'reader_starter'         then v_reading_count
        when 'speaker_starter'        then v_speaking_count
        when 'streak_reader'          then v_english_day_streak
        else 0
      end >= b.condition_value
    );

  -- ── 7. UPSERT ALL BADGE PROGRESS ─────────────────────────────────────────
  insert into public.student_badges (
    student_id, badge_id, badge_key, subject,
    related_mission_id, earned_at, progress_value, is_earned, updated_at
  )
  select
    p_student_id,
    b.id,
    b.badge_key,
    b.subject_scope,
    case
      when pv >= b.condition_value and not coalesce(sb.is_earned, false)
      then p_mission_id
      else sb.related_mission_id
    end,
    case
      when pv >= b.condition_value then coalesce(sb.earned_at, v_now)
      else null
    end,
    pv,
    pv >= b.condition_value,
    v_now
  from public.badges b
  left join public.student_badges sb
    on  sb.student_id = p_student_id
    and sb.badge_key  = b.badge_key
  cross join lateral (
    select case b.badge_key
      when 'first_mission_complete' then v_total_completed
      when 'three_correct_streak'   then v_correct_streak
      when 'five_correct_streak'    then v_correct_streak
      when 'explorer_three_units'   then v_distinct_units
      when 'hard_challenger'        then v_hard_count
      when 'math_first_step'        then v_math_count
      when 'graph_explorer'         then v_graph_count
      when 'geometry_starter'       then v_geometry_count
      when 'logic_builder'          then v_logic_count
      when 'english_first_step'     then v_english_count
      when 'reader_starter'         then v_reading_count
      when 'speaker_starter'        then v_speaking_count
      when 'streak_reader'          then v_english_day_streak
      else 0
    end as pv
  ) prog
  where b.is_active = true
    and (b.subject_scope = 'common' or b.subject_scope = p_subject)
  on conflict (student_id, badge_key, subject)
  do update set
    progress_value     = excluded.progress_value,
    is_earned          = excluded.is_earned or public.student_badges.is_earned,
    earned_at          = coalesce(public.student_badges.earned_at, excluded.earned_at),
    related_mission_id = coalesce(public.student_badges.related_mission_id, excluded.related_mission_id),
    badge_id           = coalesce(public.student_badges.badge_id, excluded.badge_id),
    updated_at         = v_now;

  -- ── 8. MASTERY ───────────────────────────────────────────────────────────
  if p_unit_id is not null then
    v_accuracy := case
      when p_total_steps > 0 then p_correct_steps::numeric / p_total_steps
      else 1.0
    end;

    select
      coalesce(mastery_score,  0),
      coalesce(solved_count,   0),
      coalesce(attempt_count,  0)
    into v_cur_mastery, v_cur_solved_count, v_cur_attempt_count
    from public.student_mastery
    where student_id = p_student_id
      and unit_id    = p_unit_id;

    v_next_attempt_count := coalesce(v_cur_attempt_count, 0) + 1;
    v_next_solved_count  := coalesce(v_cur_solved_count,  0) + case when v_accuracy >= 0.8 then 1 else 0 end;
    v_next_mastery       := round(
      ((coalesce(v_cur_mastery, 0) * coalesce(v_cur_attempt_count, 0)) + v_accuracy)
      / v_next_attempt_count, 2
    );
    v_recent_speed       := case
      when v_duration_sec is not null and p_total_steps > 0
      then round(v_duration_sec::numeric / p_total_steps, 2)
      else null
    end;
    v_confidence_level   := case
      when v_accuracy >= 0.8 then 'high'
      when v_accuracy >= 0.5 then 'medium'
      else 'low'
    end;

    insert into public.student_mastery (
      student_id, unit_id, subject,
      mastery_score, solved_count, attempt_count,
      last_attempt_at, recent_accuracy, recent_speed, confidence_level
    )
    values (
      p_student_id, p_unit_id, p_subject,
      v_next_mastery, v_next_solved_count, v_next_attempt_count,
      v_now, round(v_accuracy, 2), v_recent_speed, v_confidence_level
    )
    on conflict (student_id, unit_id)
    do update set
      mastery_score    = excluded.mastery_score,
      solved_count     = excluded.solved_count,
      attempt_count    = excluded.attempt_count,
      last_attempt_at  = excluded.last_attempt_at,
      recent_accuracy  = excluded.recent_accuracy,
      recent_speed     = excluded.recent_speed,
      confidence_level = excluded.confidence_level;
  end if;

  -- ── 9. RETURN ─────────────────────────────────────────────────────────────
  return jsonb_build_object(
    'xp_earned',  v_xp_earned,
    'total_xp',   v_new_total_xp,
    'level',      v_new_level,
    'prev_level', v_prev_level,
    'leveled_up', v_leveled_up,
    'xp_to_next', v_xp_to_next,
    'new_badges', v_new_badges,
    'streak',     v_day_streak
  );
end;
$$;

grant execute on function public.process_mission_complete(
  uuid, uuid, uuid, text, text, integer, integer, integer, integer, uuid
) to authenticated;

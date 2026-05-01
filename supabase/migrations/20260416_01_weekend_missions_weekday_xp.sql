-- ── Weekend Mission XP: Weekday Preview vs Weekend Bonus ────────────────────
-- 변경 내용:
--   base_xp  : 20 → 50  (모든 미션, 요일 무관)
--   bonus_xp : 130 → 100 (추천 + 주말 당일만 추가)  → 합계 150 XP 유지
--
-- 동작:
--   평일(월~금) 완료 → base_xp (50 XP)
--   토/일 + 추천 미션 완료 → base_xp + bonus_xp (150 XP)
--   토/일 + 일반 미션 완료 → base_xp (50 XP)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. 뷰: base_xp / bonus_xp 표시값 업데이트
create or replace view public.v_this_week_recommendations as
select
  r.id,
  r.mission_id,
  r.day_of_week,
  r.week_start,
  m.title,
  m.scenario,
  m.difficulty,
  m.estimated_minutes,
  m.mission_json,
  m.subject,
  50  as base_xp,
  100 as bonus_xp
from public.weekly_weekend_recommendations r
join public.generated_missions m
  on  m.id        = r.mission_id
  and m.status    = 'published'
  and m.is_active = true
where r.week_start = date_trunc('week', (now() at time zone 'Asia/Seoul'))::date;

-- 2. complete_weekend_mission: KST 요일 기반 XP 분기
create or replace function public.complete_weekend_mission(
  p_student_id  uuid,
  p_mission_id  uuid,
  p_score       integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week_start      date :=
    date_trunc('week', (now() at time zone 'Asia/Seoul'))::date;
  v_is_recommended  boolean;
  v_kst_dow         int;
  v_is_weekend_day  boolean;
  v_base_xp         integer := 50;
  v_bonus_xp        integer := 0;
  v_perfect_bonus   integer := 0;
  v_streak_bonus    integer := 0;
  v_xp_earned       integer;
  v_total_xp        integer;
  v_message         text;
begin
  -- 이번 주 추천 여부 확인
  select exists(
    select 1 from public.weekly_weekend_recommendations
    where mission_id = p_mission_id
      and week_start = v_week_start
  ) into v_is_recommended;

  -- KST 오늘 요일 (0=일요일, 6=토요일)
  v_kst_dow        := extract(dow from (now() at time zone 'Asia/Seoul'))::int;
  v_is_weekend_day := v_kst_dow = 0 or v_kst_dow = 6;

  -- 추천 미션 + 주말 당일에만 보너스 지급
  if v_is_recommended and v_is_weekend_day then
    v_bonus_xp := 100;  -- base(50) + bonus(100) = 150 XP
  end if;

  v_xp_earned := v_base_xp + v_bonus_xp + v_perfect_bonus + v_streak_bonus;

  -- 완료 기록 upsert (재시도 시 높은 XP 유지)
  insert into public.weekend_mission_completions (
    student_id, mission_id, score, xp_earned, is_recommended, week_start
  )
  values (
    p_student_id, p_mission_id, p_score, v_xp_earned, v_is_recommended, v_week_start
  )
  on conflict (student_id, mission_id, week_start) do update set
    score        = excluded.score,
    xp_earned    = greatest(
                     public.weekend_mission_completions.xp_earned,
                     excluded.xp_earned
                   ),
    completed_at = now();

  -- 이번 주 누적 XP
  select coalesce(sum(xp_earned), 0)
  into   v_total_xp
  from   public.weekend_mission_completions
  where  student_id = p_student_id
    and  week_start = v_week_start;

  v_message := case
    when v_is_recommended and v_is_weekend_day then '이번 주 추천 미션 완료! 보너스 XP를 획득했어요 🎉'
    when v_is_recommended and not v_is_weekend_day then '미션 완료! 주말에 다시 도전하면 보너스 XP를 받아요 💡'
    else '미션 완료! 수고했어요 💪'
  end;

  return jsonb_build_object(
    'success',        true,
    'is_recommended', v_is_recommended,
    'total_xp',       v_total_xp,
    'base_xp',        v_base_xp,
    'bonus_xp',       v_bonus_xp,
    'perfect_bonus',  v_perfect_bonus,
    'streak_bonus',   v_streak_bonus,
    'message',        v_message
  );
end;
$$;

grant execute on function public.complete_weekend_mission(uuid, uuid, integer)
  to authenticated;

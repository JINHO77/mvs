-- ── Weekend Mission System ──────────────────────────────────────────────────
-- Tables, view, and RPC functions for weekend challenge recommendations
-- and XP tracking.
--
-- XP 정책:
--   base_xp  = 20  (모든 미션)
--   bonus_xp = 130 (이번 주 추천 미션 추가 지급 → 총 150 XP)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. weekly_weekend_recommendations ─────────────────────────────────────────
create table if not exists public.weekly_weekend_recommendations (
  id          uuid    primary key default gen_random_uuid(),
  mission_id  uuid    not null references public.generated_missions(id) on delete cascade,
  day_of_week text    not null check (day_of_week in ('saturday', 'sunday')),
  week_start  date    not null,   -- KST 주 시작 (월요일)
  created_at  timestamptz not null default now(),
  unique (mission_id, day_of_week, week_start)
);

alter table public.weekly_weekend_recommendations enable row level security;

create policy "authenticated_read_weekend_recs"
  on public.weekly_weekend_recommendations for select
  using (auth.role() = 'authenticated');

-- 2. weekend_mission_completions ─────────────────────────────────────────────
create table if not exists public.weekend_mission_completions (
  id              uuid    primary key default gen_random_uuid(),
  student_id      uuid    not null references public.profiles(id) on delete cascade,
  mission_id      uuid    not null references public.generated_missions(id) on delete cascade,
  score           integer not null default 0,
  xp_earned       integer not null default 0,
  is_recommended  boolean not null default false,
  week_start      date    not null,
  completed_at    timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (student_id, mission_id, week_start)
);

alter table public.weekend_mission_completions enable row level security;

create policy "student_own_weekend_completions"
  on public.weekend_mission_completions for all
  using  (auth.uid() = student_id)
  with check (auth.uid() = student_id);

-- 3. v_this_week_recommendations ─────────────────────────────────────────────
--    base_xp  : 모든 미션 기본 XP
--    bonus_xp : 추천 미션 추가 XP (base + bonus = 150)
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
  20  as base_xp,
  130 as bonus_xp
from public.weekly_weekend_recommendations r
join public.generated_missions m
  on  m.id        = r.mission_id
  and m.status    = 'published'
  and m.is_active = true
where r.week_start = date_trunc('week', (now() at time zone 'Asia/Seoul'))::date;

-- 4. generate_weekly_weekend_recommendations() ───────────────────────────────
--    이번 주 추천 미션을 생성. 이미 생성된 경우 no-op.
create or replace function public.generate_weekly_weekend_recommendations()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week_start date :=
    date_trunc('week', (now() at time zone 'Asia/Seoul'))::date;
begin
  if exists (
    select 1 from public.weekly_weekend_recommendations
    where week_start = v_week_start
    limit 1
  ) then
    return;
  end if;

  -- 토요일: weekend_creative
  insert into public.weekly_weekend_recommendations (mission_id, day_of_week, week_start)
  select id, 'saturday', v_week_start
  from   public.generated_missions
  where  subject   = 'weekend_creative'
    and  status    = 'published'
    and  is_active = true
  order  by random()
  limit  3
  on conflict (mission_id, day_of_week, week_start) do nothing;

  -- 일요일: weekend_character
  insert into public.weekly_weekend_recommendations (mission_id, day_of_week, week_start)
  select id, 'sunday', v_week_start
  from   public.generated_missions
  where  subject   = 'weekend_character'
    and  status    = 'published'
    and  is_active = true
  order  by random()
  limit  3
  on conflict (mission_id, day_of_week, week_start) do nothing;
end;
$$;

grant execute on function public.generate_weekly_weekend_recommendations()
  to authenticated;

-- 5. complete_weekend_mission() ──────────────────────────────────────────────
--    완료 기록 upsert + XP 지급.
--    반환: { success, is_recommended, total_xp, base_xp, bonus_xp,
--            perfect_bonus, streak_bonus, message }
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
  v_week_start     date :=
    date_trunc('week', (now() at time zone 'Asia/Seoul'))::date;
  v_is_recommended boolean;
  v_base_xp        integer := 20;
  v_bonus_xp       integer := 0;
  v_perfect_bonus  integer := 0;
  v_streak_bonus   integer := 0;
  v_xp_earned      integer;
  v_total_xp       integer;
  v_message        text;
begin
  -- 이번 주 추천 여부 확인
  select exists(
    select 1 from public.weekly_weekend_recommendations
    where mission_id = p_mission_id
      and week_start = v_week_start
  ) into v_is_recommended;

  -- 추천 미션 보너스
  if v_is_recommended then
    v_bonus_xp := 130;  -- base(20) + bonus(130) = 150 XP
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
    when v_is_recommended then '이번 주 추천 미션 완료! 보너스 XP를 획득했어요 🎉'
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

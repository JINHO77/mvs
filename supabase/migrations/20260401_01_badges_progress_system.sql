begin;

create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  badge_key text not null unique,
  title text not null,
  description text not null,
  category text not null,
  icon_url text,
  subject_scope text not null,
  condition_type text not null,
  condition_value integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.badges
  add column if not exists badge_key text,
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists category text,
  add column if not exists icon_url text,
  add column if not exists subject_scope text,
  add column if not exists condition_type text,
  add column if not exists condition_value integer not null default 1,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists badges_badge_key_idx on public.badges (badge_key);
create index if not exists badges_subject_scope_idx on public.badges (subject_scope, is_active);

alter table public.mission_attempts
  add column if not exists subject text,
  add column if not exists unit_id uuid references public.curriculum_units(id) on delete set null,
  add column if not exists xp_earned integer not null default 0;

update public.mission_attempts ma
set
  subject = gm.subject,
  unit_id = gm.unit_id,
  xp_earned = case
    when ma.status = 'completed' and coalesce(ma.xp_earned, 0) = 0 and gm.difficulty in ('hard', 'challenge') then 15
    when ma.status = 'completed' and coalesce(ma.xp_earned, 0) = 0 then 10
    else coalesce(ma.xp_earned, 0)
  end
from public.generated_missions gm
where gm.id = ma.mission_id
  and (ma.subject is null or ma.unit_id is null or coalesce(ma.xp_earned, 0) = 0);

create index if not exists mission_attempts_student_subject_completed_idx
  on public.mission_attempts (student_id, subject, completed_at desc);
create index if not exists mission_attempts_student_unit_completed_idx
  on public.mission_attempts (student_id, unit_id, completed_at desc);

alter table public.student_badges
  add column if not exists badge_id uuid references public.badges(id) on delete set null,
  add column if not exists progress_value integer not null default 0,
  add column if not exists is_earned boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

update public.student_badges sb
set
  badge_id = b.id,
  progress_value = greatest(coalesce(sb.progress_value, 0), case when sb.earned_at is not null then 1 else 0 end),
  is_earned = coalesce(sb.is_earned, sb.earned_at is not null),
  updated_at = coalesce(sb.updated_at, sb.created_at, now())
from public.badges b
where b.badge_key = sb.badge_key
  and (sb.badge_id is null or sb.progress_value = 0 or sb.updated_at is null or sb.is_earned = false);

create index if not exists student_badges_student_subject_state_idx
  on public.student_badges (student_id, subject, is_earned, updated_at desc);
create index if not exists student_badges_badge_id_idx
  on public.student_badges (badge_id);

create or replace function public.set_badges_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_badges_updated_at on public.badges;
create trigger trg_badges_updated_at
before update on public.badges
for each row
execute function public.set_badges_updated_at();

create or replace function public.set_student_badges_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_student_badges_updated_at on public.student_badges;
create trigger trg_student_badges_updated_at
before update on public.student_badges
for each row
execute function public.set_student_badges_updated_at();

alter table public.badges enable row level security;

drop policy if exists "badges_active_select" on public.badges;
create policy "badges_active_select"
on public.badges for select
to authenticated
using (is_active = true);

drop policy if exists "student_badges_own_update" on public.student_badges;
create policy "student_badges_own_update"
on public.student_badges for update
to authenticated
using (auth.uid() = student_id)
with check (auth.uid() = student_id);

insert into public.badges (badge_key, title, description, category, icon_url, subject_scope, condition_type, condition_value, is_active)
values
  ('first_mission_complete', '첫 미션 완료', '첫 번째 미션을 완료해 학습 여정을 시작했어요.', 'starter', '/badges/first-step.svg', 'common', 'mission_complete_count', 1, true),
  ('three_correct_streak', '3연속 정답', '채점 단계에서 3번 연속 정답을 기록해 보세요.', 'streak', '/badges/streak-flare.svg', 'common', 'correct_step_streak', 3, true),
  ('five_correct_streak', '5연속 정답', '채점 단계에서 5번 연속 정답을 기록해 보세요.', 'streak', '/badges/streak-flare.svg', 'common', 'correct_step_streak', 5, true),
  ('explorer_three_units', '단원 탐험가', '서로 다른 단원 3개에서 미션을 완료해 보세요.', 'exploration', '/badges/unit-explorer.svg', 'common', 'distinct_unit_complete_count', 3, true),
  ('hard_challenger', '난이도 도전자', 'hard 또는 challenge 미션을 3개 완료해 보세요.', 'challenge', '/badges/challenge-crest.svg', 'common', 'difficulty_complete_count', 3, true),
  ('math_first_step', '수학 첫걸음', '첫 번째 수학 미션을 완료하면 열려요.', 'starter', '/badges/first-step.svg', 'math', 'mission_complete_count', 1, true),
  ('graph_explorer', '그래프 탐험가', '그래프나 함수와 연결된 수학 미션을 3개 완료해 보세요.', 'graph', '/badges/graph-wave.svg', 'math', 'keyword_mission_complete_count', 3, true),
  ('geometry_starter', '도형 스타터', '도형과 공간 감각을 다루는 수학 미션을 2개 완료해 보세요.', 'geometry', '/badges/geometry-gem.svg', 'math', 'keyword_mission_complete_count', 2, true),
  ('logic_builder', '논리 빌더', '식, 방정식, 확률 같은 논리형 수학 미션을 3개 완료해 보세요.', 'logic', '/badges/logic-circuit.svg', 'math', 'keyword_mission_complete_count', 3, true),
  ('english_first_step', '영어 첫걸음', '첫 번째 영어 미션을 완료하면 열려요.', 'starter', '/badges/first-step.svg', 'english', 'mission_complete_count', 1, true),
  ('reader_starter', '리더 스타터', '읽기 중심 영어 미션을 2개 완료해 보세요.', 'reading', '/badges/reading-bloom.svg', 'english', 'keyword_mission_complete_count', 2, true),
  ('speaker_starter', '스피커 스타터', '말하기와 표현 중심 영어 미션을 2개 완료해 보세요.', 'speaking', '/badges/speaking-spark.svg', 'english', 'keyword_mission_complete_count', 2, true),
  ('streak_reader', '꾸준한 리더', '영어 미션을 3일 연속 완료해 보세요.', 'streak', '/badges/streak-flare.svg', 'english', 'study_day_streak', 3, true)
on conflict (badge_key) do update
set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  icon_url = excluded.icon_url,
  subject_scope = excluded.subject_scope,
  condition_type = excluded.condition_type,
  condition_value = excluded.condition_value,
  is_active = excluded.is_active,
  updated_at = now();

update public.student_badges sb
set badge_id = b.id
from public.badges b
where b.badge_key = sb.badge_key
  and sb.badge_id is null;

commit;

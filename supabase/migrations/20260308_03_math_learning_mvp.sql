begin;

create table if not exists public.math_units (
  id uuid primary key default gen_random_uuid(),
  school_level text not null check (school_level in ('middle', 'high')),
  grade smallint,
  unit_key text not null unique,
  title text not null,
  description text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.math_missions (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.math_units(id) on delete cascade,
  mission_key text not null unique,
  title text not null,
  scenario text not null,
  essential_question text not null,
  concept_summary text not null,
  difficulty text not null check (difficulty in ('easy', 'normal', 'challenge')),
  estimated_minutes smallint not null default 5,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.math_steps (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.math_missions(id) on delete cascade,
  step_order smallint not null,
  title text not null,
  question text,
  input_placeholder text,
  correct_answer text,
  hint text,
  feedback_correct text,
  feedback_incorrect text,
  step_type text not null default 'input' check (step_type in ('input', 'concept')),
  concept_title text,
  concept_description text,
  created_at timestamptz not null default now(),
  unique (mission_id, step_order)
);

create table if not exists public.student_mission_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  mission_id uuid not null references public.math_missions(id) on delete cascade,
  current_step smallint not null default 1,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  answers_json jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, mission_id)
);

create or replace function public.set_student_mission_progress_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists trg_student_mission_progress_updated_at on public.student_mission_progress;
create trigger trg_student_mission_progress_updated_at
before update on public.student_mission_progress
for each row
execute function public.set_student_mission_progress_updated_at();

alter table public.math_units enable row level security;
alter table public.math_missions enable row level security;
alter table public.math_steps enable row level security;
alter table public.student_mission_progress enable row level security;

drop policy if exists "math_units_read_authenticated" on public.math_units;
create policy "math_units_read_authenticated"
on public.math_units for select
to authenticated
using (is_active = true);

drop policy if exists "math_missions_read_authenticated" on public.math_missions;
create policy "math_missions_read_authenticated"
on public.math_missions for select
to authenticated
using (is_active = true);

drop policy if exists "math_steps_read_authenticated" on public.math_steps;
create policy "math_steps_read_authenticated"
on public.math_steps for select
to authenticated
using (true);

drop policy if exists "student_progress_select_own" on public.student_mission_progress;
create policy "student_progress_select_own"
on public.student_mission_progress for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "student_progress_insert_own" on public.student_mission_progress;
create policy "student_progress_insert_own"
on public.student_mission_progress for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "student_progress_update_own" on public.student_mission_progress;
create policy "student_progress_update_own"
on public.student_mission_progress for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

insert into public.math_units (unit_key, school_level, grade, title, description, sort_order, is_active)
values
  ('middle-2-system-equation', 'middle', 2, '연립방정식', '두 식을 동시에 만족하는 값을 찾는 단원', 1, true),
  ('middle-2-linear-function', 'middle', 2, '일차함수', '변화율과 그래프를 읽는 단원', 2, true),
  ('middle-3-quadratic-function', 'middle', 3, '이차함수', '포물선과 최적값을 해석하는 단원', 3, true),
  ('high-statistics', 'high', 1, '확률과 통계', '데이터와 위험을 해석하는 단원', 4, true)
on conflict (unit_key) do update
set
  school_level = excluded.school_level,
  grade = excluded.grade,
  title = excluded.title,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

insert into public.math_missions (
  unit_id, mission_key, title, scenario, essential_question, concept_summary, difficulty, estimated_minutes, is_active
)
select u.id, m.mission_key, m.title, m.scenario, m.essential_question, m.concept_summary, m.difficulty, m.estimated_minutes, true
from (
  values
    ('middle-2-system-equation', 'm2-trip-settlement', '친구와 여행비 정산하기', '교통비와 숙박비를 나눠 내고 정산해야 하는 상황입니다.', '두 비용을 동시에 만족하는 값을 어떻게 찾을까?', '연립방정식은 두 식을 함께 만족하는 해를 구하는 방법입니다.', 'normal', 5),
    ('middle-2-linear-function', 'm2-taxi-graph', '택시요금 그래프 읽기', '기본요금과 거리요금을 그래프로 비교합니다.', '거리가 늘면 요금은 얼마나 빨리 증가할까?', '일차함수에서 기울기는 변화율, 절편은 시작값입니다.', 'normal', 4),
    ('middle-3-quadratic-function', 'm3-shot-trajectory', '농구 슛 궤적 분석', '공의 궤적 데이터를 보고 최고점을 찾습니다.', '포물선에서 최고점은 무엇을 의미할까?', '이차함수의 꼭짓점은 최댓값 또는 최솟값을 나타냅니다.', 'normal', 5),
    ('high-statistics', 'h-risk-return', '투자 수익과 위험 비교', '여러 선택지의 수익과 위험을 함께 비교해야 합니다.', '평균만 볼 때와 위험까지 볼 때 결론은 어떻게 달라질까?', '통계는 평균과 분산을 함께 해석해 의사결정을 돕습니다.', 'challenge', 5)
) as m(unit_key, mission_key, title, scenario, essential_question, concept_summary, difficulty, estimated_minutes)
join public.math_units u on u.unit_key = m.unit_key
on conflict (mission_key) do update
set
  unit_id = excluded.unit_id,
  title = excluded.title,
  scenario = excluded.scenario,
  essential_question = excluded.essential_question,
  concept_summary = excluded.concept_summary,
  difficulty = excluded.difficulty,
  estimated_minutes = excluded.estimated_minutes,
  is_active = excluded.is_active;

with target as (
  select id from public.math_missions where mission_key = 'm2-trip-settlement'
)
insert into public.math_steps (
  mission_id, step_order, title, question, input_placeholder, correct_answer, hint,
  feedback_correct, feedback_incorrect, step_type, concept_title, concept_description
)
select t.id, s.step_order, s.title, s.question, s.input_placeholder, s.correct_answer, s.hint,
  s.feedback_correct, s.feedback_incorrect, s.step_type, s.concept_title, s.concept_description
from target t
join (
  values
    (1, 'STEP 1 문제 이해', 'x + y = 총 여행비, 총 여행비는 얼마인가?', '숫자만 입력 (예: 48000)', '48000', '교통비와 숙박비 합계를 떠올려 보세요.', '정답입니다.', '합계 조건을 다시 확인해 보세요.', 'input', null, null),
    (2, 'STEP 2 식 세우기', 'x = y + ? 에서 ? 값은?', '숫자만 입력 (예: 8000)', '8000', '두 비용의 차이를 식으로 표현해 보세요.', '정답입니다.', 'x와 y의 차이를 다시 계산해 보세요.', 'input', null, null),
    (3, 'STEP 3 계산하기', 'y 값은?', '숫자만 입력 (예: 20000)', '20000', '연립해서 한 변수부터 구해 보세요.', '정답입니다.', '두 식에 대입해서 점검해 보세요.', 'input', null, null),
    (4, 'STEP 4 검산하기', 'x 값은?', '숫자만 입력 (예: 28000)', '28000', 'x = y + 8000을 이용해 보세요.', '정답입니다.', '이전 단계의 y 값을 다시 활용해 보세요.', 'input', null, null),
    (5, 'STEP 5 개념 설명', null, null, null, null, null, null, 'concept', '연립방정식', '두 개의 미지수를 가진 두 개의 식을 동시에 만족하는 값을 찾는 방법입니다.')
) as s(
  step_order, title, question, input_placeholder, correct_answer, hint, feedback_correct, feedback_incorrect, step_type, concept_title, concept_description
) on true
on conflict (mission_id, step_order) do update
set
  title = excluded.title,
  question = excluded.question,
  input_placeholder = excluded.input_placeholder,
  correct_answer = excluded.correct_answer,
  hint = excluded.hint,
  feedback_correct = excluded.feedback_correct,
  feedback_incorrect = excluded.feedback_incorrect,
  step_type = excluded.step_type,
  concept_title = excluded.concept_title,
  concept_description = excluded.concept_description;

commit;

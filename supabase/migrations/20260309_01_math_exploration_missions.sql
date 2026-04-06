begin;

create extension if not exists pgcrypto;

create table if not exists public.curriculum_units (
  id uuid primary key default gen_random_uuid(),
  subject text not null default 'math',
  school_level text not null check (school_level in ('elementary', 'middle', 'high')),
  grade smallint not null check (grade between 1 and 12),
  unit_key text not null unique,
  title text not null,
  description text,
  concept_summary text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.mission_templates (
  id uuid primary key default gen_random_uuid(),
  subject text not null default 'math',
  template_key text not null unique,
  title text not null,
  source_type text not null default 'manual' check (source_type in ('manual', 'ai')),
  prompt_template text,
  output_schema jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.generated_missions (
  id uuid primary key default gen_random_uuid(),
  subject text not null default 'math',
  unit_id uuid not null references public.curriculum_units(id) on delete cascade,
  template_id uuid references public.mission_templates(id) on delete set null,
  title text not null,
  difficulty text not null default 'normal' check (difficulty in ('easy', 'normal', 'challenge')),
  estimated_minutes smallint not null default 10 check (estimated_minutes between 1 and 120),
  source_type text not null default 'manual' check (source_type in ('manual', 'ai')),
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'archived')),
  mission_json jsonb not null default '{}'::jsonb,
  quality_notes text,
  created_by uuid references public.profiles(id),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  published_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mission_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  mission_id uuid not null,
  status text not null default 'started' check (status in ('started', 'completed', 'abandoned')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mission_step_attempts (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.mission_attempts(id) on delete cascade,
  mission_id uuid not null,
  step_order int not null check (step_order > 0),
  step_key text,
  answer_text text,
  is_correct boolean not null default false,
  elapsed_ms int,
  created_at timestamptz not null default now()
);

create table if not exists public.student_mastery (
  student_id uuid not null references public.profiles(id) on delete cascade,
  unit_id uuid not null references public.curriculum_units(id) on delete cascade,
  subject text not null default 'math',
  mastery_score numeric(5, 2) not null default 0,
  solved_count int not null default 0,
  attempt_count int not null default 0,
  last_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (student_id, unit_id)
);

alter table public.curriculum_units
  add column if not exists subject text not null default 'math',
  add column if not exists concept_summary text,
  add column if not exists created_by uuid references public.profiles(id);

alter table public.curriculum_units drop constraint if exists curriculum_units_grade_check;
alter table public.curriculum_units
  add constraint curriculum_units_grade_check
  check (grade between 1 and 12);

alter table public.mission_templates
  add column if not exists subject text not null default 'math',
  add column if not exists source_type text,
  add column if not exists created_by uuid references public.profiles(id);

alter table public.mission_templates
  alter column source_type set default 'manual';

update public.mission_templates
set source_type = coalesce(nullif(source_type, ''), 'manual')
where source_type is null
   or source_type not in ('manual', 'ai');

do $$
begin
  alter table public.mission_templates
    add constraint mission_templates_source_type_ck
    check (source_type in ('manual', 'ai'));
exception
  when duplicate_object then null;
end $$;

alter table public.generated_missions
  add column if not exists subject text not null default 'math',
  add column if not exists mission_json jsonb,
  add column if not exists source_type text,
  add column if not exists status text,
  add column if not exists difficulty text,
  add column if not exists estimated_minutes smallint,
  add column if not exists quality_notes text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id),
  add column if not exists created_by uuid references public.profiles(id),
  add column if not exists updated_at timestamptz not null default now();

update public.generated_missions
set mission_json = coalesce(mission_json, generated_payload, '{}'::jsonb)
where mission_json is null;

update public.generated_missions
set source_type = coalesce(nullif(source_type, ''), case when ai_model is not null then 'ai' else 'manual' end)
where source_type is null
   or source_type not in ('manual', 'ai');

update public.generated_missions
set status = coalesce(
  nullif(status, ''),
  case coalesce(review_status, 'draft')
    when 'approved' then 'published'
    when 'rejected' then 'archived'
    else 'draft'
  end
)
where status is null
   or status not in ('draft', 'review', 'published', 'archived');

update public.generated_missions
set difficulty = coalesce(
  nullif(difficulty, ''),
  case
    when mission_json ? 'difficulty'
      and (mission_json ->> 'difficulty') in ('easy', 'normal', 'challenge')
      then mission_json ->> 'difficulty'
    else 'normal'
  end
)
where difficulty is null
   or difficulty not in ('easy', 'normal', 'challenge');

update public.generated_missions
set estimated_minutes = coalesce(
  estimated_minutes,
  case
    when mission_json ? 'estimatedMinutes'
      then greatest(1, least(120, (mission_json ->> 'estimatedMinutes')::int))
    else 10
  end
)
where estimated_minutes is null
   or estimated_minutes < 1
   or estimated_minutes > 120;

alter table public.generated_missions
  alter column mission_json set not null,
  alter column source_type set default 'manual',
  alter column status set default 'draft',
  alter column difficulty set default 'normal',
  alter column estimated_minutes set default 10;

do $$
begin
  alter table public.generated_missions
    add constraint generated_missions_source_type_ck
    check (source_type in ('manual', 'ai'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.generated_missions
    add constraint generated_missions_status_ck
    check (status in ('draft', 'review', 'published', 'archived'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.generated_missions
    add constraint generated_missions_difficulty_ck
    check (difficulty in ('easy', 'normal', 'challenge'));
exception
  when duplicate_object then null;
end $$;

alter table public.mission_attempts
  add column if not exists student_id uuid references public.profiles(id),
  add column if not exists updated_at timestamptz not null default now();

update public.mission_attempts
set student_id = user_id
where student_id is null
  and user_id is not null;

alter table public.mission_attempts
  alter column student_id set not null;

alter table public.mission_step_attempts
  add column if not exists mission_id uuid,
  add column if not exists step_key text,
  add column if not exists elapsed_ms int;

update public.mission_step_attempts msa
set mission_id = ma.mission_id
from public.mission_attempts ma
where msa.attempt_id = ma.id
  and msa.mission_id is null;

alter table public.mission_step_attempts
  alter column mission_id set not null;

alter table public.student_mastery
  add column if not exists student_id uuid references public.profiles(id),
  add column if not exists unit_id uuid references public.curriculum_units(id),
  add column if not exists subject text not null default 'math',
  add column if not exists last_attempt_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists generated_missions_unit_status_idx
  on public.generated_missions (unit_id, status, created_at desc);
create index if not exists mission_attempts_student_status_idx
  on public.mission_attempts (student_id, status, started_at desc);
create index if not exists mission_step_attempts_attempt_step_idx
  on public.mission_step_attempts (attempt_id, step_order);
create index if not exists student_mastery_student_idx
  on public.student_mastery (student_id, updated_at desc);

do $$
begin
  alter table public.mission_attempts
    add constraint mission_attempts_mission_id_fk
    foreign key (mission_id) references public.generated_missions(id) on delete cascade
    not valid;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.mission_step_attempts
    add constraint mission_step_attempts_mission_id_fk
    foreign key (mission_id) references public.generated_missions(id) on delete cascade
    not valid;
exception
  when duplicate_object then null;
end $$;

create or replace function public.set_generated_missions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists trg_generated_missions_updated_at on public.generated_missions;
create trigger trg_generated_missions_updated_at
before update on public.generated_missions
for each row
execute function public.set_generated_missions_updated_at();

create or replace function public.set_mission_attempts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists trg_mission_attempts_updated_at on public.mission_attempts;
create trigger trg_mission_attempts_updated_at
before update on public.mission_attempts
for each row
execute function public.set_mission_attempts_updated_at();

create or replace function public.set_student_mastery_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists trg_student_mastery_updated_at on public.student_mastery;
create trigger trg_student_mastery_updated_at
before update on public.student_mastery
for each row
execute function public.set_student_mastery_updated_at();

alter table public.curriculum_units enable row level security;
alter table public.mission_templates enable row level security;
alter table public.generated_missions enable row level security;
alter table public.mission_attempts enable row level security;
alter table public.mission_step_attempts enable row level security;
alter table public.student_mastery enable row level security;

drop policy if exists "curriculum_units_student_owner_read" on public.curriculum_units;
create policy "curriculum_units_student_owner_read"
on public.curriculum_units for select
to authenticated
using (
  is_active = true
  and subject = 'math'
  and exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role in ('student', 'owner')
  )
);

drop policy if exists "generated_missions_student_published_read" on public.generated_missions;
create policy "generated_missions_student_published_read"
on public.generated_missions for select
to authenticated
using (
  subject = 'math'
  and status = 'published'
  and is_active = true
  and exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role = 'student'
  )
);

drop policy if exists "generated_missions_owner_manage_all" on public.generated_missions;
create policy "generated_missions_owner_manage_all"
on public.generated_missions for all
to authenticated
using (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role = 'owner'
  )
)
with check (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role = 'owner'
  )
);

drop policy if exists "mission_attempts_student_own_read" on public.mission_attempts;
create policy "mission_attempts_student_own_read"
on public.mission_attempts for select
to authenticated
using (
  student_id = auth.uid()
  and exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role = 'student'
  )
);

drop policy if exists "mission_attempts_student_own_insert" on public.mission_attempts;
create policy "mission_attempts_student_own_insert"
on public.mission_attempts for insert
to authenticated
with check (
  student_id = auth.uid()
  and exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role = 'student'
  )
);

drop policy if exists "mission_attempts_student_own_update" on public.mission_attempts;
create policy "mission_attempts_student_own_update"
on public.mission_attempts for update
to authenticated
using (
  student_id = auth.uid()
  and exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role = 'student'
  )
)
with check (
  student_id = auth.uid()
  and exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role = 'student'
  )
);

drop policy if exists "mission_attempts_owner_same_academy_read" on public.mission_attempts;
create policy "mission_attempts_owner_same_academy_read"
on public.mission_attempts for select
to authenticated
using (
  exists (
    select 1
    from public.profiles owner_profile
    join public.profiles student_profile on student_profile.id = mission_attempts.student_id
    where owner_profile.id = auth.uid()
      and owner_profile.role = 'owner'
      and owner_profile.academy_id is not null
      and owner_profile.academy_id = student_profile.academy_id
  )
);

drop policy if exists "mission_step_attempts_student_own_read" on public.mission_step_attempts;
create policy "mission_step_attempts_student_own_read"
on public.mission_step_attempts for select
to authenticated
using (
  exists (
    select 1
    from public.mission_attempts ma
    join public.profiles me on me.id = auth.uid()
    where ma.id = mission_step_attempts.attempt_id
      and ma.student_id = auth.uid()
      and me.role = 'student'
  )
);

drop policy if exists "mission_step_attempts_student_own_insert" on public.mission_step_attempts;
create policy "mission_step_attempts_student_own_insert"
on public.mission_step_attempts for insert
to authenticated
with check (
  exists (
    select 1
    from public.mission_attempts ma
    join public.profiles me on me.id = auth.uid()
    where ma.id = mission_step_attempts.attempt_id
      and ma.student_id = auth.uid()
      and me.role = 'student'
  )
);

drop policy if exists "mission_step_attempts_owner_same_academy_read" on public.mission_step_attempts;
create policy "mission_step_attempts_owner_same_academy_read"
on public.mission_step_attempts for select
to authenticated
using (
  exists (
    select 1
    from public.mission_attempts ma
    join public.profiles owner_profile on owner_profile.id = auth.uid()
    join public.profiles student_profile on student_profile.id = ma.student_id
    where ma.id = mission_step_attempts.attempt_id
      and owner_profile.role = 'owner'
      and owner_profile.academy_id is not null
      and owner_profile.academy_id = student_profile.academy_id
  )
);

drop policy if exists "student_mastery_student_own_read" on public.student_mastery;
create policy "student_mastery_student_own_read"
on public.student_mastery for select
to authenticated
using (
  student_id = auth.uid()
  and exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role = 'student'
  )
);

drop policy if exists "student_mastery_student_own_write" on public.student_mastery;
create policy "student_mastery_student_own_write"
on public.student_mastery for all
to authenticated
using (
  student_id = auth.uid()
  and exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role = 'student'
  )
)
with check (
  student_id = auth.uid()
  and exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role = 'student'
  )
);

drop policy if exists "student_mastery_owner_same_academy_read" on public.student_mastery;
create policy "student_mastery_owner_same_academy_read"
on public.student_mastery for select
to authenticated
using (
  exists (
    select 1
    from public.profiles owner_profile
    join public.profiles student_profile on student_profile.id = student_mastery.student_id
    where owner_profile.id = auth.uid()
      and owner_profile.role = 'owner'
      and owner_profile.academy_id is not null
      and owner_profile.academy_id = student_profile.academy_id
  )
);

insert into public.curriculum_units
  (unit_key, subject, school_level, grade, title, description, concept_summary, sort_order, is_active)
values
  ('math-e4-fractions', 'math', 'elementary', 4, '분수의 덧셈과 뺄셈', '분모를 맞추고 계산하는 기본 단원', '공통분모를 이용해 분수를 계산한다.', 1, true),
  ('math-e4-area', 'math', 'elementary', 4, '사각형 넓이', '직사각형과 정사각형 넓이 구하기', '넓이 공식을 문제 상황에 적용한다.', 2, true),
  ('math-e5-decimals', 'math', 'elementary', 5, '소수의 곱셈', '소수 자리수를 고려한 곱셈', '자리수 이동 원리로 계산 정확도를 높인다.', 3, true),
  ('math-e6-ratio', 'math', 'elementary', 6, '비와 비율', '비교량과 기준량 해석', '비율을 백분율로 변환해 해석한다.', 4, true),
  ('math-m1-equations', 'math', 'middle', 1, '일차방정식', '미지수가 하나인 방정식 풀이', '등식의 성질을 활용해 미지수를 구한다.', 5, true),
  ('math-m2-linear-functions', 'math', 'middle', 2, '일차함수', '기울기와 절편으로 상황을 모델링', '그래프와 식을 연결해 해석한다.', 6, true)
on conflict (unit_key) do update
set
  subject = excluded.subject,
  school_level = excluded.school_level,
  grade = excluded.grade,
  title = excluded.title,
  description = excluded.description,
  concept_summary = excluded.concept_summary,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

insert into public.generated_missions
  (unit_id, subject, title, difficulty, estimated_minutes, source_type, status, mission_json, is_active, published_at)
select
  cu.id,
  'math',
  m.title,
  m.difficulty,
  m.estimated_minutes,
  'manual',
  'published',
  m.mission_json::jsonb,
  true,
  now()
from (
  values
    (
      'math-e4-fractions',
      'easy',
      10,
      '초4 분수 1: 분모 맞추기',
      $json$
      {
        "missionKey": "e4-fraction-01",
        "title": "초4 분수 1: 분모 맞추기",
        "scenario": "피자 조각을 합치는 상황으로 분수 덧셈을 연습한다.",
        "essentialQuestion": "서로 다른 분모를 어떻게 같은 기준으로 바꿀까?",
        "conceptSummary": "공통분모를 만들고 분자를 계산한다.",
        "difficulty": "easy",
        "estimatedMinutes": 10,
        "steps": [
          { "stepOrder": 1, "title": "문제 읽기", "stepType": "concept", "conceptTitle": "상황 이해", "conceptDescription": "1/2 조각과 1/4 조각을 더한다." },
          { "stepOrder": 2, "title": "공통분모", "stepType": "input", "question": "1/2를 4분모로 바꾸면?", "inputPlaceholder": "예: 2/4", "correctAnswer": "2/4", "hint": "분모를 4로 만든다." },
          { "stepOrder": 3, "title": "계산", "stepType": "input", "question": "2/4 + 1/4 =", "inputPlaceholder": "예: 3/4", "correctAnswer": "3/4", "hint": "분자끼리 더한다." }
        ]
      }
      $json$
    ),
    (
      'math-e4-area',
      'easy',
      12,
      '초4 넓이 1: 교실 바닥 면적',
      $json$
      {
        "missionKey": "e4-area-01",
        "title": "초4 넓이 1: 교실 바닥 면적",
        "scenario": "교실 바닥 타일 개수를 면적으로 계산한다.",
        "essentialQuestion": "가로와 세로를 알면 넓이를 바로 구할 수 있을까?",
        "conceptSummary": "직사각형 넓이 = 가로 x 세로",
        "difficulty": "easy",
        "estimatedMinutes": 12,
        "steps": [
          { "stepOrder": 1, "title": "공식 확인", "stepType": "concept", "conceptTitle": "넓이 공식", "conceptDescription": "넓이는 가로와 세로의 곱이다." },
          { "stepOrder": 2, "title": "값 대입", "stepType": "input", "question": "가로 8m, 세로 6m의 넓이?", "inputPlaceholder": "숫자만", "correctAnswer": "48", "hint": "8 x 6" }
        ]
      }
      $json$
    ),
    (
      'math-e5-decimals',
      'normal',
      10,
      '초5 소수 1: 소수 곱셈',
      $json$
      {
        "missionKey": "e5-decimal-01",
        "title": "초5 소수 1: 소수 곱셈",
        "scenario": "간식 가격 계산으로 소수 곱셈을 연습한다.",
        "essentialQuestion": "소수점 위치는 어떻게 정할까?",
        "conceptSummary": "정수처럼 곱한 뒤 소수 자리수를 맞춘다.",
        "difficulty": "normal",
        "estimatedMinutes": 10,
        "steps": [
          { "stepOrder": 1, "title": "문제", "stepType": "input", "question": "1.2 x 3 =", "inputPlaceholder": "숫자", "correctAnswer": "3.6", "hint": "12 x 3 = 36, 소수 한 자리" },
          { "stepOrder": 2, "title": "확장", "stepType": "input", "question": "2.5 x 0.4 =", "inputPlaceholder": "숫자", "correctAnswer": "1", "hint": "25 x 4 = 100, 소수 두 자리" }
        ]
      }
      $json$
    ),
    (
      'math-e6-ratio',
      'normal',
      10,
      '초6 비율 1: 할인율 계산',
      $json$
      {
        "missionKey": "e6-ratio-01",
        "title": "초6 비율 1: 할인율 계산",
        "scenario": "상점 할인 전후 가격으로 할인율을 계산한다.",
        "essentialQuestion": "기준량이 바뀌면 비율 해석도 달라질까?",
        "conceptSummary": "비율 = 비교량 / 기준량",
        "difficulty": "normal",
        "estimatedMinutes": 10,
        "steps": [
          { "stepOrder": 1, "title": "기준량 찾기", "stepType": "concept", "conceptTitle": "기준 정하기", "conceptDescription": "원래 가격이 기준량이다." },
          { "stepOrder": 2, "title": "할인율", "stepType": "input", "question": "10,000원에서 8,000원이면 할인율(%)?", "inputPlaceholder": "숫자만", "correctAnswer": "20", "hint": "할인금액 2,000원을 기준량 10,000으로 나눈다." }
        ]
      }
      $json$
    ),
    (
      'math-m1-equations',
      'normal',
      12,
      '중1 방정식 1: 한 번에 정리하기',
      $json$
      {
        "missionKey": "m1-eq-01",
        "title": "중1 방정식 1: 한 번에 정리하기",
        "scenario": "간단한 일차방정식을 단계별로 푼다.",
        "essentialQuestion": "등식의 양변에 같은 연산을 하면 왜 식이 유지될까?",
        "conceptSummary": "이항과 나눗셈으로 미지수를 고립한다.",
        "difficulty": "normal",
        "estimatedMinutes": 12,
        "steps": [
          { "stepOrder": 1, "title": "이항", "stepType": "input", "question": "x + 7 = 20, x는?", "inputPlaceholder": "숫자", "correctAnswer": "13", "hint": "20 - 7" },
          { "stepOrder": 2, "title": "검산", "stepType": "concept", "conceptTitle": "검산", "conceptDescription": "x=13을 대입하면 13+7=20이다." }
        ]
      }
      $json$
    ),
    (
      'math-m2-linear-functions',
      'challenge',
      15,
      '중2 함수 1: 기울기 해석',
      $json$
      {
        "missionKey": "m2-func-01",
        "title": "중2 함수 1: 기울기 해석",
        "scenario": "택시 요금 그래프로 기울기의 의미를 해석한다.",
        "essentialQuestion": "기울기는 실제 상황에서 어떤 단위를 가지는가?",
        "conceptSummary": "기울기는 x 1 증가당 y 증가량이다.",
        "difficulty": "challenge",
        "estimatedMinutes": 15,
        "steps": [
          { "stepOrder": 1, "title": "그래프 읽기", "stepType": "concept", "conceptTitle": "기울기 의미", "conceptDescription": "거리 1km 증가 시 요금 증가량을 본다." },
          { "stepOrder": 2, "title": "계산", "stepType": "input", "question": "기울기 1200, 3km 추가 요금은?", "inputPlaceholder": "숫자", "correctAnswer": "3600", "hint": "1200 x 3" }
        ]
      }
      $json$
    )
) as m(unit_key, difficulty, estimated_minutes, title, mission_json)
join public.curriculum_units cu on cu.unit_key = m.unit_key
where not exists (
  select 1
  from public.generated_missions gm
  where gm.unit_id = cu.id
    and gm.title = m.title
    and gm.source_type = 'manual'
);

commit;

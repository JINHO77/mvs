begin;

create table if not exists public.curriculum_units (
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

create table if not exists public.mission_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  title text not null,
  prompt_template text not null,
  output_schema jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.generated_missions (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.curriculum_units(id) on delete cascade,
  template_id uuid references public.mission_templates(id) on delete set null,
  title text not null,
  ai_model text,
  generated_payload jsonb not null,
  review_status text not null default 'draft' check (review_status in ('draft', 'approved', 'rejected')),
  review_note text,
  created_by uuid references public.profiles(id),
  reviewed_by uuid references public.profiles(id),
  is_active boolean not null default true,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mission_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  mission_id uuid not null,
  mission_source text not null default 'static' check (mission_source in ('static', 'ai')),
  status text not null default 'started' check (status in ('started', 'completed', 'abandoned')),
  score numeric(5,2),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.mission_step_attempts (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.mission_attempts(id) on delete cascade,
  step_order int not null,
  answer_text text,
  is_correct boolean not null default false,
  latency_ms int,
  created_at timestamptz not null default now()
);

create table if not exists public.student_mastery (
  user_id uuid not null references public.profiles(id) on delete cascade,
  unit_key text not null,
  mission_source text not null default 'static' check (mission_source in ('static', 'ai')),
  mastery_score numeric(5,2) not null default 0,
  solved_count int not null default 0,
  attempt_count int not null default 0,
  last_mission_id uuid,
  updated_at timestamptz not null default now(),
  primary key (user_id, unit_key, mission_source)
);

alter table public.student_mission_progress
  add column if not exists mission_source text not null default 'static' check (mission_source in ('static', 'ai'));

do $$
declare
  fk_name text;
begin
  select conname into fk_name
  from pg_constraint
  where conrelid = 'public.student_mission_progress'::regclass
    and contype = 'f'
    and conname like '%mission_id%';
  if fk_name is not null then
    execute format('alter table public.student_mission_progress drop constraint %I', fk_name);
  end if;
end $$;

alter table public.student_mission_progress drop constraint if exists student_mission_progress_pkey;
alter table public.student_mission_progress add primary key (user_id, mission_id, mission_source);

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

alter table public.curriculum_units enable row level security;
alter table public.mission_templates enable row level security;
alter table public.generated_missions enable row level security;
alter table public.mission_attempts enable row level security;
alter table public.mission_step_attempts enable row level security;
alter table public.student_mastery enable row level security;

drop policy if exists "curriculum_units_read_authenticated" on public.curriculum_units;
create policy "curriculum_units_read_authenticated"
on public.curriculum_units for select
to authenticated
using (is_active = true);

drop policy if exists "mission_templates_owner_read" on public.mission_templates;
create policy "mission_templates_owner_read"
on public.mission_templates for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'owner'
  )
);

drop policy if exists "generated_missions_owner_manage" on public.generated_missions;
create policy "generated_missions_owner_manage"
on public.generated_missions for all
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'owner'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'owner'
  )
);

drop policy if exists "generated_missions_student_read_approved" on public.generated_missions;
create policy "generated_missions_student_read_approved"
on public.generated_missions for select
to authenticated
using (review_status = 'approved' and is_active = true and published_at is not null);

drop policy if exists "mission_attempts_own_select" on public.mission_attempts;
create policy "mission_attempts_own_select"
on public.mission_attempts for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "mission_attempts_own_insert" on public.mission_attempts;
create policy "mission_attempts_own_insert"
on public.mission_attempts for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "mission_attempts_own_update" on public.mission_attempts;
create policy "mission_attempts_own_update"
on public.mission_attempts for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "mission_step_attempts_own_rw" on public.mission_step_attempts;
create policy "mission_step_attempts_own_rw"
on public.mission_step_attempts for all
to authenticated
using (
  exists (
    select 1
    from public.mission_attempts ma
    where ma.id = mission_step_attempts.attempt_id
      and ma.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.mission_attempts ma
    where ma.id = mission_step_attempts.attempt_id
      and ma.user_id = auth.uid()
  )
);

drop policy if exists "student_mastery_own_rw" on public.student_mastery;
create policy "student_mastery_own_rw"
on public.student_mastery for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

commit;

create extension if not exists pgcrypto;

create table if not exists public.handover_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  organization_name text not null,
  industry text,
  organization_context text,
  job_title text not null,
  department text,
  trainee_level text default 'beginner',
  training_days integer default 5,
  job_importance text,
  daily_workflow text,
  main_tasks text,
  critical_tasks text,
  handover_rules text,
  do_not_do text,
  common_mistakes text,
  common_situations text,
  required_tools text,
  success_criteria text,
  final_goal text,
  status text default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.handover_projects (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.handover_jobs(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  summary text,
  generated_json jsonb not null,
  status text default 'generated',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.handover_submissions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.handover_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  answer text not null,
  status text default 'submitted',
  created_at timestamptz not null default now()
);

create table if not exists public.handover_feedback (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.handover_projects(id) on delete cascade,
  submission_id uuid references public.handover_submissions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  score integer,
  strengths text,
  improvements text,
  feedback_json jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_handover_jobs_updated_at on public.handover_jobs;
create trigger set_handover_jobs_updated_at
before update on public.handover_jobs
for each row execute function public.set_updated_at();

drop trigger if exists set_handover_projects_updated_at on public.handover_projects;
create trigger set_handover_projects_updated_at
before update on public.handover_projects
for each row execute function public.set_updated_at();

alter table public.handover_jobs enable row level security;
alter table public.handover_projects enable row level security;
alter table public.handover_submissions enable row level security;
alter table public.handover_feedback enable row level security;

drop policy if exists "Users can read own handover jobs" on public.handover_jobs;
create policy "Users can read own handover jobs"
on public.handover_jobs for select
using (auth.uid() = owner_id);

drop policy if exists "Users can insert own handover jobs" on public.handover_jobs;
create policy "Users can insert own handover jobs"
on public.handover_jobs for insert
with check (auth.uid() = owner_id);

drop policy if exists "Users can update own handover jobs" on public.handover_jobs;
create policy "Users can update own handover jobs"
on public.handover_jobs for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "Users can delete own handover jobs" on public.handover_jobs;
create policy "Users can delete own handover jobs"
on public.handover_jobs for delete
using (auth.uid() = owner_id);

drop policy if exists "Users can read own handover projects" on public.handover_projects;
create policy "Users can read own handover projects"
on public.handover_projects for select
using (auth.uid() = owner_id);

drop policy if exists "Users can insert own handover projects" on public.handover_projects;
create policy "Users can insert own handover projects"
on public.handover_projects for insert
with check (auth.uid() = owner_id);

drop policy if exists "Users can update own handover projects" on public.handover_projects;
create policy "Users can update own handover projects"
on public.handover_projects for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "Users can delete own handover projects" on public.handover_projects;
create policy "Users can delete own handover projects"
on public.handover_projects for delete
using (auth.uid() = owner_id);

drop policy if exists "Users can read own handover submissions" on public.handover_submissions;
create policy "Users can read own handover submissions"
on public.handover_submissions for select
using (auth.uid() = owner_id);

drop policy if exists "Users can insert own handover submissions" on public.handover_submissions;
create policy "Users can insert own handover submissions"
on public.handover_submissions for insert
with check (auth.uid() = owner_id);

drop policy if exists "Users can update own handover submissions" on public.handover_submissions;
create policy "Users can update own handover submissions"
on public.handover_submissions for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "Users can delete own handover submissions" on public.handover_submissions;
create policy "Users can delete own handover submissions"
on public.handover_submissions for delete
using (auth.uid() = owner_id);

drop policy if exists "Users can read own handover feedback" on public.handover_feedback;
create policy "Users can read own handover feedback"
on public.handover_feedback for select
using (auth.uid() = owner_id);

drop policy if exists "Users can insert own handover feedback" on public.handover_feedback;
create policy "Users can insert own handover feedback"
on public.handover_feedback for insert
with check (auth.uid() = owner_id);

drop policy if exists "Users can update own handover feedback" on public.handover_feedback;
create policy "Users can update own handover feedback"
on public.handover_feedback for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "Users can delete own handover feedback" on public.handover_feedback;
create policy "Users can delete own handover feedback"
on public.handover_feedback for delete
using (auth.uid() = owner_id);

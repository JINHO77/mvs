create table if not exists public.student_weekly_paths (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  subject text not null check (subject in ('math', 'english')),
  week_key integer not null,
  path_key text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (student_id, subject, week_key)
);

create index if not exists idx_student_weekly_paths_student_subject_week
  on public.student_weekly_paths (student_id, subject, week_key);

alter table public.student_weekly_paths enable row level security;

drop policy if exists "student_weekly_paths_select_own" on public.student_weekly_paths;
create policy "student_weekly_paths_select_own"
  on public.student_weekly_paths
  for select
  using (auth.uid() = student_id);

drop policy if exists "student_weekly_paths_insert_own" on public.student_weekly_paths;
create policy "student_weekly_paths_insert_own"
  on public.student_weekly_paths
  for insert
  with check (auth.uid() = student_id);

drop policy if exists "student_weekly_paths_update_own" on public.student_weekly_paths;
create policy "student_weekly_paths_update_own"
  on public.student_weekly_paths
  for update
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

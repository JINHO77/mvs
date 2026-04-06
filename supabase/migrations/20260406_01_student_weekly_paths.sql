create table if not exists public.student_weekly_paths (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  subject text not null,
  week_key integer not null,
  path_key text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (student_id, subject, week_key)
);

create index if not exists idx_student_weekly_paths_student_subject_week
on public.student_weekly_paths (student_id, subject, week_key);

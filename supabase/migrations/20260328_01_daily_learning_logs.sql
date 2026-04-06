begin;

create table if not exists public.daily_learning_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null default 'english',
  log_date date not null,
  pack_payload jsonb not null default '{}'::jsonb,
  completed_steps integer not null default 0,
  total_steps integer not null default 3,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists daily_learning_logs_student_subject_date_idx
  on public.daily_learning_logs (student_id, subject, log_date);

create index if not exists daily_learning_logs_student_subject_updated_idx
  on public.daily_learning_logs (student_id, subject, updated_at desc);

alter table public.daily_learning_logs enable row level security;

drop policy if exists "daily_learning_logs_own_select" on public.daily_learning_logs;
create policy "daily_learning_logs_own_select"
on public.daily_learning_logs for select
to authenticated
using (auth.uid() = student_id);

drop policy if exists "daily_learning_logs_own_insert" on public.daily_learning_logs;
create policy "daily_learning_logs_own_insert"
on public.daily_learning_logs for insert
to authenticated
with check (auth.uid() = student_id);

drop policy if exists "daily_learning_logs_own_update" on public.daily_learning_logs;
create policy "daily_learning_logs_own_update"
on public.daily_learning_logs for update
to authenticated
using (auth.uid() = student_id)
with check (auth.uid() = student_id);

commit;

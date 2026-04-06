begin;

create table if not exists public.student_badges (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  badge_key text not null,
  subject text not null default 'english',
  related_mission_id uuid null references public.generated_missions(id) on delete set null,
  earned_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists student_badges_student_badge_subject_idx
  on public.student_badges (student_id, badge_key, subject);

create index if not exists student_badges_student_subject_earned_idx
  on public.student_badges (student_id, subject, earned_at desc);

alter table public.student_badges enable row level security;

drop policy if exists "student_badges_own_select" on public.student_badges;
create policy "student_badges_own_select"
on public.student_badges for select
to authenticated
using (auth.uid() = student_id);

drop policy if exists "student_badges_own_insert" on public.student_badges;
create policy "student_badges_own_insert"
on public.student_badges for insert
to authenticated
with check (auth.uid() = student_id);

commit;

-- 1) reports 메타데이터
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null,
  student_id uuid not null references public.profiles(id) on delete cascade,
  month date not null, -- 해당 월의 1일(예: 2026-03-01)로 저장
  math_pdf_path text null, -- storage.objects path
  math_pdf_name text null,
  math_pdf_size bigint null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_id, month)
);

create index if not exists reports_student_month_idx on public.reports(student_id, month);

-- 2) 영어 성취 지표 (원장 입력)
create table if not exists public.report_english_metrics (
  report_id uuid primary key references public.reports(id) on delete cascade,
  vocab integer null,      -- 단어/숙어
  reading integer null,    -- 독해
  grammar integer null,    -- 문법
  listening integer null,  -- 듣기
  note text null,
  updated_at timestamptz not null default now()
);

-- updated_at 자동 갱신 트리거(없으면 생성)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_reports_updated_at on public.reports;
create trigger trg_reports_updated_at
before update on public.reports
for each row execute function public.set_updated_at();

drop trigger if exists trg_report_english_metrics_updated_at on public.report_english_metrics;
create trigger trg_report_english_metrics_updated_at
before update on public.report_english_metrics
for each row execute function public.set_updated_at();

-- ========================
-- RLS
-- ========================
alter table public.reports enable row level security;
alter table public.report_english_metrics enable row level security;

-- reports: owner만 생성/수정/삭제 가능(같은 academy 기준)
drop policy if exists "reports_owner_manage" on public.reports;
create policy "reports_owner_manage"
on public.reports
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'owner'
      and p.account_status = 'active'
      and p.academy_id = reports.academy_id
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'owner'
      and p.account_status = 'active'
      and p.academy_id = reports.academy_id
  )
);

-- reports: student 본인은 열람 가능(승인 active + 본인 student_id)
drop policy if exists "reports_student_read_own" on public.reports;
create policy "reports_student_read_own"
on public.reports
for select
to authenticated
using (
  student_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.account_status = 'active'
  )
);

-- reports: guardian(학부모)은 연결된 학생의 리포트만 열람 가능
drop policy if exists "reports_guardian_read_linked" on public.reports;
create policy "reports_guardian_read_linked"
on public.reports
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'parent'
      and p.account_status = 'active'
  )
  and exists (
    select 1
    from public.student_guardians sg
    where sg.guardian_id = auth.uid()
      and sg.student_id = reports.student_id
  )
);

-- 영어지표: reports select 권한과 동일하게 열람, owner만 수정
drop policy if exists "english_metrics_owner_manage" on public.report_english_metrics;
create policy "english_metrics_owner_manage"
on public.report_english_metrics
for all
to authenticated
using (
  exists (
    select 1
    from public.reports r
    join public.profiles p on p.id = auth.uid()
    where r.id = report_english_metrics.report_id
      and p.role = 'owner'
      and p.account_status = 'active'
      and p.academy_id = r.academy_id
  )
)
with check (
  exists (
    select 1
    from public.reports r
    join public.profiles p on p.id = auth.uid()
    where r.id = report_english_metrics.report_id
      and p.role = 'owner'
      and p.account_status = 'active'
      and p.academy_id = r.academy_id
  )
);

drop policy if exists "english_metrics_read_via_reports" on public.report_english_metrics;
create policy "english_metrics_read_via_reports"
on public.report_english_metrics
for select
to authenticated
using (
  exists (
    select 1
    from public.reports r
    where r.id = report_english_metrics.report_id
      and (
        r.student_id = auth.uid()
        or exists (
          select 1
          from public.student_guardians sg
          where sg.guardian_id = auth.uid()
            and sg.student_id = r.student_id
        )
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid() and p.role = 'owner'
        )
      )
  )
);

-- ========================
-- signed url 발급 RPC (학생/학부모가 PDF 다운로드 버튼 누르면 서버가 URL을 발급)
-- 학생/학부모가 storage 직접 select를 못 해도 다운로드는 가능.
-- ========================

create or replace function public.get_report_pdf_signed_url(p_report_id uuid, p_expires_in integer default 120)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_path text;
  v_student uuid;
  v_academy uuid;
  v_role text;
  v_status text;
begin
  select r.math_pdf_path, r.student_id, r.academy_id into v_path, v_student, v_academy
  from public.reports r
  where r.id = p_report_id;

  if v_path is null then
    raise exception 'No PDF attached';
  end if;

  select p.role::text, p.account_status into v_role, v_status
  from public.profiles p
  where p.id = auth.uid();

  if v_status is distinct from 'active' then
    raise exception 'Inactive account';
  end if;

  -- 접근권한 체크: owner(같은 academy) OR student 본인 OR guardian 연결
  if v_role = 'owner' then
    if not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.academy_id = v_academy
    ) then
      raise exception 'Forbidden';
    end if;
  elsif v_role = 'student' then
    if auth.uid() <> v_student then
      raise exception 'Forbidden';
    end if;
  elsif v_role = 'parent' then
    if not exists (
      select 1 from public.student_guardians sg
      where sg.guardian_id = auth.uid() and sg.student_id = v_student
    ) then
      raise exception 'Forbidden';
    end if;
  else
    raise exception 'Forbidden';
  end if;

  -- storage signed url 생성은 DB에서 직접 만들기 어렵기 때문에,
  -- 실제 구현은 "Edge Function" 또는 "서버 액션"에서 createSignedUrl 호출이 더 깔끔하다.
  -- 그러나 MVP는 클라이언트에서 owner만 다운로드하도록 하고, 학생/학부모는 추후 Edge Function으로 확장한다.
  -- 여기서는 일단 path만 반환한다.
  return v_path;
end; $$;

-- 위 함수는 MVP 1단계에서 "path를 반환"만 한다.
-- MVP 2단계: Next.js 서버 라우트(/api/reports/signed-url)에서
-- supabase(service role)로 storage.createSignedUrl(path) 호출 후 signedUrl 반환하도록 한다.

-- Readiness checks for phased NOT NULL / FK hardening.
-- Do not enforce NOT NULL or FK until data is clean and target table is verified.

-- 1) Existing NULL student_id count in consultation_requests.
select count(*) as consultation_requests_student_id_null_count
from public.consultation_requests
where student_id is null;

-- 2) Rows that would fail student_guardians ownership relationship check.
select count(*) as consultation_requests_missing_guardian_student_link_count
from public.consultation_requests cr
where cr.student_id is not null
  and not exists (
    select 1
    from public.student_guardians sg
    where sg.guardian_id = cr.guardian_id
      and sg.student_id = cr.student_id
  );

-- TODO (phase 2, after null_count = 0 and schema validated):
-- alter table public.consultation_requests
--   alter column student_id set not null;
--
-- Verify reference target first (profiles vs dedicated students table), then apply FK:
-- alter table public.consultation_requests
--   add constraint consultation_requests_student_fk
--   foreign key (student_id) references public.profiles(id);


alter table public.reports drop constraint if exists reports_subject_check;
alter table public.reports add constraint reports_subject_check
  check (subject = any (array['math'::text, 'english'::text, 'monthly'::text]));

-- reports.subject defensive default for monthly reports
alter table if exists public.reports
  add column if not exists subject text;

update public.reports
set subject = 'monthly'
where subject is null;

alter table if exists public.reports
  alter column subject set default 'monthly';

alter table if exists public.reports
  alter column subject set not null;

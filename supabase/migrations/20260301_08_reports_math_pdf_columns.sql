alter table if exists public.reports
  add column if not exists math_pdf_path text;

alter table if exists public.reports
  add column if not exists math_pdf_name text;

alter table if exists public.reports
  add column if not exists math_pdf_size integer;

create index if not exists reports_math_pdf_path_idx
  on public.reports (math_pdf_path);

alter table if exists public.reports
  add column if not exists month date;

update public.reports
set month = date_trunc('month', created_at)::date
where month is null;

create index if not exists reports_month_desc_idx
  on public.reports (month desc);

create index if not exists reports_student_month_desc_idx
  on public.reports (student_id, month desc);

with ranked as (
  select
    id,
    row_number() over (
      partition by student_id, month
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as rn
  from public.reports
  where month is not null
)
delete from public.reports r
using ranked d
where r.id = d.id
  and d.rn > 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reports_student_id_month_key'
      and conrelid = 'public.reports'::regclass
  ) then
    alter table public.reports
      add constraint reports_student_id_month_key unique (student_id, month);
  end if;
end $$;

-- reports_subject_check 확장: 기존 제약식을 보존하면서 monthly 허용을 추가
-- 사전 확인용(SQL Editor에서 수동 실행 권장):
-- select conname, pg_get_constraintdef(oid) as def
-- from pg_constraint
-- where conname = 'reports_subject_check';
--
-- select subject, count(*)
-- from public.reports
-- group by subject;

do $$
declare
  v_constraint_expr text;
begin
  select regexp_replace(pg_get_constraintdef(c.oid), '^CHECK \\((.*)\\)$', '\\1')
    into v_constraint_expr
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where c.conname = 'reports_subject_check'
    and n.nspname = 'public'
    and t.relname = 'reports'
  limit 1;

  alter table public.reports
    drop constraint if exists reports_subject_check;

  if v_constraint_expr is null then
    alter table public.reports
      add constraint reports_subject_check
      check (subject = 'monthly');
  else
    execute format(
      'alter table public.reports add constraint reports_subject_check check ((%s) or subject = ''monthly'')',
      v_constraint_expr
    );
  end if;
end $$;

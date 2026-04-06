-- Account status hardening with withdrawn state support.

alter table public.profiles
add column if not exists account_status text not null default 'active';

alter table public.profiles
drop constraint if exists profiles_account_status_check;

alter table public.profiles
add constraint profiles_account_status_check
check (account_status in ('pending', 'active', 'blocked', 'withdrawn'));

-- Optional test-environment bootstrap:
-- update public.profiles
-- set account_status = 'pending'
-- where role = 'student';

create or replace function public.owner_set_student_status(p_student_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  me_role text;
begin
  select role into me_role
  from public.profiles
  where id = auth.uid();

  if me_role not in ('owner','teacher') then
    raise exception 'forbidden';
  end if;

  if p_status not in ('pending', 'active', 'blocked', 'withdrawn') then
    raise exception 'invalid status';
  end if;

  update public.profiles
  set account_status = p_status
  where id = p_student_id
    and role = 'student';
end;
$$;

grant execute on function public.owner_set_student_status(uuid, text) to authenticated;

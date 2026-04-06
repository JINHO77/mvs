-- Replace approved_at-based student approval flow with account_status.

alter table public.profiles
add column if not exists account_status text not null default 'active';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_account_status_check'
  ) then
    alter table public.profiles
    add constraint profiles_account_status_check
    check (account_status in ('active','pending','blocked'));
  end if;
end$$;

create index if not exists profiles_role_status_idx
on public.profiles (role, account_status, created_at desc);

update public.profiles
set account_status = 'active'
where account_status is null;

create or replace function public.owner_get_pending_students(p_limit int default 50)
returns table(
  id uuid,
  name text,
  email text,
  school_level text,
  grade int,
  class_label text,
  created_at timestamptz
)
language sql
security definer
set search_path to 'public'
as $$
  select p.id,
         p.name,
         p.email,
         p.school_level,
         p.grade,
         p.class_label,
         p.created_at
  from public.profiles p
  where p.role = 'student'
    and p.account_status = 'pending'
  order by p.created_at desc
  limit coalesce(p_limit, 50);
$$;

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

  if p_status not in ('active','pending','blocked') then
    raise exception 'invalid status';
  end if;

  update public.profiles
  set account_status = p_status
  where id = p_student_id
    and role = 'student';
end;
$$;

grant execute on function public.owner_get_pending_students(int) to authenticated;
grant execute on function public.owner_set_student_status(uuid, text) to authenticated;

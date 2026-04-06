-- Student approval status (minimal additive migration).
-- New student accounts remain pending (approved_at = null) until owner approval.

alter table if exists public.profiles
  add column if not exists approved_at timestamptz;

-- Keep existing users usable after rollout.
update public.profiles
set approved_at = now()
where approved_at is null;

-- Owner/teacher should always be considered approved.
create or replace function public.ensure_staff_approved_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role in ('owner', 'teacher') and new.approved_at is null then
    new.approved_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_ensure_staff_approved_at on public.profiles;
create trigger trg_profiles_ensure_staff_approved_at
before insert or update of role, approved_at
on public.profiles
for each row
execute function public.ensure_staff_approved_at();


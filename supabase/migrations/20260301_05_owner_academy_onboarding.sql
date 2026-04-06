-- Ensure academies table exists for owner onboarding flows.
create table if not exists public.academies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) > 0),
  created_at timestamptz not null default now()
);

alter table public.academies enable row level security;

drop policy if exists "academies_read_authenticated" on public.academies;
create policy "academies_read_authenticated"
on public.academies
for select
to authenticated
using (true);

drop policy if exists "academies_insert_owner" on public.academies;
create policy "academies_insert_owner"
on public.academies
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'owner'
      and coalesce(p.account_status, 'active') = 'active'
  )
);

create or replace function public.ensure_owner_academy(p_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_status text;
  v_academy_id uuid;
  v_name text;
begin
  if v_uid is null then
    raise exception 'Unauthorized';
  end if;

  select p.role::text, coalesce(p.account_status, 'active'), p.academy_id
    into v_role, v_status, v_academy_id
  from public.profiles p
  where p.id = v_uid;

  if v_role is distinct from 'owner' then
    raise exception 'Forbidden';
  end if;
  if v_status is distinct from 'active' then
    raise exception 'Forbidden';
  end if;

  if v_academy_id is not null then
    return v_academy_id;
  end if;

  v_name := nullif(btrim(coalesce(p_name, '')), '');
  if v_name is null then
    v_name := 'MVS (Most Valuable Student)';
  end if;

  insert into public.academies(name) values (v_name)
  returning id into v_academy_id;

  update public.profiles
  set academy_id = v_academy_id
  where id = v_uid;

  return v_academy_id;
end;
$$;

grant execute on function public.ensure_owner_academy(text) to authenticated;

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
  has_academies boolean;
  has_profiles_academy_id boolean;
  has_academies_name boolean;
  has_academies_owner_id boolean;
  has_academies_created_by boolean;
  has_profiles_updated_at boolean;
begin
  if v_uid is null then
    raise exception 'Unauthorized';
  end if;

  select exists (
    select 1
    from information_schema.tables t
    where t.table_schema = 'public'
      and t.table_name = 'academies'
  ) into has_academies;

  if not has_academies then
    raise exception 'academies table is missing';
  end if;

  select exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'profiles'
      and c.column_name = 'academy_id'
  ) into has_profiles_academy_id;

  if not has_profiles_academy_id then
    raise exception 'profiles.academy_id column is missing';
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

  select exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'academies'
      and c.column_name = 'name'
  ) into has_academies_name;

  if not has_academies_name then
    raise exception 'academies.name column is missing';
  end if;

  select exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'academies'
      and c.column_name = 'owner_id'
  ) into has_academies_owner_id;

  select exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'academies'
      and c.column_name = 'created_by'
  ) into has_academies_created_by;

  if has_academies_owner_id and has_academies_created_by then
    execute 'insert into public.academies(name, owner_id, created_by) values ($1, $2, $2) returning id'
      using v_name, v_uid
      into v_academy_id;
  elsif has_academies_owner_id then
    execute 'insert into public.academies(name, owner_id) values ($1, $2) returning id'
      using v_name, v_uid
      into v_academy_id;
  elsif has_academies_created_by then
    execute 'insert into public.academies(name, created_by) values ($1, $2) returning id'
      using v_name, v_uid
      into v_academy_id;
  else
    execute 'insert into public.academies(name) values ($1) returning id'
      using v_name
      into v_academy_id;
  end if;

  select exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'profiles'
      and c.column_name = 'updated_at'
  ) into has_profiles_updated_at;

  if has_profiles_updated_at then
    update public.profiles
    set academy_id = v_academy_id,
        updated_at = now()
    where id = v_uid;
  else
    update public.profiles
    set academy_id = v_academy_id
    where id = v_uid;
  end if;

  return v_academy_id;
end;
$$;

grant execute on function public.ensure_owner_academy(text) to authenticated;

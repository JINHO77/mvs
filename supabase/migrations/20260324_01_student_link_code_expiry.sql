alter table if exists public.student_link_codes
  add column if not exists expires_at timestamptz,
  add column if not exists used_at timestamptz;

update public.student_link_codes
set expires_at = coalesce(expires_at, now() + interval '7 days')
where expires_at is null;

alter table public.student_link_codes
  alter column expires_at set not null;

create index if not exists student_link_codes_code_idx
  on public.student_link_codes (code);

create index if not exists student_link_codes_expires_at_idx
  on public.student_link_codes (expires_at);

create or replace function public.issue_student_link_code(
  p_student_id uuid,
  p_days integer default 7
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_role text;
  v_code text;
  v_expires_at timestamptz;
begin
  if v_actor_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select role
  into v_role
  from public.profiles
  where id = v_actor_id;

  if coalesce(v_role, '') not in ('owner', 'teacher') then
    raise exception 'FORBIDDEN';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = p_student_id
      and role = 'student'
  ) then
    raise exception 'STUDENT_NOT_FOUND';
  end if;

  v_expires_at := now() + make_interval(days => greatest(coalesce(p_days, 7), 1));

  loop
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text || p_student_id::text), 1, 8));
    exit when not exists (
      select 1
      from public.student_link_codes
      where code = v_code
    );
  end loop;

  insert into public.student_link_codes (
    student_id,
    code,
    expires_at,
    used_at
  )
  values (
    p_student_id,
    v_code,
    v_expires_at,
    null
  );

  return json_build_object(
    'ok', true,
    'code', v_code,
    'expires_at', v_expires_at
  );
end;
$$;

grant execute on function public.issue_student_link_code(uuid, integer) to authenticated;

create or replace function public.claim_student_link_code(
  p_code text,
  p_relation text default 'guardian'
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_role text;
  v_student_id uuid;
  v_used_at timestamptz;
  v_expires_at timestamptz;
  v_relation text := lower(coalesce(nullif(btrim(p_relation), ''), 'guardian'));
begin
  if v_actor_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select role
  into v_role
  from public.profiles
  where id = v_actor_id;

  if coalesce(v_role, '') not in ('parent', 'guardian') then
    raise exception 'FORBIDDEN';
  end if;

  if v_relation not in ('guardian', 'mother', 'father') then
    v_relation := 'guardian';
  end if;

  select student_id, used_at, expires_at
  into v_student_id, v_used_at, v_expires_at
  from public.student_link_codes
  where upper(code) = upper(btrim(p_code))
  limit 1
  for update;

  if v_student_id is null then
    return json_build_object('ok', false, 'reason', 'CODE_NOT_FOUND');
  end if;

  if v_used_at is not null then
    return json_build_object('ok', false, 'reason', 'CODE_ALREADY_USED');
  end if;

  if v_expires_at < now() then
    return json_build_object('ok', false, 'reason', 'CODE_EXPIRED');
  end if;

  insert into public.student_guardians (student_id, guardian_id, relation)
  select v_student_id, v_actor_id, v_relation
  where not exists (
    select 1
    from public.student_guardians
    where student_id = v_student_id
      and guardian_id = v_actor_id
  );

  update public.student_link_codes
  set used_at = now()
  where upper(code) = upper(btrim(p_code))
    and used_at is null;

  return json_build_object(
    'ok', true,
    'student_id', v_student_id
  );
end;
$$;

grant execute on function public.claim_student_link_code(text, text) to authenticated;

create or replace function public.preview_student_link_code(
  p_code text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_status text;
begin
  select
    slc.student_id,
    slc.expires_at,
    slc.used_at,
    p.name
  into v_row
  from public.student_link_codes slc
  left join public.profiles p on p.id = slc.student_id
  where upper(slc.code) = upper(btrim(p_code))
  limit 1;

  if v_row.student_id is null then
    return json_build_object('ok', false, 'reason', 'CODE_NOT_FOUND');
  end if;

  if v_row.used_at is not null then
    v_status := 'USED';
  elsif v_row.expires_at < now() then
    v_status := 'EXPIRED';
  else
    v_status := 'ACTIVE';
  end if;

  return json_build_object(
    'ok', true,
    'student_id', v_row.student_id,
    'student_name', v_row.name,
    'expires_at', v_row.expires_at,
    'used_at', v_row.used_at,
    'status', v_status
  );
end;
$$;

grant execute on function public.preview_student_link_code(text) to authenticated;

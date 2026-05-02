-- Switch newly issued owner-side student link codes from 8 to 6 characters,
-- using a confusing-char-free alphabet (no 0/O/1/I/L). Existing 8-char codes
-- in public.student_link_codes remain valid until expiry; claim_student_link_code
-- already looks up by exact code value with no length constraint.

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
  v_alphabet text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_alphabet_len integer := 31;
  v_idx integer;
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
    v_code := '';
    for v_idx in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * v_alphabet_len)::int, 1);
    end loop;

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

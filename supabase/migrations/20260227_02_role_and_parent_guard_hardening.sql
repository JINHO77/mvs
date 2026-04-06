-- Role and parent-link hardening (additive, low-risk).
-- Goal:
-- 1) Keep profiles.role non-null + bounded values.
-- 2) Keep auth->profiles role sync safe.
-- 3) Expose parent-linked students via a stable view/RPC.
-- 4) Fill missing staff RLS policies for core tables.

-- -------------------------------------------------------------------
-- STEP 1) profiles.role guarantees
-- -------------------------------------------------------------------

-- Backfill missing/blank role to a safe default.
update public.profiles
set role = 'parent'
where role is null or btrim(role) = '';

alter table public.profiles
  alter column role set default 'parent';

alter table public.profiles
  alter column role set not null;

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  drop constraint if exists profiles_role_ck;

alter table public.profiles
  add constraint profiles_role_ck
  check (role in ('student', 'parent', 'guardian', 'owner', 'teacher'));

-- Keep auth.users -> profiles upsert role-aware and null-safe.
create or replace function public.sync_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  v_role := lower(
    coalesce(
      new.raw_user_meta_data ->> 'role',
      new.raw_app_meta_data ->> 'role',
      'parent'
    )
  );

  if v_role not in ('student', 'parent', 'guardian', 'owner', 'teacher') then
    v_role := 'parent';
  end if;

  insert into public.profiles (id, email, role)
  values (new.id, new.email, v_role)
  on conflict (id) do update
    set email = excluded.email,
        role = coalesce(public.profiles.role, excluded.role);

  return new;
end;
$$;

drop trigger if exists trg_sync_profile_from_auth_user on auth.users;
create trigger trg_sync_profile_from_auth_user
after insert or update of email, raw_user_meta_data, raw_app_meta_data
on auth.users
for each row
execute function public.sync_profile_from_auth_user();

-- -------------------------------------------------------------------
-- STEP 2) parent-linked students view + RPC
-- -------------------------------------------------------------------

create or replace view public.v_guardian_students as
select
  sg.guardian_id,
  sg.student_id
from public.student_guardians sg
join public.profiles g
  on g.id = sg.guardian_id
 and g.role in ('parent', 'guardian')
join public.profiles s
  on s.id = sg.student_id
 and s.role = 'student';

grant select on public.v_guardian_students to authenticated;

create or replace function public.get_guardian_linked_student_count()
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::integer
  from public.v_guardian_students vgs
  where vgs.guardian_id = auth.uid();
$$;

grant execute on function public.get_guardian_linked_student_count() to authenticated;

-- -------------------------------------------------------------------
-- STEP 3) RLS hardening (additive policies)
-- -------------------------------------------------------------------

-- profiles
alter table public.profiles enable row level security;

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists profiles_staff_select_students_parents on public.profiles;
create policy profiles_staff_select_students_parents
on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role in ('owner', 'teacher')
  )
  and role in ('student', 'parent', 'guardian')
);

drop policy if exists profiles_staff_update_students on public.profiles;
create policy profiles_staff_update_students
on public.profiles
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role in ('owner', 'teacher')
  )
  and role = 'student'
)
with check (
  role = 'student'
);

drop policy if exists profiles_parent_select_linked_students on public.profiles;
create policy profiles_parent_select_linked_students
on public.profiles
for select
to authenticated
using (
  role = 'student'
  and exists (
    select 1
    from public.v_guardian_students vgs
    where vgs.guardian_id = auth.uid()
      and vgs.student_id = profiles.id
  )
);

-- student_guardians staff read
alter table public.student_guardians enable row level security;

drop policy if exists sg_staff_select on public.student_guardians;
create policy sg_staff_select
on public.student_guardians
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role in ('owner', 'teacher')
  )
);

-- consultation_requests staff read/write
alter table public.consultation_requests enable row level security;

drop policy if exists cr_staff_select on public.consultation_requests;
create policy cr_staff_select
on public.consultation_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role in ('owner', 'teacher')
  )
);

drop policy if exists cr_staff_update on public.consultation_requests;
create policy cr_staff_update
on public.consultation_requests
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role in ('owner', 'teacher')
  )
)
with check (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role in ('owner', 'teacher')
  )
);

-- announcements write: owner/teacher only
alter table public.announcements enable row level security;

drop policy if exists announcements_staff_insert on public.announcements;
create policy announcements_staff_insert
on public.announcements
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role in ('owner', 'teacher')
  )
);

drop policy if exists announcements_staff_update on public.announcements;
create policy announcements_staff_update
on public.announcements
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role in ('owner', 'teacher')
  )
)
with check (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role in ('owner', 'teacher')
  )
);

drop policy if exists announcements_staff_delete on public.announcements;
create policy announcements_staff_delete
on public.announcements
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role in ('owner', 'teacher')
  )
);


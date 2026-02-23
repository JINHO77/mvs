# Owner Account Switch Guide

## Purpose
Work around login issues on `dev@mvs.local` by operating with a newly created owner account.

## Login Routes (Current)
- Normal login: `/login`
- Dev login helper (only when `NEXT_PUBLIC_DEV_MODE=true`): `/dev-login`

After login, the app routes through `/dashboard` and redirects by `profiles.role`.
- `owner` -> `/owner`
- `teacher` -> `/teacher`
- `parent` -> `/parent`
- `student` -> `/student`

## Step 1) Create a New User in Supabase Dashboard
1. Open Supabase Dashboard for this project.
2. Go to `Authentication` -> `Users`.
3. Create a new user with your new email/password (example: `owner.new@mvs.local`).
4. Confirm the user is created and note its `id` (UUID).

## Step 2) Set Role to owner (SQL)
Run in Supabase SQL Editor.

Option A: set by email (recommended)
```sql
update public.profiles
set role = 'owner'
where id = (
  select id
  from auth.users
  where email = 'owner.new@mvs.local'
);
```

Option B: set by known user id
```sql
update public.profiles
set role = 'owner'
where id = 'PUT-NEW-USER-UUID-HERE';
```

Optional verification:
```sql
select p.id, p.email, p.role
from public.profiles p
where p.email = 'owner.new@mvs.local';
```

## Step 3) Login and Access Check
1. Sign in with the new owner credentials on `/login` (or `/dev-login` in dev mode).
2. Open `/dashboard`.
3. Confirm redirect to `/owner`.
4. Confirm owner pages open (for example `/owner/students`, `/owner/consult/requests`).

## Operating Policy
- Keep `dev@mvs.local` account as-is (do not delete).
- Use the new owner account as the primary operational account going forward.

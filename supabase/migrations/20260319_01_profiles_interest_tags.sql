alter table if exists public.profiles
add column if not exists interest_tags text[] not null default '{}'::text[];

-- Guard migration: keep announcements schema aligned with app expectations.
-- Prevent runtime errors when requires_ack/scheduled_at are missing in older environments.

alter table if exists public.announcements
  add column if not exists requires_ack boolean not null default false;

alter table if exists public.announcements
  add column if not exists scheduled_at timestamptz null;


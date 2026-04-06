alter table public.announcements
add column if not exists category text not null default 'general';

alter table public.announcements
drop constraint if exists announcements_category_check;

alter table public.announcements
add constraint announcements_category_check
check (category in ('general', 'notice', 'homework', 'report'));

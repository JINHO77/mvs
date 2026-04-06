-- Soft delete for announcements.
alter table if exists public.announcements
  add column if not exists is_deleted boolean not null default false;

create index if not exists idx_announcements_is_deleted
  on public.announcements(is_deleted);

create index if not exists idx_announcements_is_deleted_created_at
  on public.announcements(is_deleted, created_at desc);

grant update on public.announcements to authenticated;

drop policy if exists announcements_owner_update_soft_delete on public.announcements;

create policy announcements_owner_update_soft_delete
on public.announcements
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role = 'owner'
  )
)
with check (
  exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role = 'owner'
  )
);

create or replace function public.get_visible_announcements(p_limit integer default null)
returns table (
  id uuid,
  title text,
  body text,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select a.id, a.title, a.body, a.created_at
  from public.announcements a
  where public.can_current_user_read_announcement(a.id)
    and coalesce(a.is_deleted, false) = false
  order by a.created_at desc
  limit p_limit;
$$;

grant execute on function public.get_visible_announcements(integer) to authenticated;

create or replace function public.get_unread_announcement_count()
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::integer
  from public.announcements a
  where public.can_current_user_read_announcement(a.id)
    and coalesce(a.is_deleted, false) = false
    and not exists (
      select 1
      from public.announcement_reads ar
      where ar.announcement_id = a.id
        and ar.legacy_reader_id = auth.uid()
    );
$$;

grant execute on function public.get_unread_announcement_count() to authenticated;

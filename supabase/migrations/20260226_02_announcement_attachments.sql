-- Attachments for announcements with target-aware visibility.

create table if not exists public.announcement_attachments (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  file_name text not null,
  file_path text not null unique,
  content_type text,
  file_size bigint,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

create index if not exists idx_announcement_attachments_announcement_id
  on public.announcement_attachments(announcement_id);

alter table public.announcement_attachments enable row level security;

grant select, insert, delete on public.announcement_attachments to authenticated;

drop policy if exists aa_staff_insert on public.announcement_attachments;
drop policy if exists aa_staff_delete on public.announcement_attachments;
drop policy if exists aa_select_visible on public.announcement_attachments;

create policy aa_staff_insert
on public.announcement_attachments
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

create policy aa_staff_delete
on public.announcement_attachments
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

create policy aa_select_visible
on public.announcement_attachments
for select
to authenticated
using (
  public.can_current_user_read_announcement(announcement_id)
);

-- Storage bucket guide:
-- 1) Dashboard > Storage 에서 `announcement_attachments` 버킷 생성 (private)
-- 2) 또는 SQL로 생성:
insert into storage.buckets (id, name, public)
values ('announcement_attachments', 'announcement_attachments', false)
on conflict (id) do nothing;

-- Storage object policies for bucket `announcement_attachments`
drop policy if exists s_obj_announcement_attach_staff_insert on storage.objects;
drop policy if exists s_obj_announcement_attach_staff_delete on storage.objects;
drop policy if exists s_obj_announcement_attach_select_visible on storage.objects;

create policy s_obj_announcement_attach_staff_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'announcement_attachments'
  and exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role in ('owner', 'teacher')
  )
);

create policy s_obj_announcement_attach_staff_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'announcement_attachments'
  and exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role in ('owner', 'teacher')
  )
);

create policy s_obj_announcement_attach_select_visible
on storage.objects
for select
to authenticated
using (
  bucket_id = 'announcement_attachments'
  and exists (
    select 1
    from public.announcement_attachments aa
    where aa.file_path = storage.objects.name
      and public.can_current_user_read_announcement(aa.announcement_id)
  )
);

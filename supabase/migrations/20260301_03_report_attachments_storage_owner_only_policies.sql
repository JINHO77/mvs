-- report_attachments bucket policies (owner-only upload/delete/select)
-- SQL Editor friendly policy syntax: USING / WITH CHECK included.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'report_attachments',
  'report_attachments',
  false,
  5242880,
  array['application/pdf']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "owner_can_upload_reports" on storage.objects;
drop policy if exists "owner_can_delete_reports" on storage.objects;
drop policy if exists "owner_can_select_reports" on storage.objects;
drop policy if exists s_obj_report_attach_owner_insert on storage.objects;
drop policy if exists s_obj_report_attach_owner_delete on storage.objects;
drop policy if exists s_obj_report_attach_select_by_report_access on storage.objects;

create policy "owner_can_upload_reports"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'report_attachments'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'owner'
      and p.account_status = 'active'
  )
);

create policy "owner_can_delete_reports"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'report_attachments'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'owner'
  )
);

create policy "owner_can_select_reports"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'report_attachments'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'owner'
  )
);

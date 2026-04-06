-- report_attachments storage bucket + object policies
-- private bucket, PDF-only, 5MB limit

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

drop policy if exists s_obj_report_attach_owner_insert on storage.objects;
drop policy if exists s_obj_report_attach_owner_delete on storage.objects;
drop policy if exists s_obj_report_attach_select_by_report_access on storage.objects;

create policy s_obj_report_attach_owner_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'report_attachments'
  and exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role = 'owner'
      and coalesce(me.account_status, 'active') = 'active'
  )
);

create policy s_obj_report_attach_owner_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'report_attachments'
  and exists (
    select 1
    from public.profiles me
    where me.id = auth.uid()
      and me.role = 'owner'
      and coalesce(me.account_status, 'active') = 'active'
  )
);

-- NOTE:
-- createSignedUrl requires select permission on storage.objects.
-- This policy allows signed URL generation only for users who can access the linked report.
create policy s_obj_report_attach_select_by_report_access
on storage.objects
for select
to authenticated
using (
  bucket_id = 'report_attachments'
  and exists (
    select 1
    from public.report_attachments ra
    join public.reports r
      on r.id = ra.report_id
    where ra.file_path = storage.objects.name
      and coalesce(r.is_deleted, false) = false
      and (
        exists (
          select 1
          from public.profiles me
          where me.id = auth.uid()
            and me.role in ('owner', 'teacher')
            and (
              me.academy_id is null
              or me.academy_id = r.academy_id
            )
            and coalesce(me.account_status, 'active') = 'active'
        )
        or r.student_id = auth.uid()
        or exists (
          select 1
          from public.student_guardians sg
          where sg.guardian_id = auth.uid()
            and sg.student_id = r.student_id
        )
      )
  )
);

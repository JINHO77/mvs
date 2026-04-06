-- report_attachments storage policies for monthly reports upload/read
-- insert: active owner
-- select: owner(same academy) / student(self) / parent-guardian(linked)

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

drop policy if exists "rpt_attach_v20260304_insert_owner_active" on storage.objects;
drop policy if exists "rpt_attach_v20260304_select_by_report_access" on storage.objects;

create policy "rpt_attach_v20260304_insert_owner_active"
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

create policy "rpt_attach_v20260304_select_by_report_access"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'report_attachments'
  and exists (
    select 1
    from public.reports r
    where r.math_pdf_path = storage.objects.name
      and coalesce(r.is_deleted, false) = false
      and (
        exists (
          select 1
          from public.profiles me
          where me.id = auth.uid()
            and me.role = 'owner'
            and coalesce(me.account_status, 'active') = 'active'
            and me.academy_id = r.academy_id
        )
        or (
          r.student_id = auth.uid()
          and exists (
            select 1
            from public.profiles me
            where me.id = auth.uid()
              and coalesce(me.account_status, 'active') = 'active'
          )
        )
        or exists (
          select 1
          from public.student_guardians sg
          join public.profiles me on me.id = auth.uid()
          where sg.guardian_id = auth.uid()
            and sg.student_id = r.student_id
            and me.role in ('parent', 'guardian')
            and coalesce(me.account_status, 'active') = 'active'
        )
      )
  )
);

-- Enforce the same need-to-know checks for downloadable files, not just table rows.
-- A field contributor can upload their own evidence, but cannot browse other crews' incident media.
drop policy if exists "field contributors read assigned field media" on storage.objects;
drop policy if exists "field contributors upload field media" on storage.objects;
drop policy if exists "project members read field media" on storage.objects;
drop policy if exists "project members upload field media" on storage.objects;
create policy "authorized upload field files" on storage.objects for insert to authenticated
 with check (bucket_id='field-capture' and
  private.can_project(((storage.foldername(name))[1])::uuid,'submit_field'));
create policy "authorized read linked field files" on storage.objects for select to authenticated
 using (bucket_id='field-capture' and exists(
   select 1 from public.field_submissions f
   where f.storage_path=objects.name and (
     f.submitted_by=(select auth.uid()) or
     (private.can_project(f.project_id,'view_field') and
      (f.submission_type not in ('safety','incident','work_injury') or private.can_project(f.project_id,'view_safety')))
   )
  ));

drop policy if exists "members read project evidence files" on storage.objects;
drop policy if exists "members upload project evidence files" on storage.objects;
drop policy if exists "members update project evidence files" on storage.objects;
create policy "authorized upload evidence files" on storage.objects for insert to authenticated
 with check (bucket_id='project-evidence' and
  private.can_project(((storage.foldername(name))[1])::uuid,'upload_documents'));
create policy "authorized update evidence files" on storage.objects for update to authenticated
 using (bucket_id='project-evidence' and private.can_project(((storage.foldername(name))[1])::uuid,'upload_documents'))
 with check (bucket_id='project-evidence' and private.can_project(((storage.foldername(name))[1])::uuid,'upload_documents'));
create policy "authorized read linked evidence files" on storage.objects for select to authenticated
 using (bucket_id='project-evidence' and exists(
  select 1 from public.evidence e where e.storage_path=objects.name
   and (storage.foldername(objects.name))[1]=e.project_id::text
   and private.can_project(e.project_id,'view_documents')
   and (not(e.evidence_type ~* '(safety|injur|incident)' or coalesce(e.metadata->>'capture_type','') ~* '(safety|injur|incident)')
     or private.can_project(e.project_id,'view_safety'))
 ));

drop policy if exists "members read project assets" on storage.objects;
drop policy if exists "members upload project assets" on storage.objects;
drop policy if exists "members update project assets" on storage.objects;
create policy "authorized read project assets" on storage.objects for select to authenticated
 using (bucket_id='project-assets' and private.can_project(((storage.foldername(name))[1])::uuid,'view_project'));
create policy "authorized upload project assets" on storage.objects for insert to authenticated
 with check (bucket_id='project-assets' and private.can_project(((storage.foldername(name))[1])::uuid,'manage_project'));
create policy "authorized update project assets" on storage.objects for update to authenticated
 using (bucket_id='project-assets' and private.can_project(((storage.foldername(name))[1])::uuid,'manage_project'))
 with check (bucket_id='project-assets' and private.can_project(((storage.foldername(name))[1])::uuid,'manage_project'));

drop policy if exists "org members read vendor files" on storage.objects;
drop policy if exists "org members upload vendor files" on storage.objects;
drop policy if exists "org members update vendor files" on storage.objects;
create policy "authorized read vendor files" on storage.objects for select to authenticated
 using (bucket_id='vendor-compliance' and exists(
  select 1 from public.vendor_invites vi
   where objects.name like vi.id::text||'/%' and private.can_project(vi.project_id,'manage_vendors')
 ));
create policy "authorized upload vendor files" on storage.objects for insert to authenticated
 with check (bucket_id='vendor-compliance' and exists(
  select 1 from public.vendor_invites vi
   where objects.name like vi.id::text||'/%' and private.can_project(vi.project_id,'manage_vendors')
 ));
create policy "authorized update vendor files" on storage.objects for update to authenticated
 using (bucket_id='vendor-compliance' and exists(
  select 1 from public.vendor_invites vi
   where objects.name like vi.id::text||'/%' and private.can_project(vi.project_id,'manage_vendors')
 ))
 with check (bucket_id='vendor-compliance' and exists(
  select 1 from public.vendor_invites vi
   where objects.name like vi.id::text||'/%' and private.can_project(vi.project_id,'manage_vendors')
 ));

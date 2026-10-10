-- Complete the core permissions surface for project and organization scoped records.
create or replace function private.can_organization(org_id uuid, capability text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.projects p
 where p.organization_id=org_id and private.can_project(p.id,capability));
$$;
revoke all on function private.can_organization(uuid,text) from public,anon;
grant execute on function private.can_organization(uuid,text) to authenticated;
revoke all on function private.project_role(uuid,uuid) from public,anon,authenticated;

drop policy if exists "members manage companies" on public.companies;
create policy "authorized people viewers read companies" on public.companies for select to authenticated
 using (private.can_organization(organization_id,'view_people'));
create policy "authorized people managers add companies" on public.companies for insert to authenticated
 with check (private.can_organization(organization_id,'manage_people'));
create policy "authorized people managers update companies" on public.companies for update to authenticated
 using (private.can_organization(organization_id,'manage_people')) with check (private.can_organization(organization_id,'manage_people'));
create policy "authorized people managers delete companies" on public.companies for delete to authenticated
 using (private.can_organization(organization_id,'manage_people'));

drop policy if exists "members manage people" on public.people;
create policy "authorized people viewers read contacts" on public.people for select to authenticated
 using (private.can_organization(organization_id,'view_people'));
create policy "authorized people managers add contacts" on public.people for insert to authenticated
 with check (private.can_organization(organization_id,'manage_people'));
create policy "authorized people managers update contacts" on public.people for update to authenticated
 using (private.can_organization(organization_id,'manage_people')) with check (private.can_organization(organization_id,'manage_people'));
create policy "authorized people managers delete contacts" on public.people for delete to authenticated
 using (private.can_organization(organization_id,'manage_people'));

drop policy if exists "members manage project participants" on public.project_participants;
create policy "authorized participants read" on public.project_participants for select to authenticated
 using (private.can_project(project_id,'view_people'));
create policy "authorized participants modify" on public.project_participants for all to authenticated
 using (private.can_project(project_id,'manage_people')) with check (private.can_project(project_id,'manage_people'));

drop policy if exists "members manage project module preferences" on public.project_module_preferences;
create policy "authorized read project modules" on public.project_module_preferences for select to authenticated
 using (private.can_project(project_id,'view_project'));
create policy "authorized manage project modules" on public.project_module_preferences for all to authenticated
 using (private.can_project(project_id,'manage_project')) with check (private.can_project(project_id,'manage_project'));

drop policy if exists "members manage project requirements" on public.project_requirements;
create policy "authorized read project requirements" on public.project_requirements for select to authenticated
 using (private.can_project(project_id,'view_project'));
create policy "authorized manage project requirements" on public.project_requirements for all to authenticated
 using (private.can_project(project_id,'manage_project')) with check (private.can_project(project_id,'manage_project'));

drop policy if exists "members manage relationships" on public.relationships;
create policy "authorized read project relationships" on public.relationships for select to authenticated
 using (private.can_project(project_id,'view_timeline'));
create policy "authorized manage project relationships" on public.relationships for all to authenticated
 using (private.can_project(project_id,'edit_timeline')) with check (private.can_project(project_id,'edit_timeline'));

drop policy if exists "members manage evidence links" on public.evidence_links;
create policy "authorized read evidence connections" on public.evidence_links for select to authenticated
 using (exists(select 1 from public.evidence e where e.id=evidence_id and private.can_project(e.project_id,'view_documents')));
create policy "authorized manage evidence connections" on public.evidence_links for all to authenticated
 using (exists(select 1 from public.evidence e where e.id=evidence_id and private.can_project(e.project_id,'upload_documents')))
 with check (exists(select 1 from public.evidence e where e.id=evidence_id and private.can_project(e.project_id,'upload_documents')));

drop policy if exists "org members manage vendors" on public.vendor_profiles;
create policy "authorized managers read vendors" on public.vendor_profiles for select to authenticated
 using (private.can_organization(organization_id,'manage_vendors'));
create policy "authorized managers write vendors" on public.vendor_profiles for all to authenticated
 using (private.can_organization(organization_id,'manage_vendors')) with check (private.can_organization(organization_id,'manage_vendors'));

drop policy if exists "org members manage vendor templates" on public.vendor_requirement_templates;
create policy "authorized managers read vendor templates" on public.vendor_requirement_templates for select to authenticated
 using (private.can_organization(organization_id,'manage_vendors'));
create policy "authorized managers write vendor templates" on public.vendor_requirement_templates for all to authenticated
 using (private.can_organization(organization_id,'manage_vendors')) with check (private.can_organization(organization_id,'manage_vendors'));

drop policy if exists "org members manage vendor requirements" on public.vendor_requirements;
create policy "authorized managers read vendor requirements" on public.vendor_requirements for select to authenticated
 using (exists(select 1 from public.vendor_requirement_templates t where t.id=template_id and private.can_organization(t.organization_id,'manage_vendors')));
create policy "authorized managers write vendor requirements" on public.vendor_requirements for all to authenticated
 using (exists(select 1 from public.vendor_requirement_templates t where t.id=template_id and private.can_organization(t.organization_id,'manage_vendors')))
 with check (exists(select 1 from public.vendor_requirement_templates t where t.id=template_id and private.can_organization(t.organization_id,'manage_vendors')));

drop policy if exists "org members manage vendor assignments" on public.vendor_project_assignments;
create policy "authorized managers read vendor assignments" on public.vendor_project_assignments for select to authenticated
 using (private.can_project(project_id,'manage_vendors'));
create policy "authorized managers write vendor assignments" on public.vendor_project_assignments for all to authenticated
 using (private.can_project(project_id,'manage_vendors')) with check (private.can_project(project_id,'manage_vendors'));

drop policy if exists "org members manage vendor invites" on public.vendor_invites;
create policy "authorized managers read vendor invites" on public.vendor_invites for select to authenticated
 using (private.can_project(project_id,'manage_vendors'));
create policy "authorized managers write vendor invites" on public.vendor_invites for all to authenticated
 using (private.can_project(project_id,'manage_vendors')) with check (private.can_project(project_id,'manage_vendors'));

drop policy if exists "org members manage vendor documents" on public.vendor_documents;
create policy "authorized managers read vendor documents" on public.vendor_documents for select to authenticated
 using (exists(select 1 from public.vendor_invites v where v.id=invite_id and private.can_project(v.project_id,'manage_vendors')));
create policy "authorized managers write vendor documents" on public.vendor_documents for all to authenticated
 using (exists(select 1 from public.vendor_invites v where v.id=invite_id and private.can_project(v.project_id,'manage_vendors')))
 with check (exists(select 1 from public.vendor_invites v where v.id=invite_id and private.can_project(v.project_id,'manage_vendors')));

drop policy if exists "org members manage vendor responses" on public.vendor_responses;
create policy "authorized managers read vendor responses" on public.vendor_responses for select to authenticated
 using (exists(select 1 from public.vendor_invites v where v.id=invite_id and private.can_project(v.project_id,'manage_vendors')));
create policy "authorized managers write vendor responses" on public.vendor_responses for all to authenticated
 using (exists(select 1 from public.vendor_invites v where v.id=invite_id and private.can_project(v.project_id,'manage_vendors')))
 with check (exists(select 1 from public.vendor_invites v where v.id=invite_id and private.can_project(v.project_id,'manage_vendors')));

-- Field and ingestion data may include safety notes in extracted text. Prevent general reviewers
-- from reading ingestions whose underlying field submission is tagged safety/incident.
drop policy if exists "members manage ingestion jobs" on public.ingestion_jobs;
create policy "authorized view ingestions" on public.ingestion_jobs for select to authenticated
 using ((private.can_project(project_id,'view_field') or private.can_project(project_id,'view_documents')) and
  (not exists(select 1 from public.field_submissions fs where fs.evidence_id=ingestion_jobs.evidence_id
    and fs.submission_type in ('incident','safety','work_injury'))
   or private.can_project(project_id,'view_safety')));
create policy "authorized manage ingestions" on public.ingestion_jobs for all to authenticated
 using (private.can_project(project_id,'upload_documents') and
  (not exists(select 1 from public.field_submissions fs where fs.evidence_id=ingestion_jobs.evidence_id
    and fs.submission_type in ('incident','safety','work_injury'))
   or private.can_project(project_id,'view_safety')))
 with check (private.can_project(project_id,'upload_documents'));

drop policy if exists "members manage extraction candidates" on public.extraction_candidates;
create policy "authorized view candidate records" on public.extraction_candidates for select to authenticated
 using ((private.can_project(project_id,'view_field') or private.can_project(project_id,'view_documents')) and
  (not exists(select 1 from public.ingestion_jobs j join public.field_submissions fs on fs.evidence_id=j.evidence_id
    where j.id=extraction_candidates.job_id and fs.submission_type in ('incident','safety','work_injury'))
   or private.can_project(project_id,'view_safety')));
create policy "authorized manage candidate records" on public.extraction_candidates for all to authenticated
 using (private.can_project(project_id,'upload_documents') and
  (not exists(select 1 from public.ingestion_jobs j join public.field_submissions fs on fs.evidence_id=j.evidence_id
    where j.id=extraction_candidates.job_id and fs.submission_type in ('incident','safety','work_injury'))
   or private.can_project(project_id,'view_safety')))
 with check (private.can_project(project_id,'upload_documents'));

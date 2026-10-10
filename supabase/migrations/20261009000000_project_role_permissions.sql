-- BuildPath project-scoped RBAC and administrator permission allocation.
-- Existing organization owners retain full access. Existing project field contributors retain own submission rights.
create table if not exists public.project_access_grants (
 project_id uuid not null references public.projects(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check (role in ('admin','project_manager','superintendent','safety','finance','field','viewer')),
 permissions jsonb not null default '{}'::jsonb,
 assigned_by uuid references auth.users(id),
 updated_at timestamptz not null default now(),
 primary key (project_id,user_id)
);
create or replace function private.valid_access_overrides(input jsonb)
returns boolean language sql immutable set search_path='' as $$
 select input is not null and jsonb_typeof(input)='object'
 and not (input ? 'manage_access')
 and not exists (select 1 from jsonb_each(input) p
   where p.key not in ('view_project','view_timeline','edit_timeline','view_documents','upload_documents','view_costs','view_people','manage_people','view_field','submit_field','view_safety','manage_project','manage_vendors')
   or jsonb_typeof(p.value) <> 'boolean');
$$;
alter table public.project_access_grants add constraint valid_project_access_overrides check (private.valid_access_overrides(permissions));
create or replace function private.project_role(target_project uuid, target_user uuid)
returns text language plpgsql stable security definer set search_path='' as $$
declare org_role text; explicit_role text; field_user boolean;
begin
 if target_user is null then return null; end if;
 select om.role into org_role
 from public.projects p join public.organization_members om on om.organization_id=p.organization_id
 where p.id=target_project and om.user_id=target_user;
 if org_role in ('owner','admin') then return org_role; end if;
 select exists(select 1 from public.project_field_contributors fc
               where fc.project_id=target_project and fc.user_id=target_user and fc.is_active=true)
 into field_user;
 if org_role is null and not field_user then return null; end if;
 select g.role into explicit_role from public.project_access_grants g
 where g.project_id=target_project and g.user_id=target_user;
 return coalesce(explicit_role, case when org_role='member' then 'viewer' when field_user then 'field' else 'viewer' end);
end;
$$;
create or replace function private.can_project(target_project uuid, capability text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare active_user uuid:=(select auth.uid()); assigned_role text; overrides jsonb; base boolean:=false;
begin
 if active_user is null then return false; end if;
 if capability not in ('view_project','view_timeline','edit_timeline','view_documents','upload_documents','view_costs','view_people','manage_people','view_field','submit_field','view_safety','manage_project','manage_vendors','manage_access') then return false; end if;
 assigned_role:=private.project_role(target_project,active_user);
 if assigned_role is null then return false; end if;
 if assigned_role in ('owner','admin') then return true; end if;
 if capability='manage_access' then return false; end if;
 base:=case assigned_role
  when 'project_manager' then capability in ('view_project','view_timeline','edit_timeline','view_documents','upload_documents','view_costs','view_people','manage_people','view_field','submit_field','manage_project','manage_vendors')
  when 'superintendent' then capability in ('view_project','view_timeline','edit_timeline','view_documents','upload_documents','view_people','view_field','submit_field','view_safety')
  when 'safety' then capability in ('view_project','view_timeline','view_documents','upload_documents','view_people','view_field','submit_field','view_safety')
  when 'finance' then capability in ('view_project','view_timeline','view_documents','view_costs')
  when 'field' then capability in ('view_project','submit_field')
  when 'viewer' then capability in ('view_project','view_timeline')
  else false end;
 select g.permissions into overrides from public.project_access_grants g
 where g.project_id=target_project and g.user_id=active_user;
 if overrides ? capability then return (overrides->>capability)::boolean; end if;
 return base;
end;
$$;
create or replace function private.can_assign_project_access(target_project uuid, target_user uuid, new_role text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare current_role text; target_org_role text; target_existing_role text; is_field boolean;
begin
 if target_user is null or target_user=(select auth.uid()) then return false; end if;
 if new_role not in ('admin','project_manager','superintendent','safety','finance','field','viewer') then return false; end if;
 current_role:=private.project_role(target_project,(select auth.uid()));
 if current_role not in ('owner','admin') then return false; end if;
 select om.role into target_org_role
 from public.projects p join public.organization_members om on om.organization_id=p.organization_id
 where p.id=target_project and om.user_id=target_user;
 select exists(select 1 from public.project_field_contributors fc
   where fc.project_id=target_project and fc.user_id=target_user and fc.is_active=true) into is_field;
 if target_org_role is null and not is_field then return false; end if;
 if target_org_role='owner' then return false; end if;
 select role into target_existing_role from public.project_access_grants
 where project_id=target_project and user_id=target_user;
 if current_role<>'owner' and (new_role='admin' or target_org_role='admin' or target_existing_role='admin') then return false; end if;
 return true;
end;
$$;
create or replace function private.enforce_grant_identity()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.project_id<>old.project_id or new.user_id<>old.user_id) then
  raise exception 'Project assignment identity cannot be changed';
 end if;
 new.updated_at:=now();
 new.assigned_by:=(select auth.uid());
 return new;
end;
$$;
drop trigger if exists protect_project_access_identity on public.project_access_grants;
create trigger protect_project_access_identity before insert or update on public.project_access_grants
for each row execute function private.enforce_grant_identity();

alter table public.project_access_grants enable row level security;
grant select,insert,update,delete on public.project_access_grants to authenticated;
drop policy if exists "read relevant access grants" on public.project_access_grants;
create policy "read relevant access grants" on public.project_access_grants
 for select to authenticated using (user_id=(select auth.uid()) or private.can_project(project_id,'manage_access'));
drop policy if exists "managers create access grants" on public.project_access_grants;
create policy "managers create access grants" on public.project_access_grants
 for insert to authenticated with check (private.can_assign_project_access(project_id,user_id,role));
drop policy if exists "managers update access grants" on public.project_access_grants;
create policy "managers update access grants" on public.project_access_grants
 for update to authenticated using (private.can_assign_project_access(project_id,user_id,role))
 with check (private.can_assign_project_access(project_id,user_id,role));
drop policy if exists "managers delete access grants" on public.project_access_grants;
create policy "managers delete access grants" on public.project_access_grants
 for delete to authenticated using (private.can_assign_project_access(project_id,user_id,role));

-- Organization admin can enumerate members. Others still see only their own membership.
drop policy if exists "project access administrators read org members" on public.organization_members;
create policy "project access administrators read org members" on public.organization_members
 for select to authenticated using (
  exists(select 1 from public.projects p
         where p.organization_id=organization_members.organization_id
         and private.can_project(p.id,'manage_access')));

-- Controlled directory RPC. SECURITY DEFINER is intentional to fetch auth.users email:
-- permission check is always done FIRST, and execute revoked from PUBLIC/anon.
create or replace function public.project_access_directory(target_project uuid)
returns table(user_id uuid, email text, membership_type text, organization_role text, project_role text, permissions jsonb)
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.can_project(target_project,'manage_access') then
  raise exception 'Not authorized for project access administration' using errcode='42501';
 end if;
 return query
 with candidates as (
  select om.user_id, 'organization'::text as scope, om.role as org_role
  from public.projects p join public.organization_members om on om.organization_id=p.organization_id
  where p.id=target_project
  union
  select fc.user_id, 'field_contributor'::text, null::text
  from public.project_field_contributors fc where fc.project_id=target_project and fc.is_active
 )
 select c.user_id, u.email::text, c.scope, c.org_role,
  private.project_role(target_project,c.user_id), coalesce(g.permissions,'{}'::jsonb)
 from candidates c join auth.users u on u.id=c.user_id
 left join public.project_access_grants g on g.project_id=target_project and g.user_id=c.user_id
 order by c.scope,u.email;
end;
$$;
revoke all on function public.project_access_directory(uuid) from public,anon;
grant execute on function public.project_access_directory(uuid) to authenticated;

create or replace function public.project_permission_summary(target_project uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
  'view_project',private.can_project(target_project,'view_project'),
  'view_timeline',private.can_project(target_project,'view_timeline'),
  'edit_timeline',private.can_project(target_project,'edit_timeline'),
  'view_documents',private.can_project(target_project,'view_documents'),
  'upload_documents',private.can_project(target_project,'upload_documents'),
  'view_costs',private.can_project(target_project,'view_costs'),
  'view_people',private.can_project(target_project,'view_people'),
  'manage_people',private.can_project(target_project,'manage_people'),
  'view_field',private.can_project(target_project,'view_field'),
  'submit_field',private.can_project(target_project,'submit_field'),
  'view_safety',private.can_project(target_project,'view_safety'),
  'manage_project',private.can_project(target_project,'manage_project'),
  'manage_vendors',private.can_project(target_project,'manage_vendors'),
  'manage_access',private.can_project(target_project,'manage_access'));
$$;
revoke all on function public.project_permission_summary(uuid) from public,anon;
grant execute on function public.project_permission_summary(uuid) to authenticated;
grant usage on schema private to authenticated;
grant execute on function private.project_role(uuid,uuid) to authenticated;
grant execute on function private.can_project(uuid,text) to authenticated;
grant execute on function private.can_assign_project_access(uuid,uuid,text) to authenticated;

-- Replace permissive "all org members manage all records" policies with capability-based policies.
drop policy if exists "members manage project events" on public.project_events;
create policy "roles read timeline events" on public.project_events for select to authenticated
 using (private.can_project(project_id,'view_timeline') and
  (event_type !~* '(injur|safety|accident|incident)' or private.can_project(project_id,'view_safety')));
create policy "roles insert timeline events" on public.project_events for insert to authenticated
 with check (private.can_project(project_id,'edit_timeline') and
  (event_type !~* '(injur|safety|accident|incident)' or private.can_project(project_id,'view_safety')));
create policy "roles update timeline events" on public.project_events for update to authenticated
 using (private.can_project(project_id,'edit_timeline') and (event_type !~* '(injur|safety|accident|incident)' or private.can_project(project_id,'view_safety')))
 with check (private.can_project(project_id,'edit_timeline') and (event_type !~* '(injur|safety|accident|incident)' or private.can_project(project_id,'view_safety')));
create policy "roles delete timeline events" on public.project_events for delete to authenticated
 using (private.can_project(project_id,'edit_timeline') and (event_type !~* '(injur|safety|accident|incident)' or private.can_project(project_id,'view_safety')));

drop policy if exists "members manage evidence" on public.evidence;
create policy "roles read evidence" on public.evidence for select to authenticated
 using (private.can_project(project_id,'view_documents') and
   (not(evidence_type ~* '(safety|injur|incident)' or coalesce(metadata->>'capture_type','') ~* '(safety|injur|incident)')
    or private.can_project(project_id,'view_safety')));
create policy "roles add evidence" on public.evidence for insert to authenticated
 with check (created_by=(select auth.uid()) and (private.can_project(project_id,'upload_documents') or private.can_project(project_id,'submit_field')));
create policy "roles update evidence" on public.evidence for update to authenticated
 using (private.can_project(project_id,'upload_documents'))
 with check (private.can_project(project_id,'upload_documents'));
create policy "roles delete evidence" on public.evidence for delete to authenticated
 using (private.can_project(project_id,'upload_documents'));

drop policy if exists "project members manage field submissions" on public.field_submissions;
create policy "roles read field submissions" on public.field_submissions for select to authenticated
 using (private.can_project(project_id,'view_field') and
  (submission_type not in ('incident','safety','work_injury') or private.can_project(project_id,'view_safety')));
create policy "roles insert field submissions" on public.field_submissions for insert to authenticated
 with check (submitted_by=(select auth.uid()) and private.can_project(project_id,'submit_field'));
create policy "roles update field submissions" on public.field_submissions for update to authenticated
 using (private.can_project(project_id,'view_field'))
 with check (private.can_project(project_id,'view_field'));

drop policy if exists "members read projects" on public.projects;
create policy "roles read projects" on public.projects for select to authenticated using (private.can_project(id,'view_project'));
drop policy if exists "members update projects" on public.projects;
create policy "roles update projects" on public.projects for update to authenticated
 using (private.can_project(id,'manage_project')) with check (private.can_project(id,'manage_project'));
drop policy if exists "members create projects" on public.projects;
create policy "project admins create projects" on public.projects for insert to authenticated
 with check (created_by=(select auth.uid()) and exists(
  select 1 from public.organization_members om where om.organization_id=projects.organization_id and om.user_id=(select auth.uid()) and om.role in ('owner','admin')));

drop policy if exists "project members manage field contributors" on public.project_field_contributors;
create policy "admins manage field contributors" on public.project_field_contributors for all to authenticated
 using (private.can_project(project_id,'manage_access')) with check (private.can_project(project_id,'manage_access'));
drop policy if exists "project members manage field invites" on public.project_field_invites;
create policy "admins manage field invites" on public.project_field_invites for all to authenticated
 using (private.can_project(project_id,'manage_access')) with check (private.can_project(project_id,'manage_access'));

-- Keep the privileged auth.users join inside the unexposed private schema.
create or replace function private.project_access_directory_impl(target_project uuid)
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
revoke all on function private.project_access_directory_impl(uuid) from public,anon;
grant execute on function private.project_access_directory_impl(uuid) to authenticated;

create or replace function public.project_access_directory(target_project uuid)
returns table(user_id uuid, email text, membership_type text, organization_role text, project_role text, permissions jsonb)
language sql stable security invoker set search_path='' as $$
 select * from private.project_access_directory_impl(target_project);
$$;
revoke all on function public.project_access_directory(uuid) from public,anon;
grant execute on function public.project_access_directory(uuid) to authenticated;

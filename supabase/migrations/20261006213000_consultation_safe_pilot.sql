-- ConsultationPath Safe Pilot foundation.
-- Replays the ConsultationPath-specific schema/security changes needed for staging and recovery.

create table if not exists public.consultation_email_rules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  provider text not null check (provider in ('gmail','outlook','manual_forward')),
  sender_pattern text,
  subject_pattern text,
  keyword_pattern text,
  action text not null default 'copy_to_project' check (action in ('copy_to_project','label_and_copy','forward_to_project')),
  is_enabled boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.consultation_email_rules enable row level security;
revoke all on public.consultation_email_rules from anon;
grant select,insert,update,delete on public.consultation_email_rules to authenticated;
drop policy if exists "members manage consultation email rules" on public.consultation_email_rules;
create policy "members manage consultation email rules"
on public.consultation_email_rules for all to authenticated
using (exists (
  select 1 from public.projects p
  where p.id = consultation_email_rules.project_id
    and private.is_org_member(p.organization_id)
))
with check (exists (
  select 1 from public.projects p
  where p.id = consultation_email_rules.project_id
    and private.is_org_member(p.organization_id)
));
create index if not exists idx_consultation_email_rules_project on public.consultation_email_rules(project_id);

create table if not exists public.consultation_workstream_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  workstream_key text not null,
  title text not null,
  description text,
  target_date date,
  completed_date date,
  status text not null default 'not_started' check (status in ('not_started','in_progress','blocked','complete','at_risk')),
  owner text,
  sort_order integer not null default 0,
  scope_origin text not null default 'original' check (scope_origin in ('original','added')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.consultation_workstream_milestones enable row level security;
revoke all on public.consultation_workstream_milestones from anon;
grant select,insert,update,delete on public.consultation_workstream_milestones to authenticated;
drop policy if exists "members manage consultation milestones" on public.consultation_workstream_milestones;
create policy "members manage consultation milestones"
on public.consultation_workstream_milestones for all to authenticated
using (exists (
  select 1 from public.projects p
  where p.id = consultation_workstream_milestones.project_id
    and private.is_org_member(p.organization_id)
))
with check (exists (
  select 1 from public.projects p
  where p.id = consultation_workstream_milestones.project_id
    and private.is_org_member(p.organization_id)
));
create index if not exists idx_cp_milestones_project_workstream on public.consultation_workstream_milestones(project_id,workstream_key);
create index if not exists idx_cp_milestones_scope_origin on public.consultation_workstream_milestones(project_id,scope_origin);

create table if not exists public.consultation_audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  table_name text not null,
  record_id uuid,
  action text not null check (action in ('insert','update','delete')),
  actor_user_id uuid references auth.users(id),
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
alter table public.consultation_audit_log enable row level security;
revoke all on public.consultation_audit_log from anon, authenticated;
grant select on public.consultation_audit_log to authenticated;
drop policy if exists "members read consultation audit log" on public.consultation_audit_log;
create policy "members read consultation audit log"
on public.consultation_audit_log for select to authenticated
using (private.is_org_member(organization_id));
create index if not exists idx_consultation_audit_project_created
  on public.consultation_audit_log(project_id,created_at desc);

drop policy if exists "field contributors create candidates from own jobs" on public.extraction_candidates;
create policy "field contributors create candidates from own jobs"
on public.extraction_candidates for insert to authenticated
with check (
  private.is_field_contributor(project_id)
  and exists (
    select 1 from public.ingestion_jobs j
    where j.id = extraction_candidates.job_id
      and j.project_id = extraction_candidates.project_id
      and j.created_by = (select auth.uid())
  )
);

drop policy if exists "field contributors read candidates from own jobs" on public.extraction_candidates;
create policy "field contributors read candidates from own jobs"
on public.extraction_candidates for select to authenticated
using (
  private.is_field_contributor(project_id)
  and exists (
    select 1 from public.ingestion_jobs j
    where j.id = extraction_candidates.job_id
      and j.project_id = extraction_candidates.project_id
      and j.created_by = (select auth.uid())
  )
);

create or replace function private.capture_consultation_audit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_project_id uuid;
  v_org_id uuid;
  v_record_id uuid;
  v_actor uuid;
  v_old jsonb;
  v_new jsonb;
begin
  v_actor := (select auth.uid());

  if TG_TABLE_NAME = 'projects' then
    v_project_id := case when TG_OP <> 'DELETE' then NEW.id else OLD.id end;
  else
    v_project_id := case when TG_OP <> 'DELETE' then NEW.project_id else OLD.project_id end;
  end if;

  if v_project_id is null then return coalesce(NEW, OLD); end if;

  select organization_id into v_org_id from public.projects where id = v_project_id;
  if v_org_id is null then return coalesce(NEW, OLD); end if;

  if v_actor is not null and not private.is_org_member(v_org_id) then
    raise exception 'audit actor is not authorized for project';
  end if;

  v_record_id := coalesce(
    case when TG_OP <> 'DELETE' then NEW.id else OLD.id end,
    v_project_id
  );

  v_old := case when TG_OP in ('UPDATE','DELETE') then to_jsonb(OLD) else null end;
  v_new := case when TG_OP in ('INSERT','UPDATE') then to_jsonb(NEW) else null end;

  -- Preserve provenance without duplicating confidential transcript bodies.
  if TG_TABLE_NAME = 'evidence' then
    if v_old is not null then v_old := v_old - 'raw_text'; end if;
    if v_new is not null then v_new := v_new - 'raw_text'; end if;
  end if;

  insert into public.consultation_audit_log(
    organization_id,project_id,table_name,record_id,action,
    actor_user_id,old_data,new_data
  ) values (
    v_org_id,v_project_id,TG_TABLE_NAME,v_record_id,lower(TG_OP),
    v_actor,v_old,v_new
  );

  return coalesce(NEW,OLD);
end;
$$;
revoke all on function private.capture_consultation_audit() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'projects',
    'project_events',
    'evidence',
    'extraction_candidates',
    'consultation_email_rules',
    'consultation_workstream_milestones'
  ]
  loop
    execute format('drop trigger if exists consultation_audit_%I on public.%I',t,t);
    execute format(
      'create trigger consultation_audit_%I after insert or update or delete on public.%I for each row execute function private.capture_consultation_audit()',
      t,t
    );
  end loop;
end $$;

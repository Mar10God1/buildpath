-- BuildPath initial project-memory schema
-- This file documents the intended schema. It will be applied to the BuildPath Supabase project once created.

create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','member','viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  address text,
  city text,
  state text,
  project_type text,
  baseline_start date,
  target_finish date,
  original_budget numeric(14,2),
  status text not null default 'planning',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  company_type text,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  first_name text,
  last_name text,
  email text,
  phone text,
  title text,
  created_at timestamptz not null default now()
);

create table if not exists public.project_participants (
  project_id uuid not null references public.projects(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  person_id uuid references public.people(id) on delete cascade,
  role text,
  created_at timestamptz not null default now(),
  constraint participant_target check ((company_id is not null) or (person_id is not null))
);

create table if not exists public.project_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  event_type text not null,
  title text not null,
  description text,
  start_at timestamptz,
  end_at timestamptz,
  date_precision text not null default 'exact' check (date_precision in ('exact','day','week','month','range','unknown')),
  confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  status text,
  cost_impact numeric(14,2),
  schedule_impact_days integer,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.evidence (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  evidence_type text not null,
  title text,
  source_system text,
  source_url text,
  storage_path text,
  occurred_at timestamptz,
  raw_text text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.relationships (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  from_type text not null,
  from_id uuid not null,
  relationship_type text not null,
  to_type text not null,
  to_id uuid not null,
  confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  is_user_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (project_id, from_type, from_id, relationship_type, to_type, to_id)
);

create table if not exists public.evidence_links (
  evidence_id uuid not null references public.evidence(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  relationship text not null default 'supports',
  created_at timestamptz not null default now(),
  primary key (evidence_id, entity_type, entity_id, relationship)
);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.projects enable row level security;
alter table public.companies enable row level security;
alter table public.people enable row level security;
alter table public.project_participants enable row level security;
alter table public.project_events enable row level security;
alter table public.evidence enable row level security;
alter table public.relationships enable row level security;
alter table public.evidence_links enable row level security;

-- Data API exposure is explicit for modern Supabase projects.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.organizations to authenticated;
grant select, insert, update, delete on public.organization_members to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.companies to authenticated;
grant select, insert, update, delete on public.people to authenticated;
grant select, insert, update, delete on public.project_participants to authenticated;
grant select, insert, update, delete on public.project_events to authenticated;
grant select, insert, update, delete on public.evidence to authenticated;
grant select, insert, update, delete on public.relationships to authenticated;
grant select, insert, update, delete on public.evidence_links to authenticated;

create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = org_id
      and om.user_id = (select auth.uid())
  );
$$;

create policy "members can read organizations" on public.organizations
for select to authenticated using (public.is_org_member(id));

create policy "users can create organizations" on public.organizations
for insert to authenticated with check ((select auth.uid()) = created_by);

create policy "members can read memberships" on public.organization_members
for select to authenticated using (public.is_org_member(organization_id));

create policy "org owners can add memberships" on public.organization_members
for insert to authenticated with check (
  exists (
    select 1 from public.organization_members om
    where om.organization_id = organization_members.organization_id
      and om.user_id = (select auth.uid())
      and om.role in ('owner','admin')
  )
);

create policy "members can read projects" on public.projects
for select to authenticated using (public.is_org_member(organization_id));
create policy "members can create projects" on public.projects
for insert to authenticated with check (public.is_org_member(organization_id) and created_by = (select auth.uid()));
create policy "members can update projects" on public.projects
for update to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

create policy "members manage companies" on public.companies
for all to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "members manage people" on public.people
for all to authenticated using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

create policy "members manage project participants" on public.project_participants
for all to authenticated
using (exists (select 1 from public.projects p where p.id = project_id and public.is_org_member(p.organization_id)))
with check (exists (select 1 from public.projects p where p.id = project_id and public.is_org_member(p.organization_id)));

create policy "members manage project events" on public.project_events
for all to authenticated
using (exists (select 1 from public.projects p where p.id = project_id and public.is_org_member(p.organization_id)))
with check (exists (select 1 from public.projects p where p.id = project_id and public.is_org_member(p.organization_id)));

create policy "members manage evidence" on public.evidence
for all to authenticated
using (exists (select 1 from public.projects p where p.id = project_id and public.is_org_member(p.organization_id)))
with check (exists (select 1 from public.projects p where p.id = project_id and public.is_org_member(p.organization_id)));

create policy "members manage relationships" on public.relationships
for all to authenticated
using (exists (select 1 from public.projects p where p.id = project_id and public.is_org_member(p.organization_id)))
with check (exists (select 1 from public.projects p where p.id = project_id and public.is_org_member(p.organization_id)));

create policy "members manage evidence links" on public.evidence_links
for all to authenticated
using (
  exists (
    select 1 from public.evidence e
    join public.projects p on p.id = e.project_id
    where e.id = evidence_id and public.is_org_member(p.organization_id)
  )
)
with check (
  exists (
    select 1 from public.evidence e
    join public.projects p on p.id = e.project_id
    where e.id = evidence_id and public.is_org_member(p.organization_id)
  )
);


-- RLS recursion fix: membership checks must bypass organization_members RLS safely.
create schema if not exists private;

create or replace function private.is_org_creator(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organizations o
    where o.id = org_id
      and o.created_by = (select auth.uid())
  );
$$;

create or replace function private.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members om
    where om.organization_id = org_id
      and om.user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_org_creator(uuid) from public;
revoke all on function private.is_org_member(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_org_creator(uuid) to authenticated;
grant execute on function private.is_org_member(uuid) to authenticated;

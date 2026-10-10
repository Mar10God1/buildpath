-- Major work phases (activities) and the dependencies between them.
-- Setbacks are linked to the phase they hit through public.relationships
-- (from_type 'project_event', relationship_type 'impacts', to_type 'project_activity').

create table if not exists public.project_activities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  trade text,
  sort_order integer not null default 0,
  planned_start date not null,
  planned_finish date not null,
  actual_start date,
  actual_finish date,
  percent_complete integer not null default 0 check (percent_complete between 0 and 100),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activity_dates check (planned_finish >= planned_start),
  constraint activity_actual_dates check (actual_finish is null or actual_start is null or actual_finish >= actual_start)
);
create index if not exists project_activities_project_idx on public.project_activities(project_id, sort_order);

create table if not exists public.activity_dependencies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  predecessor_id uuid not null references public.project_activities(id) on delete cascade,
  successor_id uuid not null references public.project_activities(id) on delete cascade,
  dependency_type text not null default 'FS' check (dependency_type in ('FS','SS')),
  lag_days integer not null default 0,
  created_at timestamptz not null default now(),
  constraint dependency_not_self check (predecessor_id <> successor_id),
  unique (predecessor_id, successor_id)
);
create index if not exists activity_dependencies_project_idx on public.activity_dependencies(project_id);

alter table public.project_activities enable row level security;
alter table public.activity_dependencies enable row level security;
grant select, insert, update, delete on public.project_activities to authenticated;
grant select, insert, update, delete on public.activity_dependencies to authenticated;

drop policy if exists "roles read project activities" on public.project_activities;
create policy "roles read project activities" on public.project_activities
for select to authenticated using (private.can_project(project_id, 'view_timeline'));
drop policy if exists "roles manage project activities" on public.project_activities;
create policy "roles manage project activities" on public.project_activities
for all to authenticated
using (private.can_project(project_id, 'edit_timeline'))
with check (private.can_project(project_id, 'edit_timeline'));

drop policy if exists "roles read activity dependencies" on public.activity_dependencies;
create policy "roles read activity dependencies" on public.activity_dependencies
for select to authenticated using (private.can_project(project_id, 'view_timeline'));
drop policy if exists "roles manage activity dependencies" on public.activity_dependencies;
create policy "roles manage activity dependencies" on public.activity_dependencies
for all to authenticated
using (private.can_project(project_id, 'edit_timeline'))
with check (
  private.can_project(project_id, 'edit_timeline')
  and exists (select 1 from public.project_activities a where a.id = predecessor_id and a.project_id = activity_dependencies.project_id)
  and exists (select 1 from public.project_activities a where a.id = successor_id and a.project_id = activity_dependencies.project_id)
);

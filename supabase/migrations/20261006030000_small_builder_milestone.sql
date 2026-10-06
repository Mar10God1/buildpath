-- Small-builder milestone 1: clients, change orders, and AI daily logs.
-- NOT YET APPLIED to the live BuildPath Supabase project. Review, then apply with
-- the Supabase dashboard SQL editor, `supabase db push`, or ask Claude to apply it.
-- Uses the existing private.is_org_member() helper from the live database.

-- ── Clients (homeowners / building owners) ─────────────────────────────────
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  address text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists clients_org_idx on public.clients(organization_id);

alter table public.projects
  add column if not exists client_id uuid references public.clients(id) on delete set null;

-- ── Change orders ───────────────────────────────────────────────────────────
create table if not exists public.change_orders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  number integer not null,
  title text not null,
  description text,
  reason text,
  line_items jsonb not null default '[]'::jsonb,   -- [{description, quantity, unit, unit_price, amount}]
  amount numeric(14,2),                            -- total; null when pricing is still TBD
  schedule_impact_days integer,
  status text not null default 'draft'
    check (status in ('draft','sent','approved','declined','void')),
  requested_by text,                               -- who asked for it, as stated in the source
  source_text text,                                -- the text / voice note it was drafted from
  source_evidence_ids uuid[] not null default '{}',
  ai_generated boolean not null default false,
  ai_model text,
  sent_at timestamptz,
  decided_at timestamptz,
  decided_by_name text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, number)
);
create index if not exists change_orders_project_idx on public.change_orders(project_id, created_at desc);

-- ── Daily logs ──────────────────────────────────────────────────────────────
create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  log_date date not null,
  summary text,
  work_completed text,
  deliveries text,
  issues text,
  safety text,
  weather text,
  open_items text,
  status text not null default 'draft' check (status in ('draft','final')),
  source_submission_ids uuid[] not null default '{}',
  ai_generated boolean not null default false,
  ai_model text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, log_date)
);
create index if not exists daily_logs_project_idx on public.daily_logs(project_id, log_date desc);

-- ── Row-level security ──────────────────────────────────────────────────────
alter table public.clients enable row level security;
alter table public.change_orders enable row level security;
alter table public.daily_logs enable row level security;

grant select, insert, update, delete on public.clients to authenticated;
grant select, insert, update, delete on public.change_orders to authenticated;
grant select, insert, update, delete on public.daily_logs to authenticated;

drop policy if exists "members manage clients" on public.clients;
create policy "members manage clients" on public.clients
for all to authenticated
using (private.is_org_member(organization_id))
with check (private.is_org_member(organization_id));

drop policy if exists "members manage change orders" on public.change_orders;
create policy "members manage change orders" on public.change_orders
for all to authenticated
using (exists (select 1 from public.projects p where p.id = project_id and private.is_org_member(p.organization_id)))
with check (exists (select 1 from public.projects p where p.id = project_id and private.is_org_member(p.organization_id)));

drop policy if exists "members manage daily logs" on public.daily_logs;
create policy "members manage daily logs" on public.daily_logs
for all to authenticated
using (exists (select 1 from public.projects p where p.id = project_id and private.is_org_member(p.organization_id)))
with check (exists (select 1 from public.projects p where p.id = project_id and private.is_org_member(p.organization_id)));

-- Let document extraction propose change requests for review.
alter table public.extraction_candidates drop constraint if exists extraction_candidates_candidate_type_check;
alter table public.extraction_candidates add constraint extraction_candidates_candidate_type_check
  check (candidate_type = any (array['event','person','company','cost','commitment','date','relationship','document_fact','requirement','change_request']));

-- Next change-order number for a job (1, 2, 3 …), callable by org members.
create or replace function public.next_change_order_number(p_project_id uuid)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(max(co.number), 0) + 1
  from public.change_orders co
  where co.project_id = p_project_id;
$$;
grant execute on function public.next_change_order_number(uuid) to authenticated;

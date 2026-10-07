create table if not exists public.consultation_pilot_feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  usefulness integer check (usefulness between 1 and 5),
  ease_of_use integer check (ease_of_use between 1 and 5),
  would_pay text check (would_pay in ('yes','maybe','no')),
  price_point integer,
  most_valuable text,
  missing text,
  comments text,
  created_at timestamptz not null default now()
);
alter table public.consultation_pilot_feedback enable row level security;
revoke all on public.consultation_pilot_feedback from anon;
grant select,insert on public.consultation_pilot_feedback to authenticated;
drop policy if exists "members submit consultation feedback" on public.consultation_pilot_feedback;
create policy "members submit consultation feedback"
on public.consultation_pilot_feedback for insert to authenticated
with check (
  created_by=(select auth.uid())
  and private.is_org_member(organization_id)
  and (
    project_id is null or exists (
      select 1 from public.projects p
      where p.id=consultation_pilot_feedback.project_id
        and p.organization_id=consultation_pilot_feedback.organization_id
    )
  )
);
drop policy if exists "members read consultation feedback" on public.consultation_pilot_feedback;
create policy "members read consultation feedback"
on public.consultation_pilot_feedback for select to authenticated
using (private.is_org_member(organization_id));
create index if not exists idx_consultation_feedback_org_created
on public.consultation_pilot_feedback(organization_id,created_at desc);

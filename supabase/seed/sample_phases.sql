-- BuildPath sample phases, dependencies and setback links
-- for the "Live Oak Builders (Sample)" projects. Requires migration
-- 20261010030000_project_activities_dependencies.sql and sample_data.sql.
-- Safe to re-run: inserts are skipped when the phase/link already exists.

with p(project_id, name, trade, sort_order, planned_start, planned_finish, actual_start, actual_finish, percent_complete) as (values
  -- Riverside Medical Office Building
  ('d9fd4556-390d-533a-b9d4-f2885044e1b7'::uuid,'Sitework & building pad','Live Oak / civil',10,'2026-03-02'::date,'2026-04-03'::date,'2026-03-02'::date,'2026-04-06'::date,100),
  ('d9fd4556-390d-533a-b9d4-f2885044e1b7','Foundations — piers & grade beams','Cedar Park Concrete',20,'2026-04-13','2026-05-29','2026-04-20','2026-06-05',100),
  ('d9fd4556-390d-533a-b9d4-f2885044e1b7','Structural steel & deck','Capital Steel',30,'2026-06-08','2026-07-24','2026-06-15','2026-07-31',100),
  ('d9fd4556-390d-533a-b9d4-f2885044e1b7','Roofing','Colorado River Roofing',40,'2026-08-03','2026-09-04','2026-08-10',null,70),
  ('d9fd4556-390d-533a-b9d4-f2885044e1b7','Interior framing','Lone Star Framing',50,'2026-09-08','2026-10-23','2026-09-08',null,55),
  ('d9fd4556-390d-533a-b9d4-f2885044e1b7','MEP rough-in','Hill Country Mech / Bluebonnet',60,'2026-09-21','2026-11-20','2026-09-28',null,30),
  ('d9fd4556-390d-533a-b9d4-f2885044e1b7','Curtain wall & glazing','Balcones Glass',70,'2026-09-14','2026-11-06',null,null,0),
  ('d9fd4556-390d-533a-b9d4-f2885044e1b7','Drywall & taping','Southwest Drywall',80,'2026-10-12','2026-12-11',null,null,0),
  ('d9fd4556-390d-533a-b9d4-f2885044e1b7','Electrical service & switchgear','Bluebonnet Electric',90,'2026-10-05','2026-12-18',null,null,0),
  ('d9fd4556-390d-533a-b9d4-f2885044e1b7','Ceilings & finishes','Multiple trades',100,'2026-11-30','2027-01-22',null,null,0),
  ('d9fd4556-390d-533a-b9d4-f2885044e1b7','Permanent power & energization','Austin Energy',110,'2026-12-21','2027-01-08',null,null,0),
  ('d9fd4556-390d-533a-b9d4-f2885044e1b7','Commissioning & testing','Cx agent',120,'2027-01-25','2027-02-05',null,null,0),
  ('d9fd4556-390d-533a-b9d4-f2885044e1b7','Punch & substantial completion','Live Oak',130,'2027-02-08','2027-02-12',null,null,0),
  -- Mueller Residence
  ('dd302267-e545-5566-9375-08ae63821df8','Foundation (post-tension slab)','Cedar Park Concrete',10,'2026-02-16','2026-03-06','2026-02-16','2026-03-06',100),
  ('dd302267-e545-5566-9375-08ae63821df8','Framing & sheathing','Lone Star Framing',20,'2026-03-16','2026-05-08','2026-03-16','2026-05-12',100),
  ('dd302267-e545-5566-9375-08ae63821df8','Roofing','Colorado River Roofing',30,'2026-05-26','2026-06-12','2026-05-26','2026-06-12',100),
  ('dd302267-e545-5566-9375-08ae63821df8','MEP rough-in','Bluebonnet / Travis Plumbing',40,'2026-05-18','2026-07-31','2026-05-20','2026-08-06',100),
  ('dd302267-e545-5566-9375-08ae63821df8','Insulation & energy inspection','Live Oak',50,'2026-08-17','2026-08-21','2026-08-17','2026-08-21',100),
  ('dd302267-e545-5566-9375-08ae63821df8','Drywall','Southwest Drywall',60,'2026-08-31','2026-09-25','2026-08-31','2026-09-25',100),
  ('dd302267-e545-5566-9375-08ae63821df8','Cabinets & millwork','Barton Creek Cabinetry',70,'2026-10-12','2026-10-30',null,null,0),
  ('dd302267-e545-5566-9375-08ae63821df8','Tile — kitchen & baths','Tile sub',80,'2026-10-19','2026-11-13',null,null,0),
  ('dd302267-e545-5566-9375-08ae63821df8','Countertops & scullery','Barton Creek / quartz fabricator',90,'2026-11-02','2026-11-13',null,null,0),
  ('dd302267-e545-5566-9375-08ae63821df8','Trim, paint & fixtures','Multiple trades',100,'2026-11-16','2026-12-04',null,null,0),
  ('dd302267-e545-5566-9375-08ae63821df8','Final inspection & move-in','Live Oak',110,'2026-12-07','2026-12-18',null,null,0)
)
insert into public.project_activities (project_id, name, trade, sort_order, planned_start, planned_finish, actual_start, actual_finish, percent_complete)
select p.project_id, p.name, p.trade, p.sort_order, p.planned_start, p.planned_finish, p.actual_start, p.actual_finish, p.percent_complete
from p where not exists (select 1 from public.project_activities a where a.project_id = p.project_id and a.name = p.name);

with d(project_id, pred, succ, dep_type, lag) as (values
  ('d9fd4556-390d-533a-b9d4-f2885044e1b7'::uuid,'Sitework & building pad','Foundations — piers & grade beams','FS',0),
  ('d9fd4556-390d-533a-b9d4-f2885044e1b7','Foundations — piers & grade beams','Structural steel & deck','FS',0),
  ('d9fd4556-390d-533a-b9d4-f2885044e1b7','Structural steel & deck','Roofing','FS',0),
  ('d9fd4556-390d-533a-b9d4-f2885044e1b7','Structural steel & deck','Interior framing','FS',0),
  ('d9fd4556-390d-533a-b9d4-f2885044e1b7','Structural steel & deck','Curtain wall & glazing','FS',0),
  ('d9fd4556-390d-533a-b9d4-f2885044e1b7','Interior framing','MEP rough-in','SS',13),
  ('d9fd4556-390d-533a-b9d4-f2885044e1b7','Interior framing','Drywall & taping','FS',-12),
  ('d9fd4556-390d-533a-b9d4-f2885044e1b7','Drywall & taping','Ceilings & finishes','FS',-12),
  ('d9fd4556-390d-533a-b9d4-f2885044e1b7','Electrical service & switchgear','Permanent power & energization','FS',0),
  ('d9fd4556-390d-533a-b9d4-f2885044e1b7','Ceilings & finishes','Commissioning & testing','FS',2),
  ('d9fd4556-390d-533a-b9d4-f2885044e1b7','Permanent power & energization','Commissioning & testing','FS',16),
  ('d9fd4556-390d-533a-b9d4-f2885044e1b7','Commissioning & testing','Punch & substantial completion','FS',2),
  ('d9fd4556-390d-533a-b9d4-f2885044e1b7','Curtain wall & glazing','Punch & substantial completion','FS',0),
  ('d9fd4556-390d-533a-b9d4-f2885044e1b7','Roofing','Punch & substantial completion','FS',0),
  ('dd302267-e545-5566-9375-08ae63821df8','Foundation (post-tension slab)','Framing & sheathing','FS',9),
  ('dd302267-e545-5566-9375-08ae63821df8','Framing & sheathing','Roofing','FS',0),
  ('dd302267-e545-5566-9375-08ae63821df8','Framing & sheathing','MEP rough-in','FS',0),
  ('dd302267-e545-5566-9375-08ae63821df8','MEP rough-in','Insulation & energy inspection','FS',0),
  ('dd302267-e545-5566-9375-08ae63821df8','Roofing','Insulation & energy inspection','FS',0),
  ('dd302267-e545-5566-9375-08ae63821df8','Insulation & energy inspection','Drywall','FS',0),
  ('dd302267-e545-5566-9375-08ae63821df8','Drywall','Cabinets & millwork','FS',0),
  ('dd302267-e545-5566-9375-08ae63821df8','Drywall','Tile — kitchen & baths','FS',0),
  ('dd302267-e545-5566-9375-08ae63821df8','Cabinets & millwork','Countertops & scullery','FS',0),
  ('dd302267-e545-5566-9375-08ae63821df8','Tile — kitchen & baths','Trim, paint & fixtures','FS',0),
  ('dd302267-e545-5566-9375-08ae63821df8','Countertops & scullery','Trim, paint & fixtures','FS',0),
  ('dd302267-e545-5566-9375-08ae63821df8','Trim, paint & fixtures','Final inspection & move-in','FS',0)
)
insert into public.activity_dependencies (project_id, predecessor_id, successor_id, dependency_type, lag_days)
select d.project_id, a.id, b.id, d.dep_type, d.lag
from d
join public.project_activities a on a.project_id = d.project_id and a.name = d.pred
join public.project_activities b on b.project_id = d.project_id and b.name = d.succ
on conflict (predecessor_id, successor_id) do nothing;

with l(project_id, event_id, phase) as (values
  ('d9fd4556-390d-533a-b9d4-f2885044e1b7'::uuid,'19de9793-a814-5ebd-bc1c-6d30e73245d0'::uuid,'Interior framing'),
  ('d9fd4556-390d-533a-b9d4-f2885044e1b7','425b4e56-152c-5c4b-91ed-9a4974a6a33f','Interior framing'),
  ('d9fd4556-390d-533a-b9d4-f2885044e1b7','177b8b38-4a2b-5493-be2b-2bf0b39143d6','Curtain wall & glazing'),
  ('d9fd4556-390d-533a-b9d4-f2885044e1b7','ef9db32f-f3e5-5d9e-aacd-a1c2ce5311d2','Electrical service & switchgear'),
  ('d9fd4556-390d-533a-b9d4-f2885044e1b7','b0932328-9f1f-5357-89b1-8dc9dc9a95de','Structural steel & deck'),
  ('d9fd4556-390d-533a-b9d4-f2885044e1b7','5ef01597-cb39-556f-895e-4d6c1751fe44','Foundations — piers & grade beams'),
  ('d9fd4556-390d-533a-b9d4-f2885044e1b7','b01a9b99-9816-5e5d-bbee-1856ade8d78d','Sitework & building pad'),
  ('dd302267-e545-5566-9375-08ae63821df8','7b08986b-c059-5cc0-a64c-f90df7a535fa','Framing & sheathing'),
  ('dd302267-e545-5566-9375-08ae63821df8','e5e76f11-a396-52a6-a801-2dfdc34471b7','Tile — kitchen & baths'),
  ('dd302267-e545-5566-9375-08ae63821df8','81e2985c-575a-557f-a461-33b85e17d81f','Countertops & scullery')
)
insert into public.relationships (project_id, from_type, from_id, relationship_type, to_type, to_id, confidence, is_user_confirmed)
select l.project_id, 'project_event', l.event_id, 'impacts', 'project_activity', a.id, 1, true
from l join public.project_activities a on a.project_id = l.project_id and a.name = l.phase
where exists (select 1 from public.project_events e where e.id = l.event_id)
on conflict (project_id, from_type, from_id, relationship_type, to_type, to_id) do nothing;

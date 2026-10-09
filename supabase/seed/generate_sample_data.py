#!/usr/bin/env python3
"""
BuildPath sample data generator.

Creates a self-contained demo company, "Live Oak Builders (Sample)", with four
realistic Austin-area construction projects at different stages, plus the
companies, people, vendors, compliance documents, field captures, AI review
queue items, events and evidence that make every BuildPath screen meaningful.

Everything hangs off one organization row, so it can be removed with:
    delete from public.organizations where id = '<SAMPLE_ORG_ID printed below>';

Usage:
    python3 supabase/seed/generate_sample_data.py you@example.com > supabase/seed/sample_data.sql

IDs are deterministic (uuid5), so re-running the SQL replaces the sample set
cleanly instead of duplicating it.
"""
import json
import sys
import uuid

NS = uuid.UUID("6f1c2a0e-8b7d-4c1e-9a55-b0d1a7e3c901")


def uid(*parts):
    return str(uuid.uuid5(NS, "|".join(parts)))


# The SQL never contains a real user id: it looks the owner up by email at run time.
OWNER_EMAIL = sys.argv[1] if len(sys.argv) > 1 else "you@example.com"
OWNER = "__OWNER__"
ORG = uid("org", "live-oak-builders")

rows = {}  # table -> list[dict]
order = []


def add(table, **row):
    if table not in rows:
        rows[table] = []
        order.append(table)
    rows[table].append(row)
    return row


def lit(v):
    if v == OWNER:
        return "(select id from _seed_owner)"
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(v)
    if isinstance(v, (dict, list)):
        return "'" + json.dumps(v).replace("'", "''") + "'::jsonb"
    return "'" + str(v).replace("'", "''") + "'"


def ts(d, t="09:00"):
    """Central-time timestamp literal."""
    return f"{d} {t}-05" if d else None


# ---------------------------------------------------------------------------
# Organization
# ---------------------------------------------------------------------------
add("organizations", id=ORG, name="Live Oak Builders (Sample)", created_by=OWNER)
add("organization_members", organization_id=ORG, user_id=OWNER, role="owner")

# ---------------------------------------------------------------------------
# Companies (org-wide directory)
# ---------------------------------------------------------------------------
COMPANIES = {
    "liveoak": ("Live Oak Builders", "general_contractor"),
    "rhp": ("Riverside Health Partners", "owner"),
    "halvorsen": ("Halvorsen Architects", "architect"),
    "brazos": ("Brazos Structural Engineers", "engineer"),
    "pecan": ("Pecan Street MEP Engineering", "engineer"),
    "capsteel": ("Capital Steel Fabricators", "subcontractor"),
    "lonestar": ("Lone Star Framing Co.", "subcontractor"),
    "bluebonnet": ("Bluebonnet Electric", "subcontractor"),
    "hcmech": ("Hill Country Mechanical", "subcontractor"),
    "travisplumb": ("Travis Plumbing Services", "subcontractor"),
    "cpconcrete": ("Cedar Park Concrete", "subcontractor"),
    "balcones": ("Balcones Glass & Glazing", "subcontractor"),
    "crroof": ("Colorado River Roofing", "subcontractor"),
    "swdrywall": ("Southwest Drywall & Acoustics", "subcontractor"),
    "hayslumber": ("Hays County Lumber Supply", "supplier"),
    "geotech": ("Austin Geotech & Testing", "testing_agency"),
    "coa": ("City of Austin Development Services", "jurisdiction"),
    "mueller": ("Mueller Family (Owner)", "owner"),
    "bouldin": ("Bouldin Design Studio", "architect"),
    "bcabinet": ("Barton Creek Cabinetry", "subcontractor"),
    "hcbank": ("Hill Country Bank", "lender"),
    "fieldwork": ("Fieldwork Coffee Roasters", "owner"),
    "socoretail": ("SoCo Retail Partners LP", "landlord"),
    "bpisd": ("Blackland Prairie ISD", "owner"),
    "prairieline": ("Prairie Line Architects", "architect"),
    "frontier": ("Frontier Surety Co.", "surety"),
    "abatement": ("Centex Environmental Abatement", "subcontractor"),
}
CID = {k: uid("company", k) for k in COMPANIES}
for k, (name, ctype) in COMPANIES.items():
    add("companies", id=CID[k], organization_id=ORG, name=name, company_type=ctype)

# ---------------------------------------------------------------------------
# People
# ---------------------------------------------------------------------------
PEOPLE = {
    # Live Oak staff
    "ortiz": ("Rachel", "Ortiz", "liveoak", "Senior Project Manager", "rortiz@liveoakbuilders.example", "512-555-0141"),
    "reyes": ("Tomás", "Reyes", "liveoak", "Superintendent", "treyes@liveoakbuilders.example", "512-555-0142"),
    "duong": ("Kevin", "Duong", "liveoak", "Superintendent — Residential", "kduong@liveoakbuilders.example", "512-555-0143"),
    "barnes": ("Alicia", "Barnes", "liveoak", "Project Engineer", "abarnes@liveoakbuilders.example", "512-555-0144"),
    "whitfield": ("Grace", "Whitfield", "liveoak", "Controller", "gwhitfield@liveoakbuilders.example", "512-555-0145"),
    "lyle": ("Derek", "Lyle", "liveoak", "Preconstruction Manager", "dlyle@liveoakbuilders.example", "512-555-0146"),
    # Owners / design
    "chen": ("Marcus", "Chen", "rhp", "Director of Real Estate & Facilities", "mchen@riversidehealth.example", "512-555-0210"),
    "patel": ("Nina", "Patel", "rhp", "Clinical Operations Lead", "npatel@riversidehealth.example", "512-555-0211"),
    "halvorsen": ("Erik", "Halvorsen", "halvorsen", "Principal Architect", "erik@halvorsenarch.example", "512-555-0220"),
    "kim": ("Jenna", "Kim", "halvorsen", "Project Architect", "jkim@halvorsenarch.example", "512-555-0221"),
    "okafor": ("Daniel", "Okafor", "brazos", "Structural Engineer of Record, PE", "dokafor@brazosse.example", "512-555-0230"),
    "russo": ("Paula", "Russo", "pecan", "Electrical Engineer, PE", "prusso@pecanmep.example", "512-555-0240"),
    # Trades
    "garza": ("Luis", "Garza", "capsteel", "Project Manager", "lgarza@capitalsteel.example", "512-555-0310"),
    "beckett": ("Shane", "Beckett", "lonestar", "Owner / Foreman", "shane@lonestarframing.example", "512-555-0320"),
    "nguyen": ("Tina", "Nguyen", "bluebonnet", "Electrical Project Manager", "tnguyen@bluebonnetelectric.example", "512-555-0330"),
    "walker": ("Brent", "Walker", "hcmech", "Service & Project Manager", "bwalker@hcmechanical.example", "512-555-0340"),
    "morales": ("Hector", "Morales", "travisplumb", "Master Plumber", "hmorales@travisplumbing.example", "512-555-0350"),
    "fisher": ("Amy", "Fisher", "balcones", "Estimator / PM", "afisher@balconesglass.example", "512-555-0360"),
    "sato": ("Ken", "Sato", "geotech", "Field Testing Lead", "ksato@austingeotech.example", "512-555-0370"),
    "dunn": ("Carla", "Dunn", "coa", "Building Inspector", "carla.dunn@austintx.example", "512-555-0380"),
    # Residential
    "dmueller": ("Daniel", "Mueller", "mueller", "Homeowner", "dan.mueller@gmail.example", "512-555-0410"),
    "pmueller": ("Priya", "Mueller", "mueller", "Homeowner", "priya.mueller@gmail.example", "512-555-0411"),
    "laurent": ("Sophie", "Laurent", "bouldin", "Residential Designer", "sophie@bouldindesign.example", "512-555-0420"),
    "hale": ("Jordan", "Hale", "bcabinet", "Shop Manager", "jordan@bartoncreekcab.example", "512-555-0430"),
    "pruitt": ("Linda", "Pruitt", "hcbank", "Construction Loan Officer", "lpruitt@hillcountrybank.example", "512-555-0440"),
    # Coffee TI
    "avila": ("Maya", "Avila", "fieldwork", "Founder & CEO", "maya@fieldworkcoffee.example", "512-555-0510"),
    "brooks": ("Tyler", "Brooks", "socoretail", "Property Manager", "tbrooks@socoretail.example", "512-555-0520"),
    # School
    "hollis": ("Dr. Renee", "Hollis", "bpisd", "Executive Director of Facilities", "rhollis@bpisd.example", "512-555-0610"),
    "vance": ("Paul", "Vance", "bpisd", "Purchasing & HUB Coordinator", "pvance@bpisd.example", "512-555-0611"),
    "acosta": ("Gabriel", "Acosta", "prairieline", "Project Architect", "gacosta@prairieline.example", "512-555-0620"),
    "quinn": ("Morgan", "Quinn", "abatement", "Abatement Supervisor", "mquinn@centexenviro.example", "512-555-0630"),
}
PID = {k: uid("person", k) for k in PEOPLE}
for k, (fn, ln, co, title, email, phone) in PEOPLE.items():
    add("people", id=PID[k], organization_id=ORG, company_id=CID[co], first_name=fn,
        last_name=ln, title=title, email=email, phone=phone)

# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------
PROJECTS = {
    "mob": dict(
        name="Riverside Medical Office Building", address="6100 E Riverside Dr", city="Austin", state="TX",
        project_type="Healthcare", baseline_start="2026-03-02", target_finish="2027-02-12",
        original_budget=12400000, status="At Risk", project_stage="construction", user_role="general_contractor",
        construction_mode="new_construction", funding_type="private"),
    "mueller": dict(
        name="Mueller Residence — Ridge Oak", address="4512 Ridge Oak Dr", city="Austin", state="TX",
        project_type="Residential", baseline_start="2026-02-16", target_finish="2026-12-18",
        original_budget=1850000, status="active", project_stage="construction", user_role="general_contractor",
        construction_mode="new_construction", funding_type="private"),
    "coffee": dict(
        name="Fieldwork Coffee — South Congress TI", address="1612 S Congress Ave, Suite 140", city="Austin", state="TX",
        project_type="Commercial Retail", baseline_start="2026-05-04", target_finish="2026-09-25",
        original_budget=640000, status="Closeout", project_stage="closeout", user_role="project_manager",
        construction_mode="tenant_improvement", funding_type="private"),
    "school": dict(
        name="Northbrook Elementary Roof & HVAC Replacement", address="2201 Wells Branch Pkwy", city="Pflugerville", state="TX",
        project_type="Education", baseline_start="2026-09-14", target_finish="2027-08-06",
        original_budget=3250000, status="planning", project_stage="procurement", user_role="general_contractor",
        construction_mode="capital_improvement", funding_type="public"),
}
PRJ = {k: uid("project", k) for k in PROJECTS}
for k, p in PROJECTS.items():
    add("projects", id=PRJ[k], organization_id=ORG, created_by=OWNER, **p)

# ---------------------------------------------------------------------------
# Participants
# ---------------------------------------------------------------------------
PARTICIPANTS = {
    "mob": [("rhp", "chen", "Owner"), ("rhp", "patel", "Owner — clinical user rep"), ("halvorsen", "halvorsen", "Architect of record"),
            ("halvorsen", "kim", "Project architect"), ("brazos", "okafor", "Structural engineer"), ("pecan", "russo", "MEP engineer"),
            ("liveoak", "ortiz", "GC project manager"), ("liveoak", "reyes", "GC superintendent"), ("liveoak", "barnes", "GC project engineer"),
            ("capsteel", "garza", "Structural steel"), ("lonestar", "beckett", "Metal stud framing"), ("bluebonnet", "nguyen", "Electrical"),
            ("hcmech", "walker", "HVAC"), ("travisplumb", "morales", "Plumbing"), ("balcones", "fisher", "Curtain wall & glazing"),
            ("geotech", "sato", "Testing & special inspections"), ("coa", "dunn", "Building inspections"), ("cpconcrete", None, "Concrete")],
    "mueller": [("mueller", "dmueller", "Owner"), ("mueller", "pmueller", "Owner"), ("bouldin", "laurent", "Designer"),
                ("liveoak", "ortiz", "GC project manager"), ("liveoak", "duong", "GC superintendent"), ("lonestar", "beckett", "Wood framing"),
                ("bluebonnet", "nguyen", "Electrical"), ("travisplumb", "morales", "Plumbing"), ("bcabinet", "hale", "Cabinetry & millwork"),
                ("hcbank", "pruitt", "Construction lender"), ("coa", "dunn", "Residential inspections"), ("hayslumber", None, "Lumber package"),
                ("crroof", None, "Standing-seam roofing")],
    "coffee": [("fieldwork", "avila", "Tenant / owner"), ("socoretail", "brooks", "Landlord"), ("halvorsen", "kim", "Architect"),
               ("liveoak", "ortiz", "GC project manager"), ("liveoak", "barnes", "GC project engineer"), ("hcmech", "walker", "HVAC & roaster exhaust"),
               ("travisplumb", "morales", "Plumbing & grease interceptor"), ("bluebonnet", "nguyen", "Electrical"), ("swdrywall", None, "Drywall & ceilings"),
               ("coa", "dunn", "Building & health inspections")],
    "school": [("bpisd", "hollis", "Owner"), ("bpisd", "vance", "Owner — purchasing & HUB"), ("prairieline", "acosta", "Architect"),
               ("liveoak", "lyle", "CMAR preconstruction lead"), ("liveoak", "ortiz", "CMAR project manager"), ("liveoak", "whitfield", "Controller — certified payroll"),
               ("crroof", None, "Roofing"), ("hcmech", "walker", "HVAC"), ("abatement", "quinn", "Asbestos abatement"), ("frontier", None, "Surety")],
}
for pk, lst in PARTICIPANTS.items():
    for co, person, role in lst:
        add("project_participants", id=uid("participant", pk, co, person or "-"), project_id=PRJ[pk],
            company_id=CID[co], person_id=PID[person] if person else None, role=role)

# ---------------------------------------------------------------------------
# Requirements (drive the adaptive workspace)
# ---------------------------------------------------------------------------
REQ_LABELS = dict(insurance="Insurance / COI", prevailing_wage="Prevailing wage", certified_payroll="Certified payroll",
                  bonding="Bonding", dbe_wbe="DBE / WBE requirements", permits="Permits / inspections",
                  infection_control="Infection control", safety_program="Safety program", commissioning="Commissioning",
                  public_reporting="Public reporting", submittals="Submittal tracking", rfi_tracking="RFI tracking")
REQS = {
    "mob": [("insurance", "user", None), ("permits", "user", None), ("submittals", "user", None), ("rfi_tracking", "user", None),
            ("commissioning", "document", "Spec section 01 91 13 requires third-party commissioning of HVAC and medical gas."),
            ("safety_program", "user", None)],
    "mueller": [("permits", "user", None), ("insurance", "inferred", "Lender requires COIs from trades over $25k.")],
    "coffee": [("insurance", "document", "Lease Exhibit D: tenant contractors must name landlord as additional insured."),
               ("permits", "user", None), ("commissioning", "user", "Roaster afterburner start-up & balancing report required.")],
    "school": [("insurance", "user", None), ("prevailing_wage", "document", "Texas Gov't Code 2258 — wage determination in Project Manual 00 73 46."),
               ("certified_payroll", "document", "Weekly certified payroll to district within 7 days of pay date."),
               ("bonding", "user", "100% payment & performance bonds required over $100k."),
               ("dbe_wbe", "document", "District HUB goal 20%; HUB subcontracting plan due with each bid package."),
               ("public_reporting", "user", "Monthly board facilities update."), ("submittals", "user", None), ("permits", "user", None)],
}
for pk, lst in REQS.items():
    for key, src, notes in lst:
        add("project_requirements", id=uid("req", pk, key), project_id=PRJ[pk], requirement_key=key,
            label=REQ_LABELS[key], enabled=True, source=src, notes=notes)

# ---------------------------------------------------------------------------
# Events + evidence helpers
# ---------------------------------------------------------------------------
EV = {}
EVD = {}


def event(pk, key, etype, title, desc, start, end=None, *, status="complete", cost=None, days=None,
          precision=None, conf=None, t="09:00"):
    eid = uid("event", pk, key)
    EV[(pk, key)] = eid
    add("project_events", id=eid, project_id=PRJ[pk], event_type=etype, title=title, description=desc,
        start_at=ts(start, t), end_at=ts(end, "17:00") if end else None,
        date_precision=precision or ("range" if end else "day"), confidence=conf, status=status,
        cost_impact=cost, schedule_impact_days=days, created_by=OWNER)
    return eid


def evidence(pk, key, etype, title, source, when, text, *, meta=None, links=(), t="10:00"):
    eid = uid("evidence", pk, key)
    EVD[(pk, key)] = eid
    m = {"sample": True}
    m.update(meta or {})
    add("evidence", id=eid, project_id=PRJ[pk], evidence_type=etype, title=title, source_system=source,
        occurred_at=ts(when, t), raw_text=text.strip(), metadata=m, created_by=OWNER)
    for ev_key, rel in links:
        add("evidence_links", evidence_id=eid, entity_type="project_event", entity_id=EV[(pk, ev_key)], relationship=rel)
    return eid


def rel(pk, a, kind, b, conf=None, confirmed=True):
    add("relationships", id=uid("rel", pk, a, kind, b), project_id=PRJ[pk], from_type="project_event",
        from_id=EV[(pk, a)], relationship_type=kind, to_type="project_event", to_id=EV[(pk, b)],
        confidence=conf, is_user_confirmed=confirmed)


# ===========================================================================
# PROJECT 1 — Riverside Medical Office Building (healthcare, mid-construction, at risk)
# ===========================================================================
P = "mob"
event(P, "baseline", "baseline", "Baseline schedule Rev 0 approved",
      "42,000 SF three-story medical office building. Steel frame, metal stud infill, unitized curtain wall. 347 calendar days.",
      "2026-03-02", "2027-02-12", status="approved", cost=0, days=0)
event(P, "mobilize", "schedule", "Mobilization & site clearing",
      "Fencing, SWPPP controls, construction entrance, temporary power from Austin Energy pole drop.", "2026-03-02", "2026-03-13")
event(P, "excavation", "schedule", "Mass excavation & building pad",
      "Cut/fill to pad elevation 512.0. Select fill placed in 8\" lifts.", "2026-03-16", "2026-04-03")
event(P, "co009", "change", "CO-009 Rock excavation at storm & utility trenches",
      "Limestone encountered 3–4 ft below grade along storm line; unit-price rock excavation per contract.",
      "2026-04-09", status="approved", cost=61500, days=2)
event(P, "padtest", "inspection", "Building pad density testing — passed",
      "14 of 14 nuclear density tests ≥ 98% Standard Proctor.", "2026-04-07")
event(P, "foundations", "schedule", "Drilled piers & grade beams",
      "96 drilled piers, 24\"–36\" dia. Grade beams and slab-on-grade L1.", "2026-04-20", "2026-05-29")
event(P, "rfi008", "rfi", "RFI-008 Pier depth at grid C-4 — rock shallower than geotech report",
      "EOR authorized 3 ft rock socket in lieu of 12 ft min. depth at C-4 through C-6.", "2026-05-12", status="closed", cost=0, days=1)
event(P, "co012", "change", "CO-012 Imaging suite lead-lined walls & door frames",
      "Owner added X-ray room to Suite 210. 1/16\" lead-lined gypsum, lead-lined frames, shielding report by physicist.",
      "2026-06-01", status="approved", cost=48600, days=0)
event(P, "steel", "schedule", "Structural steel erection",
      "Columns, beams, joists and deck, L2/L3/roof. Crane on site 6 weeks.", "2026-06-15", "2026-07-24")
event(P, "joists", "procurement", "Roof joist delivery slipped 9 days",
      "Joist supplier mill backlog. Erection resequenced to set L2/L3 first; roof deck pushed.", "2026-07-08",
      status="complete", cost=0, days=3)
event(P, "steelinsp", "inspection", "Special inspection — L2/L3 moment connections",
      "Bolted and welded connections inspected; two welds at grid D-7 required repair, re-inspected and accepted.", "2026-08-04")
event(P, "co014", "change", "CO-014 Low-voltage & data infrastructure upgrade",
      "Owner IT standard changed to Cat 6A and added two IDF rooms' cable tray.", "2026-08-11", status="approved", cost=88300, days=0)
event(P, "sub_studs", "submittal", "Submittal 09 22 16-01 Metal stud framing — approved as noted",
      "Gauge change to 18 ga at shaft walls noted by architect.", "2026-08-17", status="approved")
event(P, "sub_cw", "submittal", "Submittal 08 44 13-02 Curtain wall shop drawings — revise & resubmit",
      "Anchor embed spacing conflicts with slab-edge steel angle at L2. Resubmittal needed before fabrication release.",
      "2026-08-25", status="open", days=0)
event(P, "framing_start", "schedule", "Interior metal stud framing — L1 start",
      "Baseline framing start. Lone Star Framing, 2 crews.", "2026-09-08")
event(P, "rain", "weather", "Heavy rain — site access restricted",
      "4.6\" over three days. Laydown yard flooded, no material deliveries, crane pad unusable.",
      "2026-09-10", "2026-09-12", cost=9400, days=3)
event(P, "embed", "procurement", "Embedded steel release conflict with Capital Steel",
      "Slab-edge embeds for curtain wall held pending revised CW shop drawings; framing at perimeter can't close out.",
      "2026-09-16", status="open", days=4)
event(P, "co017", "change", "CO-017 Electrical service redesign — transformer relocation",
      "Austin Energy rejected pad-mount location (easement conflict). Service entrance moves to north wall; switchgear room reroute.",
      "2026-09-21", status="pending", cost=142800, days=8)
event(P, "rework", "field", "Rework — L2 wall layout conflicts with revised exam room plan",
      "Owner's clinical layout Rev C moved 11 exam room walls 18\"–30\". ~1,900 LF of track and studs removed and reinstalled.",
      "2026-09-26", status="complete", cost=33200, days=4)
event(P, "nearmiss", "safety", "Near miss — scissor lift left on unprotected L3 deck edge",
      "No injury. Lift moved, edge cable re-tensioned, stand-down held with all trades 9/30 AM.", "2026-09-30", status="closed")
event(P, "oac14", "meeting", "OAC Meeting #14",
      "Reviewed CO-017 pricing, curtain wall resubmittal, framing recovery plan (Saturday shifts), pay app #7.", "2026-10-02", t="10:00")
event(P, "gc_ext", "change", "PCO-021 Extended general conditions — 14 days",
      "Superintendent, trailer, equipment rental and site services for forecast delay. Pending owner review with CO-017.",
      "2026-10-05", status="pending", cost=74200, days=0)
event(P, "forecast", "forecast", "Framing now 14 days late — critical path exposure",
      "Rain (3d) + embed release (4d) + L2 rework (4d) + joist slip carryover (3d). Drywall start forecast Oct 26 vs Oct 12 baseline.",
      "2026-10-05", status="open", conf=0.85)
event(P, "c_cw", "commitment", "Halvorsen to reissue curtain wall embed details",
      "Committed at OAC #14 — Jenna Kim.", "2026-10-14", status="open", precision="day")
event(P, "c_co017", "commitment", "Owner decision on CO-017 needed to hold switchgear lead time",
      "Switchgear is 22 weeks ARO. Decision after Oct 16 pushes energization past substantial completion.",
      "2026-10-16", status="open")
event(P, "insp_above", "inspection", "Above-ceiling MEP rough-in inspection — L1",
      "City of Austin. Requires sprinkler, duct, conduit and med-gas rough complete in L1 east wing.", "2026-10-26", status="scheduled")
event(P, "dryin", "schedule", "Building dry-in", "Curtain wall, roofing and louvers complete; temp HVAC on.",
      "2026-11-16", status="planned", precision="week", conf=0.6)
event(P, "cx", "commissioning", "HVAC & medical gas functional testing",
      "Third-party Cx agent; med-gas certification per NFPA 99.", "2027-01-18", "2027-01-29", status="planned")
event(P, "sc_base", "milestone", "Substantial completion — baseline", "Contract date.", "2027-02-12", status="planned")
event(P, "sc_fcst", "forecast", "Substantial completion — forecast",
      "Assumes CO-017 approved by Oct 16 and Saturday framing shifts through November.",
      "2027-03-01", status="open", precision="week", conf=0.7)

evidence(P, "schedule_r0", "schedule", "Baseline Schedule Rev 0 (P6 export)", "upload", "2026-02-26",
         """Riverside MOB — Baseline Rev 0. NTP 3/2/2026. Substantial completion 2/12/2027 (347 CD).
Critical path: piers → grade beams → steel → deck → interior framing (L1 9/8, L2 9/22, L3 10/5) → drywall → ceilings → finishes → Cx.
Float on curtain wall: 6 working days. Weather days included: 12.""",
         meta={"file_name": "RMOB_Baseline_Rev0.pdf", "pages": 14}, links=[("baseline", "supports")])
evidence(P, "rfi008", "rfi", "RFI-008 Pier Depth at Grid C-4", "procore_export", "2026-05-12",
         """Question (A. Barnes): Rock encountered at 6'-2" at C-4, C-5, C-6. Geotech report B-7 shows rock at 14'. Plans require 12' min embedment. Please advise.
Response (D. Okafor, PE, 5/13): Provide 3'-0" min. rock socket into competent limestone, verified by geotech. No change in pier diameter. No cost impact anticipated.""",
         meta={"rfi_number": "008", "asked_by": "Alicia Barnes", "answered_by": "Daniel Okafor"}, links=[("rfi008", "supports")])
evidence(P, "co012", "change_order", "CO-012 Imaging Suite Shielding — Executed", "docusign", "2026-06-01",
         """Change Order 012. Description: Lead-lined gypsum (1/16" Pb) at Suite 210 X-ray room walls to 7'-0", lead-lined HM frames and door, physicist shielding survey.
Amount: $48,600.00. Time: 0 days. Signed: Marcus Chen (Owner) 6/1/26, Rachel Ortiz (Contractor) 5/29/26, Erik Halvorsen (Architect) 5/30/26.""",
         meta={"co_number": "012", "amount": 48600, "signed": True}, links=[("co012", "supports")])
evidence(P, "weather_email", "email", "Weather delay notice — Sept 10–12", "gmail", "2026-09-10",
         """From: Tomás Reyes  To: Rachel Ortiz; Marcus Chen  Subject: Weather delay notice
Rain started overnight, 2.1" so far per our gauge. Laydown yard is under water and the crane pad is soft. Halting deliveries through at least Friday. Lone Star crews sent home. I'll log this as weather days per GC 8.3.2 and send photos.""",
         meta={"from": "treyes@liveoakbuilders.example", "to": ["rortiz@liveoakbuilders.example", "mchen@riversidehealth.example"]},
         links=[("rain", "supports")], t="06:42")
evidence(P, "embed_email", "email", "RE: Curtain wall embeds — hold on release", "gmail", "2026-09-16",
         """From: Luis Garza (Capital Steel)  To: Rachel Ortiz  Cc: Amy Fisher; Jenna Kim
We can't release the slab-edge embeds for fab until the CW shop drawings are approved — the anchor spacing in 08 44 13-02 doesn't match our angle. If we guess and it's wrong we're cutting and re-welding in the field. Earliest fab after approval is 8 working days.
> Rachel: Understood. Jenna, can you prioritize the resubmittal review? Perimeter framing on L2 is waiting on this.""",
         meta={"from": "lgarza@capitalsteel.example", "thread_length": 4}, links=[("embed", "supports"), ("sub_cw", "references")], t="14:10")
evidence(P, "co017_pco", "change_order", "PCO-017 Electrical Service Relocation — Pricing", "upload", "2026-09-21",
         """Potential Change Order 017. Cause: Austin Energy rejected transformer pad at SE corner (conflict with 10' PUE). New location north wall per AE letter 9/18.
Scope: relocate pad & bollards, 4 sets 600 kcmil feeders (+180 LF), switchgear room relocation to 104B, revise L1 corridor ceilings.
Bluebonnet Electric: $118,400. GC markup & general conditions: $24,400. Total: $142,800. Time requested: 8 working days.
Note: switchgear lead time 22 weeks ARO; approval needed by 10/16 to hold energization date.""",
         meta={"pco_number": "017", "amount": 142800, "days": 8}, links=[("co017", "supports"), ("c_co017", "supports")])
evidence(P, "ae_letter", "letter", "Austin Energy — Service Location Determination", "upload", "2026-09-18",
         """Austin Energy Distribution Design. Re: 6100 E Riverside Dr. The proposed pad-mounted transformer location at the southeast corner encroaches the 10-ft public utility easement and conflicts with an existing 12" water main. Service shall be provided from the north property line. Revised service plan required prior to energization approval.""",
         meta={"issuer": "Austin Energy"}, links=[("co017", "caused_by")])
evidence(P, "daily_0926", "daily_report", "Daily Report — Sept 26, 2026", "field_app", "2026-09-26",
         """Weather: 91°F, clear. Manpower: Lone Star Framing 14, Bluebonnet 6, Hill Country Mech 5, Travis Plumbing 3.
Work: L2 framing east wing. STOPPED at exam rooms 212–224 — layout doesn't match clinical Rev C issued 9/24. Removed ~600 LF track today. A. Barnes notified architect.
Issues: Rework will take 3–4 days. Need Rev C dimensioned plan in the field by Monday.""",
         meta={"author": "Tomás Reyes", "manpower": 28}, links=[("rework", "supports")], t="17:30")
evidence(P, "clinical_revc", "drawing", "A2.2 L2 Floor Plan — Clinical Layout Rev C", "upload", "2026-09-24",
         """Sheet A2.2 Revision C (Owner clinical layout). Clouded changes: exam rooms 212–224 widened to 10'-6" to accommodate bariatric tables; nurse station relocated; clean/soiled utility swapped. Issued for construction 9/24/26.""",
         meta={"sheet": "A2.2", "revision": "C"}, links=[("rework", "caused_by")])
evidence(P, "nearmiss", "safety_report", "Near Miss Report NM-004", "field_app", "2026-09-30",
         """Observed 7:15 AM: electrician's scissor lift parked within 4 ft of L3 slab edge where cable rail was slack. No one on lift. Corrective: lift relocated, rail re-tensioned, all-hands stand-down 7:45 AM, toolbox talk on leading edges. Reported by T. Reyes.""",
         meta={"severity": "near_miss"}, links=[("nearmiss", "supports")], t="08:05")
evidence(P, "oac14", "meeting_note", "OAC Meeting #14 Minutes", "upload", "2026-10-02",
         """Attendees: M. Chen, N. Patel (Owner); E. Halvorsen, J. Kim (Architect); R. Ortiz, T. Reyes, A. Barnes (Live Oak).
14.1 CO-017 — Owner reviewing; asked for alternate pricing to keep switchgear in original room. Live Oak to provide by 10/9. Decision target 10/16.
14.2 Curtain wall resubmittal — Halvorsen to reissue embed details by 10/14.
14.3 Framing recovery — Lone Star adding Saturday shift through 11/21. Forecast framing complete 11/6 vs 10/23 baseline.
14.4 Pay App #7 — $1,184,220 reviewed, approved less 5% retainage.
14.5 Safety — near miss NM-004 reviewed.""",
         meta={"meeting_number": 14}, links=[("oac14", "supports"), ("c_cw", "supports"), ("c_co017", "supports"), ("forecast", "supports")])
evidence(P, "payapp7", "invoice", "Pay Application #7 (AIA G702/G703)", "upload", "2026-09-30",
         """Period to 9/30/26. Original contract $12,400,000. Net change orders $198,400. Contract sum to date $12,598,400.
Completed & stored to date $7,812,600 (62%). Retainage 5% $390,630. Current payment due $1,184,220.""",
         meta={"amount": 1184220, "percent_complete": 62})
evidence(P, "sched_update", "schedule", "Schedule Update #7 Narrative", "upload", "2026-10-05",
         """Data date 10/5/26. Critical path now runs through L2 perimeter framing → L2 drywall. Forecast substantial completion 3/1/27 (+17 CD vs baseline).
Drivers: weather 9/10–12 (3d), CW embed hold (4d), L2 clinical rework (4d), joist slip carryover (3d). Recovery: Saturday framing shifts; resequence L3 ahead of L2 perimeter.""",
         meta={"update_number": 7}, links=[("forecast", "supports"), ("sc_fcst", "supports")])
evidence(P, "steel_insp", "inspection_report", "Special Inspection Report SI-31 — Steel Connections", "upload", "2026-08-04",
         """Austin Geotech & Testing. Inspected 64 bolted and 22 welded moment connections, L2–L3. Two welds at D-7 rejected (undercut). Repaired and re-inspected 8/6 — accepted.""",
         meta={"inspector": "Ken Sato"}, links=[("steelinsp", "supports")])

rel(P, "rain", "contributes_to", "forecast", 0.95)
rel(P, "embed", "contributes_to", "forecast", 0.9)
rel(P, "rework", "contributes_to", "forecast", 0.95)
rel(P, "joists", "contributes_to", "forecast", 0.7, False)
rel(P, "sub_cw", "causes", "embed", 0.9)
rel(P, "co017", "requires", "c_co017", 1.0)
rel(P, "forecast", "drives", "gc_ext", 0.8)
rel(P, "forecast", "drives", "sc_fcst", 0.85)
rel(P, "sub_cw", "requires", "c_cw", 1.0)

# ===========================================================================
# PROJECT 2 — Mueller Residence (custom home, selections-driven)
# ===========================================================================
P = "mueller"
event(P, "baseline", "baseline", "Contract schedule approved",
      "4,650 SF two-story modern farmhouse with detached studio. Cost-plus with GMP, 10% fee.",
      "2026-02-16", "2026-12-18", status="approved", cost=0, days=0)
event(P, "permit", "inspection", "Building permit issued (City of Austin)", "Residential permit 2026-014473 PR.", "2026-02-10")
event(P, "foundation", "schedule", "Post-tension slab foundation", "Form, plumbing rough, PT cables, pour 2/27.", "2026-02-16", "2026-03-06")
event(P, "fnd_insp", "inspection", "Foundation & PT inspection — passed", "Engineer letter and city inspection.", "2026-02-26")
event(P, "framing", "schedule", "Framing & sheathing", "Lone Star Framing. Engineered LVL ridge, 22' great-room trusses.", "2026-03-16", "2026-05-08")
event(P, "co03", "change", "CO-03 Add pool equipment pad & conduit for future pool",
      "Owner request. Conduit, gas stub, 6' x 10' equipment pad.", "2026-04-22", status="approved", cost=14850, days=0)
event(P, "frm_insp", "inspection", "Framing inspection — failed, 3 corrections",
      "Missing hold-downs at studio shear wall; fire blocking at stair; nailing pattern at garage portal.", "2026-05-14", status="closed", days=2)
event(P, "frm_reinsp", "inspection", "Framing re-inspection — passed", "All corrections verified.", "2026-05-18")
event(P, "roof", "schedule", "Standing-seam metal roof", "Colorado River Roofing. 24 ga Galvalume, matte black.", "2026-05-26", "2026-06-12")
event(P, "draw4", "payment", "Lender draw #4 funded", "Hill Country Bank draw $212,400 after inspection.", "2026-06-19", status="complete")
event(P, "co05", "change", "CO-05 Upgrade windows to triple-pane (west & south elevations)",
      "Owners chose after energy model review. 14 units.", "2026-06-24", status="approved", cost=22600, days=0)
event(P, "sel_tile", "selection", "Selection overdue — primary bath & kitchen tile",
      "Needed for tile order; 5-week lead on imported zellige. Was due 8/15.", "2026-08-15", status="open", days=6)
event(P, "mep_insp", "inspection", "MEP rough-in inspections — passed", "Electrical, plumbing, mechanical and gas rough.", "2026-08-06")
event(P, "insul", "schedule", "Spray-foam insulation & energy inspection", "Open-cell roofline, closed-cell rim joists.", "2026-08-17", "2026-08-21")
event(P, "drywall", "schedule", "Drywall hang, tape & texture (Level 5 at great room)", "", "2026-08-31", "2026-09-25")
event(P, "appliance", "procurement", "Appliance package lead time extended — range 14 weeks",
      "48\" dual-fuel range backordered. Delivery now ~Dec 4. Kitchen can be completed without it; affects final inspection only if gas cap not accepted.",
      "2026-09-09", status="open", days=0)
event(P, "co07", "change", "CO-07 Scullery pantry cabinetry & quartz",
      "Owner added scullery with sink and full-height cabinets.", "2026-09-17", status="pending", cost=31750, days=5)
event(P, "draw6", "payment", "Lender draw #6 requested", "$188,950 — drywall and cabinets on site. Inspection 10/12.", "2026-10-06", status="pending")
event(P, "cabinets", "schedule", "Cabinet & millwork install", "Barton Creek Cabinetry.", "2026-10-12", "2026-10-30", status="planned")
event(P, "c_tile", "commitment", "Owners to finalize tile selections at showroom",
      "Priya confirmed Saturday showroom appointment.", "2026-10-10", status="open")
event(P, "final", "inspection", "Final building inspection", "", "2026-12-08", status="planned", precision="week", conf=0.65)
event(P, "move_in", "milestone", "Owner move-in target", "Mueller family lease ends 12/31.", "2026-12-18", status="planned")
event(P, "forecast", "forecast", "Completion forecast — Jan 8, 2027 if tile slips past Oct 17",
      "Tile + scullery CO add 11 working days combined.", "2027-01-08", status="open", precision="week", conf=0.6)

evidence(P, "contract", "contract", "Construction Agreement — Cost Plus with GMP", "docusign", "2026-01-28",
         """Owner: Daniel & Priya Mueller. Contractor: Live Oak Builders. GMP $1,850,000 inclusive of 10% fee and $95,000 owner allowances (tile $28k, plumbing fixtures $22k, lighting $18k, appliances $27k). Selections due per schedule Exhibit C; late selections extend time day-for-day.""",
         meta={"gmp": 1850000}, links=[("baseline", "supports")])
evidence(P, "frm_insp", "inspection_report", "Framing Inspection — Correction Notice", "upload", "2026-05-14",
         """City of Austin Residential Inspections. Result: FAIL. 1) Install HDU8 hold-downs at studio shear wall SW-3 per S-2. 2) Fire blocking at stair stringer. 3) Garage portal frame nailing 3" o.c. edges per detail 7/S-3. Inspector: C. Dunn.""",
         meta={"inspector": "Carla Dunn", "result": "fail"}, links=[("frm_insp", "supports")])
evidence(P, "tile_text", "text_message", "Text thread — tile selections", "sms", "2026-08-28",
         """Kevin Duong: Hi Priya — checking on the bath and kitchen tile. We need to place the order by next Friday to hold the install window.
Priya Mueller: So sorry! Still torn between the zellige and the handmade porcelain. Can we see both in person?
Kevin Duong: Absolutely. Showroom has both on display. Note the zellige is a 5-week lead.""",
         meta={"participants": ["Kevin Duong", "Priya Mueller"]}, links=[("sel_tile", "supports")], t="18:22")
evidence(P, "appliance_email", "email", "Appliance order update — range backorder", "gmail", "2026-09-09",
         """From: Austin Appliance Gallery  To: Rachel Ortiz  Subject: Order #44712 status
The 48" dual-fuel range is on manufacturer backorder. New estimated ship date 11/27, delivery approx. 12/4. All other items (refrigeration columns, dishwasher, hood insert, wall oven) available for delivery the week of 10/26.""",
         meta={"vendor": "Austin Appliance Gallery", "order": "44712"}, links=[("appliance", "supports")])
evidence(P, "co07", "change_order", "CO-07 Scullery Pantry — Proposal", "upload", "2026-09-17",
         """Scope: frame & drywall 8'x9' scullery, 24" undermount sink w/ faucet (allowance), 14 LF base + 14 LF full-height painted maple cabinets, 3cm quartz, outlet & lighting. Barton Creek Cabinetry $19,800; quartz $5,200; plumbing $2,350; electrical $1,510; fee $2,890. Total $31,750. Time: 5 working days.""",
         meta={"amount": 31750, "awaiting": "owner signature"}, links=[("co07", "supports")])
evidence(P, "draw6", "invoice", "Hill Country Bank — Draw Request #6", "upload", "2026-10-06",
         """Draw #6. Line items: drywall complete $64,200; interior trim 40% $18,300; cabinets stored on site $71,450; plumbing top-out $12,800; fee $22,200. Total $188,950. Loan balance after draw: $1,206,340 of $1,480,000 commitment.""",
         meta={"amount": 188950, "lender": "Hill Country Bank"}, links=[("draw6", "supports")])
evidence(P, "weekly", "email", "Weekly owner update — week of Oct 5", "gmail", "2026-10-09",
         """Hi Dan & Priya — This week: drywall punch complete, primer on, trim carpenters started upstairs. Next week: cabinets arrive Monday, draw #6 inspection Tuesday. Decisions needed: (1) tile by 10/17 to hold Dec move-in, (2) CO-07 scullery signature. Photos attached. — Rachel""",
         meta={"from": "rortiz@liveoakbuilders.example", "photos": 18}, links=[("c_tile", "supports"), ("co07", "references")], t="16:45")

rel(P, "sel_tile", "contributes_to", "forecast", 0.8)
rel(P, "co07", "contributes_to", "forecast", 0.7)
rel(P, "frm_insp", "causes", "frm_reinsp", 1.0)

# ===========================================================================
# PROJECT 3 — Fieldwork Coffee TI (closeout)
# ===========================================================================
P = "coffee"
event(P, "baseline", "baseline", "TI schedule approved",
      "2,850 SF café + roastery. Demo of former retail shell; new grease interceptor, roaster exhaust, ADA restrooms.",
      "2026-05-04", "2026-09-25", status="approved", cost=0, days=0)
event(P, "demo", "schedule", "Demolition & sawcut for underground plumbing", "", "2026-05-04", "2026-05-22")
event(P, "interceptor", "field", "Unforeseen condition — abandoned grease line under slab",
      "Found during sawcut; required removal and capping per Austin Water.", "2026-05-19", status="complete", cost=6800, days=2)
event(P, "co02", "change", "CO-02 Upsize roaster exhaust & afterburner support",
      "Roaster model changed from 12 kg to 25 kg; exhaust upsized to 10\", added roof curb and dunnage.",
      "2026-06-10", status="approved", cost=27400, days=6)
event(P, "landlord", "decision", "Landlord approves new roof penetration",
      "SoCo Retail Partners approval with requirement to use their roofer for warranty.", "2026-06-18", status="approved")
event(P, "rough", "inspection", "MEP rough-in inspections — passed", "", "2026-07-21")
event(P, "finishes", "schedule", "Finishes, millwork bar, equipment set", "", "2026-08-03", "2026-09-11")
event(P, "health", "inspection", "Health department pre-opening inspection — passed", "Austin Public Health permit issued.", "2026-09-22")
event(P, "co_issued", "milestone", "Certificate of Occupancy issued", "", "2026-09-29")
event(P, "opening", "milestone", "Café soft opening", "Opened to public Oct 3.", "2026-10-03")
event(P, "punch", "closeout", "Punch list — 23 of 31 items complete",
      "Open: bar top seam, 2 ceiling tiles, restroom door closer, roaster room FRP trim, exterior signage lighting timer, 3 paint touch-ups.",
      "2026-10-06", status="open")
event(P, "retainage", "payment", "Retainage release request — $32,000",
      "Pending punch completion, O&M manuals and lien waivers from 6 subs.", "2026-10-08", status="pending")
event(P, "c_waivers", "commitment", "Collect final unconditional lien waivers", "4 of 6 received; missing Southwest Drywall, Hill Country Mechanical.",
      "2026-10-15", status="open")
event(P, "balancing", "commissioning", "Roaster afterburner start-up & air balance report", "Hill Country Mechanical TAB report.", "2026-09-18")

evidence(P, "unforeseen", "field", "Field note — abandoned grease line", "field_app", "2026-05-19",
         """Sawcut revealed 4" cast iron grease line under former retail slab, not on as-builts. Austin Water inspector requires removal to the main and cap. Est. 2 days, ~$6,800 T&M. Photos 1–6.""",
         meta={"author": "Alicia Barnes"}, links=[("interceptor", "supports")])
evidence(P, "co02", "change_order", "CO-02 Roaster Exhaust Upsize — Executed", "docusign", "2026-06-10",
         """Owner changed roaster from 12 kg to 25 kg (Loring-type, afterburner). Exhaust duct 10" double-wall, new roof curb, structural dunnage per Brazos letter. $27,400. +6 working days. Signed M. Avila 6/10.""",
         meta={"amount": 27400}, links=[("co02", "supports")])
evidence(P, "landlord_email", "email", "RE: Roof penetration approval", "gmail", "2026-06-18",
         """From: Tyler Brooks (SoCo Retail Partners)  Approved as submitted, provided the curb and flashing are installed by our roofer of record to preserve the roof warranty. Please send a COI naming SoCo Retail Partners LP as additional insured before work.""",
         meta={"from": "tbrooks@socoretail.example"}, links=[("landlord", "supports")])
evidence(P, "health_permit", "permit", "Austin Public Health — Food Enterprise Permit", "upload", "2026-09-22",
         """Permit issued to Fieldwork Coffee Roasters LLC, 1612 S Congress Ave Ste 140. Pre-opening inspection: approved, no violations.""",
         meta={"issuer": "Austin Public Health"}, links=[("health", "supports")])
evidence(P, "punch", "punch_list", "Punch List Rev 2", "field_app", "2026-10-06",
         """31 items total, 23 closed. Open: (1) bar top quartz seam re-polish, (2) replace 2 stained ceiling tiles at roaster room, (3) adjust restroom 2 door closer, (4) FRP corner trim roaster room, (5) signage lighting timer program, (6–8) paint touch-ups at entry, bar, hallway.""",
         meta={"open": 8, "closed": 23}, links=[("punch", "supports")])
evidence(P, "retainage", "invoice", "Final Pay Application & Retainage Release", "upload", "2026-10-08",
         """Contract $640,000 + CO $34,200 = $674,200. Paid to date $642,200. Retainage held $32,000. Release conditions: punch complete, O&M binders, warranties, final unconditional waivers.""",
         meta={"amount": 32000}, links=[("retainage", "supports"), ("c_waivers", "supports")])

rel(P, "co02", "requires", "landlord", 1.0)
rel(P, "punch", "blocks", "retainage", 1.0)
rel(P, "c_waivers", "blocks", "retainage", 1.0)

# ===========================================================================
# PROJECT 4 — Northbrook Elementary (public, CMAR, procurement)
# ===========================================================================
P = "school"
event(P, "baseline", "baseline", "CMAR preconstruction & summer 2027 work window",
      "Replace 68,000 SF roof (modified bitumen → TPO over tapered ISO) and 14 RTUs. Occupied campus; roof work weekends/spring break, RTU swap June–July 2027.",
      "2026-09-14", "2027-08-06", status="approved", cost=0, days=0)
event(P, "board", "decision", "Board approves CMAR contract — Live Oak Builders",
      "Agenda item 9.4. Preconstruction fee $38,000; GMP to follow.", "2026-08-20", status="approved")
event(P, "survey", "field", "Asbestos survey — roof mastic contains ACM (3% chrysotile)",
      "Base flashing mastic at 6 RTU curbs and parapets. Requires licensed abatement before tear-off.",
      "2026-09-24", status="complete", cost=86500, days=10)
event(P, "rtu_lead", "procurement", "RTU long-lead order — 38-week lead time",
      "14 units, DOAS on 3. Must release by Oct 30 to receive by June 1, 2027.", "2026-09-29", status="open", days=0)
event(P, "prebid", "meeting", "Pre-bid conference — roofing & HVAC packages",
      "18 attendees, 7 certified HUB firms.", "2026-10-06", t="14:00")
event(P, "bids_due", "procurement", "Trade bids due — Bid Packages 1 (Roofing) & 2 (HVAC)", "", "2026-10-20", status="scheduled", t="14:00")
event(P, "gmp", "decision", "GMP presented to Board for approval", "Target GMP $3.25M incl. abatement allowance.", "2026-11-19", status="planned")
event(P, "c_rtu", "commitment", "District to authorize early RTU release ahead of GMP",
      "Requested at OAC; requires superintendent sign-off under early-release clause.", "2026-10-23", status="open")
event(P, "springbreak", "schedule", "Phase 1 roofing — spring break (wings A & B)", "", "2027-03-13", "2027-03-21", status="planned")
event(P, "summer", "schedule", "Phase 2 — RTU replacement & remaining roof", "Campus unoccupied.", "2027-06-01", "2027-08-06", status="planned")
event(P, "hub", "compliance", "HUB participation plan — 22% committed (goal 20%)", "", "2026-10-07", status="under_review")

evidence(P, "rfp", "contract", "Project Manual — Division 00 & 01 excerpts", "upload", "2026-07-15",
         """00 73 46 Wage Determination: Travis County prevailing wage rates apply (Tex. Gov't Code 2258).
00 73 43 Certified Payroll: weekly submittal within 7 days of pay date.
00 61 13 Bonds: payment and performance bonds at 100% of GMP.
00 45 39 HUB Subcontracting Plan: district goal 20%; good-faith effort documentation required.
01 35 00 Occupied Campus Requirements: no roofing odors during instructional hours; background checks for all on-site personnel.""",
         meta={"sections": ["00 73 46", "00 73 43", "00 61 13", "00 45 39", "01 35 00"]}, links=[("baseline", "supports")])
evidence(P, "survey", "report", "Limited Asbestos Survey — Roofing Materials", "upload", "2026-09-24",
         """Samples: 18. Positive: black base flashing mastic (3% chrysotile) at RTU curbs 1–6 and north/east parapets, approx. 1,450 SF. Field membrane and insulation: non-detect. Recommendation: abate by licensed contractor under TDSHS notification (10 working days) prior to roof demolition.""",
         meta={"lab": "accredited third-party", "positive_samples": 5}, links=[("survey", "supports")])
evidence(P, "rtu_quote", "quote", "RTU Equipment Quote — 14 units", "upload", "2026-09-29",
         """14 packaged RTUs (3 with DOAS energy recovery). Equipment $612,400 delivered. Lead time 36–38 weeks from approved submittals and release. Quote valid through 10/31/26. Price escalation 4.5% if released after 11/1.""",
         meta={"amount": 612400}, links=[("rtu_lead", "supports"), ("c_rtu", "supports")])
evidence(P, "prebid", "meeting_note", "Pre-bid Conference Sign-in & Notes", "upload", "2026-10-06",
         """18 attendees from 13 firms; 7 certified HUB. Questions: (1) roof access hours — 4 PM–6 AM weekdays and weekends; (2) crane staging — south bus loop on weekends only; (3) abatement — separate prime under CMAR, not in roofing scope. Addendum 1 to follow by 10/9.""",
         meta={"attendees": 18}, links=[("prebid", "supports")], t="16:00")
evidence(P, "hub", "compliance", "HUB Subcontracting Plan — Draft", "upload", "2026-10-07",
         """Projected HUB participation: abatement (HUB) $86,500; sheet metal (HUB) $142,000; electrical (HUB) $94,000; crane & rigging (HUB) $38,000 → $360,500 / $1.64M subcontracted scope = 22.0%. Pending district review.""",
         meta={"percent": 22.0}, links=[("hub", "supports")])

rel(P, "survey", "precedes", "springbreak", 0.9)
rel(P, "rtu_lead", "requires", "c_rtu", 1.0)
rel(P, "rtu_lead", "drives", "summer", 0.95)

# ---------------------------------------------------------------------------
# Vendors (org-wide), templates, assignments, invites, responses, documents
# ---------------------------------------------------------------------------
TEMPLATES = {
    "standard": ("Commercial Subcontractor Onboarding", "W-9, COI, workers' comp, license and payment enrollment.", True, None),
    "public": ("Public Works Subcontractor Onboarding", "Adds prevailing wage, certified payroll, bonding and HUB certification.", False, "school"),
}
TPL = {k: uid("template", k) for k in TEMPLATES}
for k, (name, desc, default, proj) in TEMPLATES.items():
    add("vendor_requirement_templates", id=TPL[k], organization_id=ORG, name=name, description=desc,
        is_default=default, created_by=OWNER, project_id=PRJ[proj] if proj else None)

BASE_REQS = [
    ("legal_name", "Legal business name", "text", None, False),
    ("ein", "EIN / Tax ID", "text", None, False),
    ("tax_classification", "Tax classification", "select", None, False),
    ("contact_name", "Primary contact", "text", None, False),
    ("contact_email", "Contact email", "email", None, False),
    ("contact_phone", "Contact phone", "phone", None, False),
    ("w9", "W-9 / tax information", "document", "w9", False),
    ("insurance", "Certificate of Insurance", "document", "coi", True),
    ("workers_comp", "Workers' compensation", "document", "workers_comp", True),
    ("license", "Trade / contractor license", "document", "license", True),
    ("payment_enrollment", "Payment enrollment", "payment_enrollment", None, False),
]
PUBLIC_REQS = [
    ("prevailing_wage", "Prevailing wage acknowledgment", "yes_no", None, False),
    ("certified_payroll", "Certified payroll", "document", "certified_payroll", False),
    ("bonding", "Bonding documentation", "document", "bond", True),
    ("dbe_wbe", "DBE / WBE / HUB information", "document", "hub_certificate", True),
]
REQ_ID = {}
for tk in TPL:
    lst = BASE_REQS + (PUBLIC_REQS if tk == "public" else [])
    for i, (key, label, rtype, dtype, expires) in enumerate(lst):
        rid = uid("vreq", tk, key)
        REQ_ID[(tk, key)] = rid
        add("vendor_requirements", id=rid, template_id=TPL[tk], label=label, field_key=key, requirement_type=rtype,
            help_text=None, is_required=True, sort_order=i + 1,
            options=["LLC", "S Corporation", "C Corporation", "Partnership", "Sole proprietor"] if rtype == "select" else None,
            document_type=dtype, expires=expires, source="system" if key in dict((b[0], 1) for b in BASE_REQS) else "project")

# vendor: key -> (company, legal, dba, type, ein, classification, contact person, address, city, zip, pay method, pay status, compliance, notes)
VENDORS = {
    "capsteel": ("capsteel", "Capital Steel Fabricators, LLC", None, "subcontractor", "74-3102958", "LLC", "garza", "8800 Tuscany Way", "Austin", "78754", "ach", "verified", "approved", None),
    "lonestar": ("lonestar", "Lone Star Framing Co.", None, "subcontractor", "82-1147730", "S Corporation", "beckett", "1405 FM 1626", "Manchaca", "78652", "ach", "complete", "needs_attention", "General liability COI expired 9/30 — renewal requested."),
    "bluebonnet": ("bluebonnet", "Bluebonnet Electric, Inc.", None, "subcontractor", "74-2891045", "C Corporation", "nguyen", "2101 Kramer Ln", "Austin", "78758", "virtual_card", "verified", "approved", None),
    "hcmech": ("hcmech", "Hill Country Mechanical, LLC", None, "subcontractor", "46-5520318", "LLC", "walker", "312 Industrial Blvd", "Kyle", "78640", "ach", "verified", "approved", None),
    "travisplumb": ("travisplumb", "Travis Plumbing Services, LLC", None, "subcontractor", "47-0918844", "LLC", "morales", "6304 E Ben White Blvd", "Austin", "78741", "check", "complete", "submitted", "W-9 and COI received; license under review."),
    "balcones": ("balcones", "Balcones Glass & Glazing, LP", "Balcones Glass", "subcontractor", "20-4471196", "Partnership", "fisher", "11200 Metric Blvd", "Austin", "78758", "ach", "requested", "in_progress", None),
    "cpconcrete": ("cpconcrete", "Cedar Park Concrete Contractors, Inc.", "Cedar Park Concrete", "subcontractor", "74-2650073", "S Corporation", None, "1901 Brushy Creek Rd", "Cedar Park", "78613", "ach", "verified", "approved", None),
    "crroof": ("crroof", "Colorado River Roofing, LLC", None, "subcontractor", "83-2209914", "LLC", None, "500 Old Hwy 20", "Bastrop", "78602", "ach", "requested", "invited", "Invited for Northbrook roofing package."),
    "swdrywall": ("swdrywall", "Southwest Drywall & Acoustics, LLC", None, "subcontractor", "45-3318720", "LLC", None, "4410 S Congress Ave", "Austin", "78745", "check", "complete", "expired", "Workers' comp certificate expired 8/31."),
    "bcabinet": ("bcabinet", "Barton Creek Cabinetry, LLC", None, "subcontractor", "81-4093327", "LLC", "hale", "720 Barton Springs Rd", "Austin", "78704", "ach", "verified", "approved", None),
    "abatement": ("abatement", "Centex Environmental Abatement, Inc.", None, "subcontractor", "26-1188420", "C Corporation", "quinn", "1100 Commerce St", "Round Rock", "78664", "not_set", "not_started", "invited", "Certified HUB; TDSHS asbestos abatement contractor license."),
    "hayslumber": ("hayslumber", "Hays County Lumber Supply, Inc.", None, "supplier", "74-1920556", "C Corporation", None, "2450 S Old Stagecoach Rd", "Kyle", "78640", "ach", "verified", "approved", None),
}
VID = {k: uid("vendor", k) for k in VENDORS}
for k, (co, legal, dba, vtype, ein, cls, cp, addr, city, zip_, pm, pstat, comp, notes) in VENDORS.items():
    person = PEOPLE.get(cp) if cp else None
    add("vendor_profiles", id=VID[k], organization_id=ORG, company_id=CID[co], legal_name=legal, dba_name=dba,
        vendor_type=vtype, ein=ein, tax_classification=cls,
        contact_name=f"{person[0]} {person[1]}" if person else None,
        contact_email=person[4] if person else f"office@{co}.example",
        contact_phone=person[5] if person else None,
        remit_address=addr, remit_city=city, remit_state="TX", remit_postal_code=zip_,
        payment_method=pm if pm != "not_set" else None, payment_enrollment_status=pstat,
        payment_reference=f"ACH ••••{ein[-4:]}" if pm == "ach" and pstat in ("complete", "verified") else None,
        compliance_status=comp, notes=notes, created_by=OWNER)

# assignment: (project, vendor, trade, scope, value, status, invited, approved, template, invite status, due)
ASSIGN = [
    ("mob", "capsteel", "Structural steel", "Furnish & erect structural steel, joists, deck, misc. metals", 1468000, "active", "2026-01-20", "2026-02-06", "standard", "approved", "2026-02-06"),
    ("mob", "lonestar", "Metal stud framing", "Interior & exterior metal stud framing, sheathing, blocking", 842500, "blocked", "2026-02-02", "2026-02-20", "standard", "submitted", "2026-10-10"),
    ("mob", "bluebonnet", "Electrical", "Electrical, fire alarm, low voltage rough-in", 1925000, "active", "2026-01-20", "2026-02-09", "standard", "approved", "2026-02-09"),
    ("mob", "hcmech", "HVAC", "HVAC, controls, medical air & vacuum", 2110000, "active", "2026-01-22", "2026-02-12", "standard", "approved", "2026-02-12"),
    ("mob", "travisplumb", "Plumbing", "Domestic water, sanitary, storm, med-gas piping", 968400, "onboarding", "2026-02-02", None, "standard", "submitted", "2026-10-15"),
    ("mob", "balcones", "Curtain wall & glazing", "Unitized curtain wall, storefront, interior glazing", 1342000, "onboarding", "2026-03-30", None, "standard", "in_progress", "2026-10-16"),
    ("mob", "cpconcrete", "Concrete", "Piers, grade beams, SOG, elevated deck topping", 1086000, "active", "2026-01-15", "2026-02-02", "standard", "approved", "2026-02-02"),
    ("mueller", "lonestar", "Wood framing", "Framing, sheathing, windows & exterior doors install", 168400, "approved", "2026-02-05", "2026-02-14", "standard", "approved", "2026-02-14"),
    ("mueller", "bluebonnet", "Electrical", "Electrical, low voltage, lighting install", 92600, "active", "2026-02-05", "2026-02-18", "standard", "approved", "2026-02-18"),
    ("mueller", "travisplumb", "Plumbing", "Plumbing, gas, fixture set", 78900, "active", "2026-02-05", "2026-02-20", "standard", "submitted", "2026-02-20"),
    ("mueller", "bcabinet", "Cabinetry", "Kitchen, baths, mudroom & studio cabinetry, built-ins", 124300, "active", "2026-04-10", "2026-04-24", "standard", "approved", "2026-04-24"),
    ("mueller", "crroof", "Roofing", "Standing-seam metal roof & gutters", 58700, "approved", "2026-04-01", "2026-04-15", "standard", "approved", "2026-04-15"),
    ("mueller", "hayslumber", "Lumber package", "Framing lumber, LVLs, trusses", 141200, "approved", "2026-02-01", "2026-02-10", "standard", "approved", "2026-02-10"),
    ("coffee", "hcmech", "HVAC & exhaust", "RTU, roaster exhaust & afterburner, TAB", 118600, "active", "2026-04-15", "2026-04-28", "standard", "approved", "2026-04-28"),
    ("coffee", "travisplumb", "Plumbing", "Grease interceptor, floor sinks, fixtures", 74200, "active", "2026-04-15", "2026-04-30", "standard", "submitted", "2026-04-30"),
    ("coffee", "swdrywall", "Drywall & ceilings", "Drywall, FRP, ACT ceilings", 61800, "inactive", "2026-04-15", "2026-04-29", "standard", "expired", "2026-04-29"),
    ("coffee", "bluebonnet", "Electrical", "Power, lighting, roaster 3-phase feed", 82400, "active", "2026-04-15", "2026-04-27", "standard", "approved", "2026-04-27"),
    ("school", "crroof", "Roofing", "Bid Package 1 — tear-off, tapered ISO, 60 mil TPO", None, "invited", "2026-10-01", None, "public", "opened", "2026-10-20"),
    ("school", "hcmech", "HVAC", "Bid Package 2 — 14 RTUs, curbs, controls", None, "prospective", "2026-10-01", None, "public", "sent", "2026-10-20"),
    ("school", "abatement", "Abatement", "Roof mastic ACM abatement at RTU curbs & parapets", 86500, "onboarding", "2026-09-30", None, "public", "in_progress", "2026-10-14"),
]
INV = {}
for pk, vk, trade, scope, val, status, invited, approved, tk, istat, due in ASSIGN:
    add("vendor_project_assignments", id=uid("assign", pk, vk), project_id=PRJ[pk], vendor_id=VID[vk], trade=trade,
        scope=scope, contract_value=val, status=status, invited_at=ts(invited), approved_at=ts(approved, "15:00") if approved else None)
    iid = uid("invite", pk, vk)
    INV[(pk, vk)] = (iid, tk, istat)
    v = VENDORS[vk]
    email = PEOPLE[v[6]][4] if v[6] else f"office@{vk}.example"
    sent = ts(invited, "08:30")
    opened = ts(invited, "13:10") if istat not in ("draft", "sent") else None
    submitted = ts(approved or due, "11:00") if istat in ("submitted", "approved", "expired") else None
    add("vendor_invites", id=iid, project_id=PRJ[pk], vendor_id=VID[vk], template_id=TPL[tk], invited_email=email,
        invited_by=OWNER, status=istat, sent_at=sent, opened_at=opened, submitted_at=submitted, due_date=due)

# Responses for submitted/approved/in-progress invites
for (pk, vk), (iid, tk, istat) in INV.items():
    if istat in ("sent", "opened", "draft"):
        continue
    v = VENDORS[vk]
    person = PEOPLE.get(v[6]) if v[6] else None
    answers = {
        "legal_name": v[1], "ein": v[4], "tax_classification": v[5],
        "contact_name": f"{person[0]} {person[1]}" if person else "Office Manager",
        "contact_email": person[4] if person else f"office@{vk}.example",
        "contact_phone": person[5] if person else "512-555-0199",
    }
    keys = list(answers) if istat != "in_progress" else ["legal_name", "ein", "contact_name", "contact_email"]
    for key in keys:
        add("vendor_responses", id=uid("resp", pk, vk, key), invite_id=iid, requirement_id=REQ_ID[(tk, key)],
            response_text=answers[key], response_json=None, answered_by=None, answered_at=ts("2026-09-01" if pk == "school" else "2026-02-10", "11:00"),
            is_internal_override=False)
    if istat != "in_progress":
        add("vendor_responses", id=uid("resp", pk, vk, "payment_enrollment"), invite_id=iid,
            requirement_id=REQ_ID[(tk, "payment_enrollment")], response_text=v[10],
            response_json={"method": v[10], "status": v[11]}, answered_by=None,
            answered_at=ts("2026-02-10", "11:05"), is_internal_override=False)
    if tk == "public" and istat == "in_progress":
        add("vendor_responses", id=uid("resp", pk, vk, "prevailing_wage"), invite_id=iid,
            requirement_id=REQ_ID[(tk, "prevailing_wage")], response_text="yes", response_json={"acknowledged": True},
            answered_by=None, answered_at=ts("2026-10-02", "09:20"), is_internal_override=False)

# Compliance documents: (project, vendor, req key, doc type, issue, expiry, status, notes)
DOCS = [
    ("mob", "capsteel", "w9", "w9", "2026-01-22", None, "approved", None),
    ("mob", "capsteel", "insurance", "coi", "2026-01-01", "2027-01-01", "approved", "GL $2M/$4M, auto $1M, umbrella $5M. Owner & architect additional insured."),
    ("mob", "capsteel", "workers_comp", "workers_comp", "2026-03-01", "2027-03-01", "approved", None),
    ("mob", "lonestar", "w9", "w9", "2026-02-04", None, "approved", None),
    ("mob", "lonestar", "insurance", "coi", "2025-09-30", "2026-09-30", "expired", "Expired 9/30. Renewal requested from agent 10/1 — work on site continuing; pay app #8 on hold."),
    ("mob", "lonestar", "workers_comp", "workers_comp", "2026-01-15", "2027-01-15", "approved", None),
    ("mob", "bluebonnet", "w9", "w9", "2026-01-21", None, "approved", None),
    ("mob", "bluebonnet", "insurance", "coi", "2026-04-01", "2027-04-01", "approved", None),
    ("mob", "bluebonnet", "license", "license", "2025-06-30", "2027-06-30", "approved", "TDLR electrical contractor license."),
    ("mob", "hcmech", "w9", "w9", "2026-01-23", None, "approved", None),
    ("mob", "hcmech", "insurance", "coi", "2026-02-01", "2026-10-31", "approved", "Expires 10/31 — renewal reminder due."),
    ("mob", "travisplumb", "w9", "w9", "2026-02-05", None, "approved", None),
    ("mob", "travisplumb", "insurance", "coi", "2026-05-15", "2027-05-15", "submitted", None),
    ("mob", "travisplumb", "license", "license", "2026-02-05", "2027-02-05", "submitted", "Med-gas installer certification (ASSE 6010) needed in addition to master plumber license."),
    ("mob", "balcones", "w9", "w9", "2026-04-02", None, "approved", None),
    ("mob", "balcones", "insurance", "coi", "2026-09-28", "2027-09-28", "rejected", "Missing waiver of subrogation endorsement; owner not named additional insured."),
    ("coffee", "swdrywall", "workers_comp", "workers_comp", "2025-08-31", "2026-08-31", "expired", None),
    ("coffee", "swdrywall", "w9", "w9", "2026-04-20", None, "approved", None),
    ("school", "abatement", "dbe_wbe", "hub_certificate", "2025-03-01", "2029-03-01", "submitted", "Texas HUB certificate."),
    ("school", "abatement", "license", "license", "2026-01-10", "2027-01-10", "submitted", "TDSHS asbestos abatement contractor license."),
]
for pk, vk, key, dtype, issued, exp, stat, notes in DOCS:
    iid, tk, _ = INV[(pk, vk)]
    fname = f"{vk}_{dtype}_{issued[:4]}.pdf"
    add("vendor_documents", id=uid("vdoc", pk, vk, key), invite_id=iid, requirement_id=REQ_ID[(tk, key)], document_type=dtype,
        file_name=fname, storage_path=f"sample/{PRJ[pk]}/vendors/{vk}/{fname}", issue_date=issued, expiration_date=exp,
        status=stat, reviewed_by=OWNER if stat in ("approved", "rejected", "expired") else None,
        reviewed_at=ts(issued, "16:00") if stat in ("approved", "rejected") else None, notes=notes)

# ---------------------------------------------------------------------------
# AI ingestion queue — jobs waiting for review with extracted candidates
# ---------------------------------------------------------------------------
JOBS = [
    ("mob", "oac15", "OAC_Meeting_15_DRAFT.pdf", "2026-10-09",
     "OAC #15 (draft). CO-017 alternate: keep switchgear in room 104, extend feeders 240 LF — Bluebonnet pricing $131,900, 6 days. Owner leaning toward alternate. Curtain wall resubmittal received 10/8, Halvorsen reviewing. Lone Star COI still outstanding — Grace holding pay app #8. Next OAC 10/16.",
     [("event", "co017_alt", {"title": "CO-017 Alternate — keep switchgear in room 104", "event_type": "change", "date": "2026-10-09", "description": "Feeder extension alternate $131,900, 6 days.", "cost_impact": 131900, "schedule_impact_days": 6}, 0.88),
      ("commitment", "lonestar_coi", {"title": "Lone Star Framing to provide renewed COI", "date": "2026-10-13", "description": "Pay app #8 held until received."}, 0.91),
      ("event", "cw_resub", {"title": "Curtain wall resubmittal received", "event_type": "submittal", "date": "2026-10-08", "description": "Balcones resubmitted 08 44 13-02 Rev 1."}, 0.94),
      ("cost", "payapp8_hold", {"title": "Pay app #8 hold — Lone Star Framing", "amount": 96420, "reason": "Expired COI"}, 0.72),
      ("date", "oac16", {"title": "Next OAC meeting", "date": "2026-10-16"}, 0.97)]),
    ("mob", "inv_balcones", "Balcones_Invoice_2219.pdf", "2026-10-08",
     "Balcones Glass & Glazing. Invoice 2219. Stored materials — curtain wall extrusions (offsite, bonded warehouse). $214,600. Requires bill of sale and insurance certificate for offsite storage.",
     [("cost", "balcones_stored", {"title": "Stored materials — curtain wall extrusions (offsite)", "amount": 214600, "vendor": "Balcones Glass & Glazing"}, 0.9),
      ("requirement", "offsite_storage", {"requirement_key": "offsite_stored_materials", "label": "Offsite stored materials documentation", "description": "Bill of sale + insurance certificate per GC 9.3.2"}, 0.66),
      ("company", "bonded_wh", {"name": "Lonestar Bonded Warehouse"}, 0.58)]),
    ("mueller", "tile_quote", "Tile_Quote_Rev2_Mueller.pdf", "2026-10-07",
     "Austin Tile Gallery quote Rev 2 for Mueller residence. Option A zellige (kitchen + primary bath) $34,180 — 5 week lead. Option B handmade porcelain $26,940 — in stock. Allowance $28,000. Contact: Renata Silva, renata@austintile.example.",
     [("cost", "tile_a", {"title": "Tile Option A — zellige", "amount": 34180, "allowance": 28000, "over_allowance": 6180}, 0.93),
      ("cost", "tile_b", {"title": "Tile Option B — handmade porcelain", "amount": 26940, "allowance": 28000, "over_allowance": -1060}, 0.93),
      ("person", "renata", {"name": "Renata Silva", "email": "renata@austintile.example", "company": "Austin Tile Gallery"}, 0.86),
      ("company", "atg", {"name": "Austin Tile Gallery"}, 0.9)]),
    ("school", "addendum1", "Northbrook_Addendum_01.pdf", "2026-10-09",
     "Addendum 1. Bid date extended to Oct 22 at 2:00 PM. Roofing contractors must carry manufacturer-certified installer status for 20-year NDL warranty. Abatement removed from BP-1 scope.",
     [("event", "bid_ext", {"title": "Bid date extended to Oct 22", "event_type": "procurement", "date": "2026-10-22", "description": "Per Addendum 1.", "schedule_impact_days": 2}, 0.95),
      ("requirement", "ndl", {"requirement_key": "manufacturer_certified_installer", "label": "Manufacturer-certified roofing installer (20-yr NDL)"}, 0.82)]),
]
for pk, key, fname, when, text, cands in JOBS:
    jid = uid("job", pk, key)
    add("ingestion_jobs", id=jid, project_id=PRJ[pk], evidence_id=None, storage_path=f"sample/{PRJ[pk]}/uploads/{fname}",
        file_name=fname, mime_type="application/pdf", status="needs_review", error_message=None, extracted_text=text,
        extracted_metadata={"sample": True, "pages": 3 if "OAC" in fname else 1}, created_by=OWNER, completed_at=ts(when, "11:02"))
    for ctype, ckey, val, conf in cands:
        add("extraction_candidates", id=uid("cand", pk, key, ckey), job_id=jid, project_id=PRJ[pk], candidate_type=ctype,
            candidate_key=ckey, proposed_value=val, confidence=conf, status="pending")

# One completed job (already reviewed) for history
jid = uid("job", "mob", "sched7")
add("ingestion_jobs", id=jid, project_id=PRJ["mob"], evidence_id=EVD[("mob", "sched_update")],
    storage_path=f"sample/{PRJ['mob']}/uploads/RMOB_Schedule_Update_07.pdf", file_name="RMOB_Schedule_Update_07.pdf",
    mime_type="application/pdf", status="complete", error_message=None, extracted_text="Schedule Update #7 narrative…",
    extracted_metadata={"sample": True}, created_by=OWNER, completed_at=ts("2026-10-05", "14:20"))
add("extraction_candidates", id=uid("cand", "mob", "sched7", "fc"), job_id=jid, project_id=PRJ["mob"], candidate_type="event",
    candidate_key="forecast", proposed_value={"title": "Framing now 14 days late", "event_type": "forecast", "date": "2026-10-05"},
    confidence=0.89, status="merged", reviewed_by=OWNER, reviewed_at=ts("2026-10-05", "15:00"))

# ---------------------------------------------------------------------------
# Field captures
# ---------------------------------------------------------------------------
FIELD = [
    ("mob", "photo_l2", "progress", "L2 east wing framing — after rework", "Exam rooms 212–224 re-laid to Rev C. Ready for MEP rough.", None, None, "2026-10-01", "complete", None),
    ("mob", "rain_photo", "photo", "Laydown yard flooded", "Sept 10 — 7:00 AM.", None, None, "2026-09-10", "complete", "weather_email"),
    ("mob", "delivery_studs", "delivery", "Stud & track delivery — L3", "ClarkDietrich 362S162-54, 18 bundles. 2 bundles damaged, noted on BOL.", None, "Hays County Lumber Supply", "2026-10-07", "needs_review", None),
    ("mob", "receipt_pump", "receipt", "Trash pump rental — rain event", "2 pumps, 3 days.", 486.50, "Sunbelt Rentals", "2026-09-11", "complete", None),
    ("mob", "voice_reyes", "voice_note", "Superintendent voice note — Saturday shift", None, None, None, "2026-10-08", "processing", None),
    ("mob", "safety_rail", "safety", "Slab edge cable rail re-tensioned", "Corrective action for NM-004.", None, None, "2026-09-30", "complete", "nearmiss"),
    ("mueller", "photo_drywall", "progress", "Great room Level 5 finish", "Primer on. Raking light check passed.", None, None, "2026-10-05", "complete", None),
    ("mueller", "receipt_hardware", "receipt", "Hardware store run — trim fasteners & shims", None, 212.38, "Home Depot #6533", "2026-10-06", "captured", None),
    ("mueller", "incident_window", "incident", "Cracked triple-pane unit — studio west", "Found during trim; manufacturer claim opened.", None, None, "2026-10-08", "needs_review", None),
    ("coffee", "punch_bar", "photo", "Punch #1 — bar top seam", None, None, None, "2026-10-06", "complete", "punch"),
    ("coffee", "invoice_sign", "invoice", "Signage lighting timer service call", None, 340.00, "Bluebonnet Electric", "2026-10-07", "needs_review", None),
    ("school", "roof_walk", "photo", "Roof walk — RTU-4 curb mastic", "Sample location S-11 (positive).", None, None, "2026-09-22", "complete", "survey"),
]
TRANSCRIPT = ("Tomás here. We got Lone Star confirmed for Saturdays through the twenty-first, eight guys. "
              "Need the north gate opened at six-thirty. Also the L3 stud delivery had two damaged bundles, I noted it on the ticket. "
              "And somebody needs to chase their insurance cert, Grace says pay app's on hold.")
for pk, key, stype, title, notes, amt, vendor, when, pstat, ev_key in FIELD:
    add("field_submissions", id=uid("field", pk, key), project_id=PRJ[pk], submitted_by=OWNER, submission_type=stype,
        title=title, notes=notes, transcript=TRANSCRIPT if key == "voice_reyes" else None,
        media_type="audio/m4a" if stype == "voice_note" else ("application/pdf" if stype in ("invoice",) else "image/jpeg"),
        storage_path=None, amount=amt, vendor_name=vendor, occurred_at=ts(when, "15:30"), processing_status=pstat,
        evidence_id=EVD.get((pk, ev_key)) if ev_key else None, metadata={"sample": True})

# ---------------------------------------------------------------------------
# Emit SQL
# ---------------------------------------------------------------------------
out = [
    "-- BuildPath sample data: Live Oak Builders (Sample)",
    "-- Owner is looked up by email; edit the email on the _seed_owner line to change it.",
    f"-- Remove everything with: delete from public.organizations where id = '{ORG}';",
    "begin;",
    f"create temp table _seed_owner on commit drop as select id from auth.users where email = '{OWNER_EMAIL}';",
    "do $$ begin if (select count(*) from _seed_owner) <> 1 then raise exception 'Owner email not found in auth.users'; end if; end $$;",
    f"delete from public.organizations where id = '{ORG}';",
]
for table in order:
    cols = []
    for r in rows[table]:
        cols += [c for c in r if c not in cols]
    for r in rows[table]:
        for c in cols:
            r.setdefault(c, None)
    values = ",\n".join("(" + ", ".join(lit(r[c]) for c in cols) + ")" for r in rows[table])
    out.append(f"insert into public.{table} ({', '.join(cols)}) values\n{values};")
out.append("commit;")
print("\n\n".join(out))

counts = {t: len(rows[t]) for t in order}
print(json.dumps({"org_id": ORG, "counts": counts}), file=sys.stderr)

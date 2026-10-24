import type { ChangeRequest, Evidence, Person, ProductData, ProductKey, Project } from "./core/types";

// Demo data. Dates are relative to today so the demo always looks current.

const DAY = 86400000;
function d(offset: number, time = "09:00") {
  const base = new Date();
  const day = new Date(Date.UTC(base.getFullYear(), base.getMonth(), base.getDate()) + offset * DAY).toISOString().slice(0, 10);
  return `${day}T${time}:00`;
}
const day = (offset: number) => d(offset).slice(0, 10);

type EvInput = Omit<Evidence, "projectId" | "status" | "dateKind" | "links"> & Partial<Pick<Evidence, "status" | "dateKind" | "links">>;
function ev(projectId: string, list: EvInput[]): Evidence[] {
  return list.map((e) => ({ status: "confirmed", dateKind: "exact", links: [], ...e, projectId }));
}
function hist(...steps: [number, ChangeRequest["status"], string][]) {
  return steps.map(([o, status, by]) => ({ at: d(o, "15:00"), status, by }));
}

/* ───────────────────────── RestorePath ───────────────────────── */

function restoreSeed(): ProductData {
  const P = "loss_henderson";
  const project: Project = {
    id: P, product: "restore", name: "Henderson water loss", subtitle: "Cat 1 water · Class 2 · supply line burst under kitchen sink",
    address: "4127 Larkspur Dr, Plano TX", status: "Drying", startDate: day(-6),
    ext: {
      carrier: "Summit Mutual", claimNumber: "SM-24-0098812", lossType: "Water", dateOfLoss: day(-7),
      rooms: [{ id: "rm_kitchen", name: "Kitchen" }, { id: "rm_hall", name: "Hallway" }, { id: "rm_bath", name: "Half bath" }],
      points: [
        { id: "pt1", roomId: "rm_kitchen", label: "P1", material: "Subfloor (OSB)", goal: 15 },
        { id: "pt2", roomId: "rm_kitchen", label: "P2", material: "Drywall, sink wall", goal: 12 },
        { id: "pt3", roomId: "rm_kitchen", label: "P3", material: "Cabinet base", goal: 15 },
        { id: "pt4", roomId: "rm_hall", label: "P4", material: "Drywall, hall", goal: 12 },
        { id: "pt5", roomId: "rm_bath", label: "P5", material: "Drywall behind vanity", goal: 12 },
      ],
      equipment: [
        { id: "eq1", type: "Dehumidifier", tag: "DH-07", roomId: "rm_kitchen", placedAt: d(-6, "11:00"), removedAt: null },
        { id: "eq2", type: "Air mover", tag: "AM-12", roomId: "rm_kitchen", placedAt: d(-6, "11:00"), removedAt: null },
        { id: "eq3", type: "Air mover", tag: "AM-13", roomId: "rm_hall", placedAt: d(-6, "11:15"), removedAt: d(-1, "10:00") },
        { id: "eq4", type: "Air mover", tag: "AM-14", roomId: "rm_hall", placedAt: d(-6, "11:15"), removedAt: d(-1, "10:00") },
        { id: "eq5", type: "Air scrubber", tag: "AS-02", roomId: "rm_bath", placedAt: d(-2, "13:00"), removedAt: null },
      ],
    },
  };
  const people: Person[] = [
    { id: "p_rosa", projectId: null, name: "Rosa Delgado", role: "owner", org: "Delgado Restoration" },
    { id: "p_jamal", projectId: null, name: "Jamal Reed", role: "tech", org: "Delgado Restoration" },
    { id: "p_dana", projectId: P, name: "Dana Whitfield", role: "adjuster", org: "Summit Mutual", email: "dana.w@example.com", sharing: { level: "everything" } },
    { id: "p_greg", projectId: P, name: "Greg Henderson", role: "homeowner", phone: "(555) 010-4471", sharing: { level: "basics" } },
    { id: "p_luis", projectId: P, name: "Luis Parra", role: "sub", org: "Precision Drywall", sharing: { level: "standard" } },
  ];
  // Readings: day offset → [P1..P5]. P2 is missing on day -3 (a documentation gap the app should catch).
  const series: Record<number, (number | null)[]> = {
    [-6]: [38, 29, 36, 24, null],
    [-5]: [33, 24, 32, 18, null],
    [-4]: [27, 19, 29, 13, null],
    [-3]: [22, null, 26, 11, null],
    [-2]: [18, 13, 24, 10, 22],
    [-1]: [16, 12, 21, 10, 17],
    [0]: [14, 11, 19, 10, 14],
  };
  const pts = project.ext.points as { id: string; label: string; roomId: string }[];
  const readings: EvInput[] = Object.entries(series).flatMap(([o, vals]) =>
    vals.flatMap((v, i) => v == null ? [] : [{
      id: `rd_${pts[i].label}_${o}`, kind: "reading" as const, lane: "drying", category: "drying",
      title: `${pts[i].label} ${v}`, at: d(Number(o), "08:30"), source: "instrument" as const, authorId: "p_jamal",
      links: [pts[i].id, pts[i].roomId], data: { pointId: pts[i].id, value: v },
    }]));
  const evidence = ev(P, [
    { id: "e_r1", kind: "call", lane: "carrier", category: "carrier", title: "First notice: Summit Mutual assigned Dana Whitfield", body: "Claim SM-24-0098812 opened. Dana OK'd emergency mitigation, asked for daily readings and photos by email.", at: d(-6, "08:05"), source: "call_note", authorId: "p_rosa", links: ["p_dana"] },
    { id: "e_r2", kind: "document", lane: "homeowner", category: "homeowner", title: "Work authorization signed by homeowner", body: "Work authorization and direction to pay, signed on site.", at: d(-6, "10:20"), source: "signed_document", authorId: "p_jamal", links: ["p_greg"] },
    { id: "e_r3", kind: "photo", lane: "mitigation", category: "photos", title: "Standing water at kitchen sink base", at: d(-6, "10:05"), source: "photo_metadata", authorId: "p_jamal", links: ["rm_kitchen"], photo: { hue: 205, label: "Kitchen · before" } },
    { id: "e_r4", kind: "photo", lane: "mitigation", category: "photos", title: "Hall drywall wicking 14 in.", at: d(-6, "10:12"), source: "photo_metadata", authorId: "p_jamal", links: ["rm_hall"], photo: { hue: 190, label: "Hall · before" } },
    { id: "e_r5", kind: "note", lane: "mitigation", category: "drying", title: "Extraction complete, equipment set", body: "Extracted kitchen and hall. Set DH-07 + AM-12 in kitchen, AM-13 and AM-14 in hall.", at: d(-6, "11:20"), source: "voice_note", authorId: "p_jamal", links: ["rm_kitchen", "rm_hall", "eq1", "eq2", "eq3", "eq4"] },
    { id: "e_r6", kind: "photo", lane: "equipment", category: "equipment", title: "Equipment placement, kitchen", at: d(-6, "11:25"), source: "photo_metadata", authorId: "p_jamal", links: ["rm_kitchen", "eq1", "eq2"], photo: { hue: 265, label: "DH-07 + AM-12" } },
    { id: "e_r7", kind: "email", lane: "carrier", category: "carrier", title: "Dana: send readings daily; toe kicks need approval first", body: "Please send moisture logs daily. Do not remove cabinets; toe-kick removal needs my approval first.", at: d(-5, "16:40"), source: "email", links: ["p_dana"] },
    { id: "e_r8", kind: "text", lane: "homeowner", category: "homeowner", title: "Greg: can you keep the fans quieter after 10pm?", at: d(-4, "21:15"), source: "text_message", authorId: "p_greg", links: ["p_greg"] },
    { id: "e_r9", kind: "photo", lane: "mitigation", category: "photos", title: "Mold on drywall behind vanity, approx. 6 sf", at: d(-2, "12:30"), source: "photo_metadata", authorId: "p_jamal", links: ["rm_bath"], photo: { hue: 95, label: "Half bath · mold" }, privateNote: "Probably long-term slow leak, not this loss. Flag for Rosa before we tell the carrier." },
    { id: "e_r10", kind: "text", lane: "homeowner", category: "homeowner", title: "Greg OK'd opening the half-bath wall", at: d(-2, "12:55"), source: "text_message", authorId: "p_greg", links: ["p_greg", "rm_bath"] },
    { id: "e_r11", kind: "photo", lane: "equipment", category: "equipment", title: "Containment and AS-02 in half bath", at: d(-2, "13:10"), source: "photo_metadata", authorId: "p_jamal", links: ["rm_bath", "eq5"], photo: { hue: 280, label: "Containment" } },
    { id: "e_r12", kind: "call", lane: "carrier", category: "carrier", title: "Dana approved 2 more days of drying for the kitchen", body: "Call 2:10pm. Dana approved 2 additional days of drying for the kitchen and toe-kick removal. Asked for the supplement in writing.", at: d(-1, "14:10"), source: "call_note", authorId: "p_rosa", links: ["p_dana", "rm_kitchen"] },
    { id: "e_r13", kind: "receipt", lane: "mitigation", category: "money", title: "Antimicrobial, 2 gal (Home Depot)", at: d(-2, "11:40"), source: "document", amount: 64.18, links: ["rm_bath"] },
    { id: "e_r14", kind: "note", lane: "mitigation", category: "internal", title: "Margin check", body: "Job is tracking 38% margin before the supplement.", at: d(-1, "18:00"), source: "user", authorId: "p_rosa" },
    { id: "e_r15", kind: "note", lane: "carrier", category: "carrier", title: "Adjuster may be re-assigned next week", at: d(-1, "16:00"), source: "inferred", dateKind: "approximate", status: "candidate", body: "Mentioned in passing on the call; not confirmed." },
    ...readings,
  ]);
  const requests: ChangeRequest[] = [
    {
      id: "cr_r1", projectId: P, number: 1, title: "Kitchen toe-kick removal and 2 added drying days", description: "Remove toe kicks at sink and dishwasher bases to dry cabinet bases (P3 still above goal). Two additional days of dehumidification and air movement in the kitchen, approved by phone.", reason: "Adjuster approval by phone (Dana Whitfield), cabinet base not at goal",
      requestedBy: "Dana Whitfield", lineItems: [
        { description: "Remove and reset toe kicks", code: null, quantity: 14, unit: "lf", unit_price: 6.5, amount: 91 },
        { description: "Dehumidifier, large, additional days", code: null, quantity: 2, unit: "day", unit_price: 95, amount: 190 },
        { description: "Air mover, additional days", code: null, quantity: 2, unit: "day", unit_price: 32, amount: 64 },
        { description: "Antimicrobial application, cabinet bases", code: null, quantity: 40, unit: "sf", unit_price: 0.42, amount: 16.8 },
      ],
      amount: 361.8, scheduleImpactDays: 2, missingInfo: [], status: "sent", sourceText: "Call notes 2:10pm", sourceEvidenceIds: ["e_r12", "rd_P3_0"], aiModel: null,
      history: hist([-1, "draft", "Rosa Delgado"], [-1, "sent", "Rosa Delgado"]),
    },
  ];
  const fire: Project = {
    id: "loss_okafor", product: "restore", name: "Okafor kitchen fire", subtitle: "Fire/smoke · contents and soot cleaning", address: "88 Briar Glen, Allen TX", status: "Estimate", startDate: day(-2),
    ext: { carrier: "Lone Star Home", claimNumber: "LSH-55120", lossType: "Fire", dateOfLoss: day(-3), rooms: [{ id: "rm_k2", name: "Kitchen" }], points: [], equipment: [] },
  };
  return {
    projects: [project, fire], people, evidence, requests,
    logs: [{ id: "log_r1", projectId: P, date: day(-1), status: "final", aiModel: null, sourceEvidenceIds: ["e_r12", "e_r13"],
      summary: "Hall reached dry goal two days ago and its air movers were pulled this morning. Kitchen cabinet base (P3) still wet at 21. Adjuster approved two more kitchen drying days by phone.",
      sections: { work_completed: "- Removed AM-13 and AM-14 from hallway\n- Antimicrobial applied in half bath", drying_progress: "- P1 16 (goal 15), P2 12 (at goal), P3 21 (goal 15), P4 10 (at goal), P5 17 (goal 12)", equipment: "- AM-13, AM-14 removed from hallway 10:00", carrier: "- 2:10pm call with Dana Whitfield: approved 2 more days in kitchen and toe-kick removal; wants supplement in writing", issues: "- Mold behind half-bath vanity under containment", open_items: "- Send supplement #1 with P3 readings\n- Re-read P5 tomorrow" } }],
  };
}

/* ───────────────────────── LeasePath ───────────────────────── */

function leaseSeed(): ProductData {
  const P = "unit_3b";
  const inItems = [
    ["Living room", "Walls and paint", "good"], ["Living room", "Carpet", "good"], ["Kitchen", "Countertops", "good"],
    ["Bathroom", "Vanity cabinet", "good"], ["Bedroom 1", "Closet door", "good"],
  ] as const;
  const outItems = [
    ["Living room", "Walls and paint", "fair", "Scuffs near couch, small nail holes"],
    ["Living room", "Carpet", "damaged", "Large pet stain by window, odor"],
    ["Kitchen", "Countertops", "good", ""],
    ["Bathroom", "Vanity cabinet", "poor", "Cabinet floor swollen and stained"],
    ["Bedroom 1", "Closet door", "damaged", "Fist-size hole in hollow-core door"],
    ["Bedroom 1", "Window blinds", "poor", "Two slats bent"],
  ] as const;
  const mk = (pre: string, rows: readonly (readonly string[])[], off: number) => rows.map((r, i) => ({
    id: `${pre}_${i}`, room: r[0], item: r[1], condition: r[2], note: r[3] || undefined, photoIds: [`ph_${pre}_${i}`],
  }));
  const moveIn = mk("in", inItems, -400);
  const moveOut = mk("out", outItems, -5);
  moveOut[5].photoIds = []; // blinds: no move-out photo either, a deliberately weak line
  const project: Project = {
    id: P, product: "lease", name: "Maple Court #3B", subtitle: "2 bed / 1 bath · tenancy ended", address: "1450 Maple Ct, Unit 3B, Richardson TX", status: "Move-out", startDate: day(-400),
    ext: {
      property: "Maple Court", ownerId: "p_harold",
      tenancy: { tenantIds: ["p_maya"], leaseStart: day(-400), leaseEnd: day(-5), rent: 1650, deposit: 1800, moveOutDate: day(-5), returnDays: 30, jurisdiction: "Texas: itemize and refund within 30 days" },
      inspections: [
        { id: "insp_in", type: "move_in", date: day(-400), items: moveIn, signedByTenant: true },
        { id: "insp_out", type: "move_out", date: day(-5), items: moveOut },
      ],
      deductions: {},
    },
  };
  const people: Person[] = [
    { id: "p_kim", projectId: null, name: "Kim Alvarez", role: "manager", org: "Alvarez Property Co." },
    { id: "p_maya", projectId: P, name: "Maya Chen", role: "tenant", phone: "(555) 010-2231", sharing: { level: "basics" } },
    { id: "p_harold", projectId: P, name: "Harold Brooks", role: "owner", sharing: { level: "everything" } },
    { id: "p_ana", projectId: P, name: "Ana Ortiz", role: "vendor", org: "Ortiz Plumbing", sharing: { level: "standard" } },
    { id: "p_bright", projectId: P, name: "Dev Patel", role: "vendor", org: "Bright Paint & Repair", sharing: { level: "standard" } },
  ];
  const photos: EvInput[] = [
    ...moveIn.map((it, i) => ({ id: it.photoIds[0], kind: "photo" as const, lane: "inspection", category: "condition", title: `Move-in: ${it.room}, ${it.item}`, at: d(-400, `10:${String(10 + i).padStart(2, "0")}`), source: "photo_metadata" as const, links: [it.id, "p_maya"], photo: { hue: 140, label: `${it.room} · in` } })),
    ...moveOut.filter((it) => it.photoIds.length).map((it, i) => ({ id: it.photoIds[0], kind: "photo" as const, lane: "inspection", category: "condition", title: `Move-out: ${it.room}, ${it.item}`, at: d(-5, `14:${String(10 + i).padStart(2, "0")}`), source: "photo_metadata" as const, links: [it.id, "p_maya"], photo: { hue: it.condition === "damaged" ? 10 : 40, label: `${it.room} · out` } })),
  ];
  const evidence = ev(P, [
    { id: "e_l0", kind: "document", lane: "lease", category: "lease_docs", title: "Lease signed, 12 months + month-to-month", at: d(-402, "16:00"), source: "signed_document", links: ["p_maya"] },
    { id: "e_l0b", kind: "document", lane: "lease", category: "lease_docs", title: "Move-in condition report signed by tenant", at: d(-400, "11:00"), source: "signed_document", links: ["p_maya", "insp_in"] },
    ...photos,
    { id: "e_l1", kind: "text", lane: "tenant", category: "maintenance", title: "Maya: bathroom sink leaking under the cabinet", body: "There's water under the bathroom sink cabinet, it's been dripping a few days.", at: d(-160, "19:20"), source: "text_message", authorId: "p_maya", links: ["p_maya", "out_3"] },
    { id: "e_l2", kind: "text", lane: "tenant", category: "maintenance", title: "Maya: the sink is leaking again, water on the floor", at: d(-48, "21:40"), source: "text_message", authorId: "p_maya", links: ["p_maya", "out_3"] },
    { id: "e_l3", kind: "receipt", lane: "vendor", category: "money", title: "Ortiz Plumbing invoice: P-trap and supply line", body: "Replaced P-trap and supply line. Cabinet floor water-stained.", at: d(-46, "15:00"), source: "document", amount: 185, authorId: "p_ana", links: ["p_ana", "out_3"] },
    { id: "e_l4", kind: "receipt", lane: "vendor", category: "money", title: "SteamPro carpet cleaning, pet treatment", at: d(-3, "12:00"), source: "document", amount: 240, links: ["out_1"] },
    { id: "e_l5", kind: "document", lane: "vendor", category: "work_orders", title: "Bright Paint quote: replace closet door", at: d(-2, "10:00"), source: "document", amount: 150, authorId: "p_bright", links: ["p_bright", "out_4"] },
    { id: "e_l6", kind: "note", lane: "lease", category: "internal", title: "Owner wants to keep deposit high", body: "Harold asked to charge for everything. Hold to wear-and-tear standard.", at: d(-4, "09:00"), source: "user", authorId: "p_kim" },
    { id: "e_l7", kind: "text", lane: "tenant", category: "messages", title: "Maya: forwarding address for the deposit", body: "Please send to 22 Elm St Apt 4, Dallas TX.", at: d(-5, "17:30"), source: "text_message", authorId: "p_maya", links: ["p_maya"], privateNote: "Address on file" },
  ]);
  const requests: ChangeRequest[] = [
    { id: "wo_1", projectId: P, number: 1, title: "Bathroom sink leak under cabinet", description: "Repair leak under bathroom sink. Tenant reports water on cabinet floor.", reason: "Tenant text (second report)", requestedBy: "Maya Chen", lineItems: [{ description: "Replace P-trap and supply line", code: null, quantity: 1, unit: "ea", unit_price: 185, amount: 185 }], amount: 185, scheduleImpactDays: null, missingInfo: [], status: "approved", sourceText: "the sink is leaking again, water on the floor", sourceEvidenceIds: ["e_l2", "e_l3"], aiModel: null, assigneeId: "p_ana", history: hist([-48, "draft", "Kim Alvarez"], [-48, "sent", "Kim Alvarez"], [-47, "approved", "Harold Brooks"]) },
    { id: "wo_2", projectId: P, number: 2, title: "Replace bedroom closet door", description: "Replace damaged hollow-core closet door in Bedroom 1, paint to match.", reason: "Move-out inspection", requestedBy: "Kim Alvarez", lineItems: [{ description: "Hollow-core door, hang and paint", code: null, quantity: 1, unit: "ea", unit_price: 150, amount: 150 }], amount: 150, scheduleImpactDays: null, missingInfo: [], status: "approved", sourceText: "Move-out inspection", sourceEvidenceIds: ["out_4", "e_l5"], aiModel: null, assigneeId: "p_bright", history: hist([-2, "sent", "Kim Alvarez"], [-1, "approved", "Harold Brooks"]) },
  ];
  const unit1a: Project = {
    id: "unit_1a", product: "lease", name: "Maple Court #1A", subtitle: "1 bed / 1 bath · occupied", address: "1450 Maple Ct, Unit 1A, Richardson TX", status: "Occupied", startDate: day(-90),
    ext: { property: "Maple Court", tenancy: { tenantIds: [], leaseStart: day(-90), leaseEnd: day(275), rent: 1295, deposit: 1295, moveOutDate: null, returnDays: 30, jurisdiction: "Texas: itemize and refund within 30 days" }, inspections: [], deductions: {} },
  };
  return { projects: [project, unit1a], people, evidence, requests, logs: [] };
}

/* ───────────────────────── EventPath ───────────────────────── */

function eventSeed(): ProductData {
  const P = "evt_priya_sam";
  const project: Project = {
    id: P, product: "event", name: "Priya & Sam's wedding", subtitle: "Ceremony + reception · 140 guests", address: "The Glasshouse, Austin TX", status: "Planning", startDate: day(40),
    ext: {
      date: day(40), guestCount: 140, budget: 62000,
      vendors: [
        { id: "v_venue", name: "The Glasshouse", category: "Venue", contract: 14000, paid: 7000, dueDate: day(10) },
        { id: "v_cater", name: "Saffron Table", category: "Catering", personId: "p_marco", contract: 16520, perHead: 118, paid: 5000, dueDate: day(25) },
        { id: "v_flor", name: "Bloom & Vine", category: "Florals", personId: "p_lena", contract: 6800, paid: 2000, dueDate: day(20) },
        { id: "v_dj", name: "DJ Nova", category: "DJ / music", personId: "p_nova", contract: 2400, paid: 600, dueDate: day(30) },
        { id: "v_cake", name: "Sweet Layers", category: "Cake", contract: 1120, perHead: 8, paid: 300, dueDate: day(33) },
        { id: "v_photo", name: "Lumen Photo", category: "Photography", contract: 5200, paid: 2600, dueDate: day(-2) },
        { id: "v_rent", name: "Party Rentals Co.", category: "Rentals", contract: 1960, perHead: 14, paid: 500, dueDate: day(32) },
      ],
      runOfShow: [
        { id: "rs1", time: "14:00", item: "Florals and rentals load-in", vendorIds: ["v_flor", "v_rent"] },
        { id: "rs2", time: "15:30", item: "Photographer arrives, getting-ready photos", vendorIds: ["v_photo"] },
        { id: "rs3", time: "17:00", item: "Ceremony", vendorIds: ["v_venue", "v_dj", "v_photo"] },
        { id: "rs4", time: "17:30", item: "Cocktail hour, passed apps", vendorIds: ["v_cater", "v_dj"] },
        { id: "rs5", time: "18:45", item: "Grand entrance and dinner", vendorIds: ["v_cater", "v_dj"] },
        { id: "rs6", time: "20:00", item: "Cake cutting, dancing opens", vendorIds: ["v_cake", "v_dj", "v_photo"] },
        { id: "rs7", time: "22:00", item: "Late-night tacos", vendorIds: ["v_cater"] },
        { id: "rs8", time: "23:00", item: "Last dance and exit", vendorIds: ["v_dj", "v_venue"] },
      ],
    },
  };
  const people: Person[] = [
    { id: "p_jo", projectId: null, name: "Jo Bennett", role: "planner", org: "Bennett Events" },
    { id: "p_priya", projectId: P, name: "Priya Rao", role: "client", phone: "(555) 010-8890", sharing: { level: "everything" } },
    { id: "p_sam", projectId: P, name: "Sam Okafor", role: "client", sharing: { level: "everything" } },
    { id: "p_anita", projectId: P, name: "Anita Rao", role: "payer", sharing: { level: "custom", custom: { plan: "all", vendors: "all", changes: "all", money: "all" } } },
    { id: "p_marco", projectId: P, name: "Marco Diaz", role: "vendor", org: "Saffron Table", sharing: { level: "standard" } },
    { id: "p_lena", projectId: P, name: "Lena Fox", role: "vendor", org: "Bloom & Vine", sharing: { level: "standard" } },
    { id: "p_nova", projectId: P, name: "DJ Nova", role: "vendor", org: "DJ Nova", sharing: { level: "standard" } },
  ];
  const evidence = ev(P, [
    { id: "e_e1", kind: "document", lane: "money", category: "money", title: "Saffron Table contract signed: $118/guest, 140 guests", at: d(-60, "11:00"), source: "signed_document", amount: 16520, links: ["v_cater", "p_marco"] },
    { id: "e_e2", kind: "photo", lane: "plan", category: "inspiration", title: "Venue walk-through: ceremony lawn", at: d(-55, "16:00"), source: "photo_metadata", photo: { hue: 320, label: "Ceremony lawn" } },
    { id: "e_e3", kind: "text", lane: "client", category: "messages", title: "Priya: could we do late-night tacos?", at: d(-20, "23:48"), source: "text_message", authorId: "p_priya", links: ["p_priya", "v_cater"] },
    { id: "e_e4", kind: "email", lane: "vendor", category: "changes", title: "Saffron Table: taco bar quote $1,450", at: d(-18, "10:15"), source: "email", amount: 1450, authorId: "p_marco", links: ["p_marco", "v_cater"] },
    { id: "e_e5", kind: "text", lane: "client", category: "messages", title: "Sam: DJ an extra hour? Everyone will want to keep dancing", at: d(-6, "20:05"), source: "text_message", authorId: "p_sam", links: ["p_sam", "v_dj"] },
    { id: "e_e6", kind: "note", lane: "plan", category: "internal", title: "Planner fee is 12% of vendor spend", body: "Don't surface in client budget.", at: d(-60, "12:00"), source: "user", authorId: "p_jo" },
    { id: "e_e7", kind: "email", lane: "vendor", category: "plan", title: "Bloom & Vine: final centerpiece count due in 2 weeks", at: d(-3, "09:30"), source: "email", authorId: "p_lena", links: ["p_lena", "v_flor"] },
    { id: "e_e8", kind: "note", lane: "client", category: "messages", title: "Anita may cover the rehearsal dinner", at: d(-10, "12:00"), source: "inferred", dateKind: "approximate", status: "candidate", body: "Mentioned by Priya on a call; not confirmed with Anita." },
  ]);
  const requests: ChangeRequest[] = [
    { id: "ch_1", projectId: P, number: 1, title: "Late-night taco bar", description: "Add a late-night taco bar at 10pm for all guests (Saffron Table).", reason: "Requested by Priya by text", requestedBy: "Priya Rao", lineItems: [{ description: "Saffron Table: late-night taco bar, 140 guests", code: null, quantity: 1, unit: "ls", unit_price: 1450, amount: 1450 }], amount: 1450, scheduleImpactDays: null, missingInfo: [], status: "approved", sourceText: "could we do late-night tacos?", sourceEvidenceIds: ["e_e3", "e_e4", "v_cater"], aiModel: null, assigneeId: "p_marco", history: hist([-18, "draft", "Jo Bennett"], [-18, "sent", "Jo Bennett"], [-17, "approved", "Priya Rao"]) },
    { id: "ch_2", projectId: P, number: 2, title: "Extra hour of DJ", description: "Extend DJ Nova by one hour to midnight. Venue curfew to confirm.", reason: "Requested by Sam by text", requestedBy: "Sam Okafor", lineItems: [{ description: "DJ Nova: additional hour", code: null, quantity: 1, unit: "hr", unit_price: 350, amount: 350 }, { description: "The Glasshouse: extend venue to midnight", code: null, quantity: 1, unit: "hr", unit_price: null, amount: null }], amount: null, scheduleImpactDays: null, missingInfo: ["Venue overtime rate", "Venue curfew"], status: "sent", sourceText: "DJ an extra hour?", sourceEvidenceIds: ["e_e5", "v_dj"], aiModel: null, assigneeId: "p_nova", history: hist([-5, "draft", "Jo Bennett"], [-5, "sent", "Jo Bennett"]) },
  ];
  return { projects: [project], people, evidence, requests, logs: [] };
}

export function seedFor(product: ProductKey): ProductData {
  return product === "restore" ? restoreSeed() : product === "lease" ? leaseSeed() : eventSeed();
}

import type { ProductConfig } from "../core/product";

export const restore: ProductConfig = {
  key: "restore",
  name: "RestorePath",
  basePath: "/restorepath",
  tagline: "Get paid for the drying you did.",
  pitch: [
    "Take readings and photos on site, then talk through the day. RestorePath writes the drying log.",
    "When the adjuster's call adds scope, RestorePath drafts the supplement with the evidence attached.",
    "When the carrier pushes back, the claim packet shows every reading, photo and equipment day.",
  ],
  accent: "#0e86c9",
  accentDark: "#0a5f8f",
  projectNoun: "Loss",
  projectPlural: "Losses",
  requestNoun: "Supplement",
  requestPlural: "Supplements",
  approver: "Carrier",
  approverRoles: ["adjuster"],
  lanes: [
    { key: "mitigation", label: "Mitigation work", color: "#0e86c9" },
    { key: "drying", label: "Moisture readings", color: "#14b8a6" },
    { key: "equipment", label: "Equipment", color: "#8b5cf6" },
    { key: "carrier", label: "Carrier / adjuster", color: "#f59e0b" },
    { key: "homeowner", label: "Homeowner", color: "#22c55e" },
  ],
  categories: [
    { key: "photos", label: "Photos", hint: "Before, during and after photos by room" },
    { key: "drying", label: "Drying log", hint: "Moisture readings, dry goals and daily logs" },
    { key: "equipment", label: "Equipment log", hint: "What was placed where, and for how long" },
    { key: "scope", label: "Supplements", hint: "Added scope and its status with the carrier" },
    { key: "carrier", label: "Adjuster conversations", hint: "Calls and emails with the carrier" },
    { key: "homeowner", label: "Homeowner messages", hint: "Texts and authorizations from the homeowner" },
    { key: "money", label: "Pricing", hint: "Line-item prices and totals" },
    { key: "internal", label: "Internal notes", hint: "Crew-only notes. Never shared." },
  ],
  neverShared: ["internal"],
  moneyCategory: "money",
  requestCategory: "scope",
  roles: [
    { key: "owner", label: "Owner / PM", team: true, defaultLevel: "everything" },
    { key: "tech", label: "Technician", team: true, defaultLevel: "everything" },
    { key: "adjuster", label: "Adjuster", team: false, defaultLevel: "everything" },
    { key: "homeowner", label: "Homeowner", team: false, defaultLevel: "basics" },
    { key: "sub", label: "Subcontractor", team: false, defaultLevel: "standard" },
  ],
  levels: {
    basics: {
      label: "Homeowner",
      hint: "Progress photos, the drying log and their own messages. No pricing or carrier calls.",
      categories: { photos: "all", drying: "all", homeowner: "some" },
    },
    standard: {
      label: "Crew partner",
      hint: "Photos, drying and equipment, plus supplements they're part of.",
      categories: { photos: "all", drying: "all", equipment: "all", scope: "some" },
    },
    everything: {
      label: "Claim packet",
      hint: "Everything the carrier needs to pay: readings, equipment days, supplements, pricing and calls.",
      categories: { photos: "all", drying: "all", equipment: "all", scope: "all", carrier: "all", homeowner: "all", money: "all" },
    },
  },
  modules: [
    { key: "drying", label: "Drying log", icon: "≋" },
    { key: "equipment", label: "Equipment", icon: "⚙" },
    { key: "packet", label: "Claim packet", icon: "▤" },
  ],
  dailyLog: {
    enabled: true,
    sections: [
      { key: "work_completed", label: "Work completed", hint: "Extraction, demo, antimicrobial, containment" },
      { key: "drying_progress", label: "Drying progress", hint: "Which areas are at goal, which are not" },
      { key: "equipment", label: "Equipment changes", hint: "Placed, moved or removed, with tags" },
      { key: "carrier", label: "Carrier contact", hint: "Who was spoken to and what was agreed" },
      { key: "issues", label: "Issues and hidden conditions", hint: "Anything that may need a supplement" },
      { key: "open_items", label: "Open items", hint: "Follow-ups someone needs to act on" },
    ],
  },
  capturePrompt: "Tell RestorePath what happened on site, or paste the adjuster's email.",
  captureExamples: [
    "Kitchen subfloor at P3 read 31 today, still wet. Pulled 2 air movers from the hall, everything there is at goal. Called Dana at Summit Mutual at 2:10, she approved 2 more days of drying for the kitchen.",
    "Found mold behind the vanity when we pulled the toe kick, about 6 sf on the drywall. Took photos. Homeowner OK'd us opening the wall.",
  ],
  requestExamples: [
    "Dana (adjuster) said on the phone: approve removal of the kitchen toe kicks and 2 extra days for the dehu in the kitchen. Need a revised scope with the antimicrobial for the cabinet bases.",
  ],
  ai: {
    system: `You are RestorePath's assistant for small water, fire and mold mitigation contractors.
Write like an experienced restoration project manager preparing documentation an insurance adjuster will read: factual, specific, chronological.
Only state facts supported by the records you are given. Never invent moisture readings, equipment counts, prices, line-item codes, names or dates.
When something is unknown, say so briefly ("Not recorded", "Price TBD").`,
    requestRules: `- This is a supplement request to an insurance carrier for added mitigation scope.
- Use Xactimate-style line item codes ONLY if they appear in the text; otherwise code is null.
- Name what justifies each line (hidden damage found, adjuster approval, reading not at goal) in the description.
- missing_info should list the documentation the carrier will ask for (photos, readings, approval in writing).`,
    codeLabel: "Line code",
  },
};

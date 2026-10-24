import type { ProductConfig } from "../core/product";

export const event: ProductConfig = {
  key: "event",
  name: "EventPath",
  basePath: "/eventpath",
  tagline: "Every “can we add…” becomes a priced change.",
  pitch: [
    "Clients text requests at midnight. EventPath turns each one into a change request with the vendor and price attached.",
    "Guest count goes up and per-head vendors re-price automatically, with no invented numbers.",
    "Couples, parents and vendors each see their part of the plan. Your margins and notes stay with you.",
  ],
  accent: "#c0367a",
  accentDark: "#8f2459",
  projectNoun: "Event",
  projectPlural: "Events",
  requestNoun: "Change request",
  requestPlural: "Change requests",
  approver: "Client",
  approverRoles: ["client", "payer"],
  lanes: [
    { key: "client", label: "Client", color: "#c0367a" },
    { key: "vendor", label: "Vendors", color: "#8b5cf6" },
    { key: "plan", label: "Plan and timeline", color: "#0ea5e9" },
    { key: "money", label: "Payments", color: "#64748b" },
  ],
  categories: [
    { key: "plan", label: "Plan and run of show", hint: "Timeline of the day, ceremony and reception details" },
    { key: "vendors", label: "Vendor roster", hint: "Who's booked and how to reach them" },
    { key: "changes", label: "Change requests", hint: "Added items and their approval status" },
    { key: "messages", label: "Client messages", hint: "Texts and emails with the client" },
    { key: "inspiration", label: "Inspiration and photos", hint: "Mood boards, venue walk-through photos" },
    { key: "money", label: "Budget and payments", hint: "Contracts, prices, deposits and balances" },
    { key: "internal", label: "Planner notes", hint: "Margins and private notes. Never shared." },
  ],
  neverShared: ["internal"],
  moneyCategory: "money",
  requestCategory: "changes",
  roles: [
    { key: "planner", label: "Planner", team: true, defaultLevel: "everything" },
    { key: "assistant", label: "Assistant planner", team: true, defaultLevel: "everything" },
    { key: "client", label: "Client / couple", team: false, defaultLevel: "everything" },
    { key: "payer", label: "Family / payer", team: false, defaultLevel: "basics" },
    { key: "vendor", label: "Vendor", team: false, defaultLevel: "standard" },
  ],
  levels: {
    basics: {
      label: "Family",
      hint: "The plan, the vendor list and approved changes. No messages; add Budget if they're paying.",
      categories: { plan: "all", vendors: "all", changes: "some" },
    },
    standard: {
      label: "Vendor",
      hint: "The run of show, the vendor roster, and only the change requests that involve them.",
      categories: { plan: "all", vendors: "all", changes: "some", money: "some" },
    },
    everything: {
      label: "Client",
      hint: "The full plan, changes, budget and their messages. Planner notes stay private.",
      categories: { plan: "all", vendors: "all", changes: "all", messages: "all", inspiration: "all", money: "all" },
    },
  },
  modules: [
    { key: "budget", label: "Vendors and budget", icon: "$" },
    { key: "runofshow", label: "Run of show", icon: "◷" },
  ],
  dailyLog: { enabled: false, sections: [] },
  capturePrompt: "Paste the client's text or a vendor's email. EventPath links it to the right vendors.",
  captureExamples: [
    "From Priya 11:52pm: OMG can we add a sparkler send-off?? And my mom says we need to invite 12 more people from dad's side 🙈",
    "Bloom & Vine: centerpiece quote updated, $95 each for the low arrangements, 18 tables. Need final count by Nov 15.",
  ],
  requestExamples: [
    "Priya: can we add a sparkler send-off at the end? Also mom wants 12 more guests from dad's side, and could the DJ do an extra hour?",
  ],
  ai: {
    system: `You are EventPath's assistant for independent wedding and event planners.
Write warmly but precisely, the way a seasoned planner writes to a client: clear, upbeat, no filler.
Only state facts supported by the records you are given. Never invent prices, vendor names, quantities or dates.
When something is unknown, say so ("Quote needed").`,
    requestRules: `- This is a change request to the client for something added to their event.
- One line item per distinct addition. Put the vendor that would supply it in the description when it can be matched to the vendor list given.
- If guest count changes, include one line item with quantity = number of added guests and unit "guest", unit_price null (pricing is computed separately from per-head vendor contracts).
- missing_info: venue rules (e.g. sparklers allowed?), vendor availability, quotes needed.`,
    codeLabel: null,
  },
};

import type { ProductConfig } from "../core/product";

export const lease: ProductConfig = {
  key: "lease",
  name: "LeasePath",
  basePath: "/leasepath",
  tagline: "Every unit's story, ready for move-out day.",
  pitch: [
    "Walk the unit at move-in and take photos room by room. LeasePath keeps them with the lease.",
    "When a tenant texts about a leak, LeasePath drafts the work order and sends it to the right vendor.",
    "At move-out, LeasePath compares both inspections and writes the deposit itemization with the evidence attached.",
  ],
  accent: "#16a34a",
  accentDark: "#11743a",
  projectNoun: "Unit",
  projectPlural: "Units",
  requestNoun: "Work order",
  requestPlural: "Work orders",
  approver: "Owner",
  approverRoles: ["owner"],
  lanes: [
    { key: "inspection", label: "Inspections", color: "#16a34a" },
    { key: "tenant", label: "Tenant", color: "#0ea5e9" },
    { key: "maintenance", label: "Maintenance", color: "#f59e0b" },
    { key: "vendor", label: "Vendors", color: "#8b5cf6" },
    { key: "lease", label: "Lease and money", color: "#64748b" },
  ],
  categories: [
    { key: "condition", label: "Condition reports", hint: "Move-in, move-out and periodic inspection photos" },
    { key: "maintenance", label: "Maintenance requests", hint: "What the tenant reported and when" },
    { key: "work_orders", label: "Work orders", hint: "Vendor jobs and their completion photos" },
    { key: "messages", label: "Tenant messages", hint: "Texts and emails with the tenant" },
    { key: "lease_docs", label: "Lease documents", hint: "Lease, addenda, notices" },
    { key: "money", label: "Rent, costs and deposit", hint: "Invoices, rent ledger and deposit figures" },
    { key: "internal", label: "Internal notes", hint: "Manager-only notes. Never shared." },
  ],
  neverShared: ["internal"],
  moneyCategory: "money",
  requestCategory: "work_orders",
  roles: [
    { key: "manager", label: "Property manager", team: true, defaultLevel: "everything" },
    { key: "tenant", label: "Tenant", team: false, defaultLevel: "basics" },
    { key: "owner", label: "Property owner", team: false, defaultLevel: "everything" },
    { key: "vendor", label: "Vendor", team: false, defaultLevel: "standard" },
  ],
  levels: {
    basics: {
      label: "Tenant",
      hint: "Condition reports for their tenancy, their own requests and messages, and their lease. No vendor invoices.",
      categories: { condition: "all", maintenance: "some", work_orders: "some", messages: "some", lease_docs: "all" },
    },
    standard: {
      label: "Vendor",
      hint: "Only the work orders assigned to them and the photos attached to those jobs.",
      categories: { work_orders: "some", maintenance: "some", condition: "some", money: "some" },
    },
    everything: {
      label: "Owner",
      hint: "The full unit record, costs and deposit decisions. Internal notes stay private.",
      categories: { condition: "all", maintenance: "all", work_orders: "all", messages: "all", lease_docs: "all", money: "all" },
    },
  },
  modules: [
    { key: "inspections", label: "Inspections", icon: "◫" },
    { key: "deposit", label: "Deposit", icon: "$" },
  ],
  dailyLog: { enabled: false, sections: [] },
  capturePrompt: "Paste a tenant's text, a vendor's update, or say what you saw at the unit.",
  captureExamples: [
    "Text from Maya 10/14 9:40pm: the bathroom sink is leaking under the cabinet again, there's water on the floor. Can someone come tomorrow?",
    "Vendor update from Ortiz Plumbing: replaced P-trap and supply line under bath sink, cabinet floor is water-stained but solid. Invoice $185.",
  ],
  requestExamples: [
    "Maya: the bathroom sink is leaking under the cabinet again and the garbage disposal is making a grinding noise. I'm home after 4 most days.",
  ],
  ai: {
    system: `You are LeasePath's assistant for small landlords and property managers (roughly 5 to 300 units).
Write like a careful property manager: plain, neutral, factual. These records may be read in a deposit dispute or small-claims court.
Only state facts supported by the records you are given. Never invent prices, dates, names, conditions or tenant fault.
Do not characterize damage as tenant-caused unless the record says so.`,
    requestRules: `- This is a maintenance work order for a vendor (plumber, electrician, handyman, HVAC, appliance).
- One line item per distinct problem. Prices only if stated.
- reason: who reported it and how (tenant text, inspection, owner request).
- missing_info: access arrangements, photos, model numbers, or approval needed above the owner's spending limit.`,
    codeLabel: null,
  },
};

import type { ChangeRequest, LineItem, Project } from "../core/types";

// Event money engine: contracts + approved changes vs budget, pending exposure,
// and per-head repricing when guest count changes. Arithmetic only in code.

export type Vendor = { id: string; name: string; category: string; personId?: string; contract: number; perHead?: number | null; paid: number; dueDate: string | null };
export type ShowItem = { id: string; time: string; item: string; vendorIds: string[]; note?: string };

export function vendors(p: Project): Vendor[] { return p.ext.vendors ?? []; }
export function runOfShow(p: Project): ShowItem[] { return [...(p.ext.runOfShow ?? [])].sort((a: ShowItem, b: ShowItem) => a.time.localeCompare(b.time)); }

export function budgetSummary(p: Project, requests: ChangeRequest[]) {
  const vs = vendors(p);
  const contracted = vs.reduce((s, v) => s + v.contract, 0);
  const approved = requests.filter((r) => r.status === "approved");
  const pending = requests.filter((r) => r.status === "sent" || r.status === "draft");
  const approvedTotal = approved.reduce((s, r) => s + (r.amount ?? 0), 0);
  const pendingTotal = pending.reduce((s, r) => s + (r.amount ?? 0), 0);
  const pendingUnpriced = pending.filter((r) => r.amount == null).length;
  const paid = vs.reduce((s, v) => s + v.paid, 0);
  const committed = contracted + approvedTotal;
  return {
    budget: p.ext.budget as number,
    contracted,
    approvedTotal,
    committed,
    pendingTotal,
    pendingUnpriced,
    paid,
    balance: committed - paid,
    remaining: (p.ext.budget as number) - committed,
    ifAllApproved: (p.ext.budget as number) - committed - pendingTotal,
  };
}

/**
 * Turn a guest-count change into priced line items from per-head vendor contracts.
 * Vendors without a per-head price get an unpriced line so the planner knows to ask.
 */
export function guestCountLines(p: Project, added: number): LineItem[] {
  if (!added) return [];
  return vendors(p)
    .filter((v) => v.perHead != null || /cater|rental|bar|cake|favor/i.test(v.category))
    .map((v) => ({
      description: `${v.name} (${v.category}): ${added > 0 ? "+" : ""}${added} guests`,
      code: null,
      quantity: added,
      unit: "guest",
      unit_price: v.perHead ?? null,
      amount: v.perHead != null ? Math.round(added * v.perHead * 100) / 100 : null,
    }));
}

/** Replace a model-proposed "N more guests" line with per-vendor priced lines. */
export function expandGuestLines(p: Project, items: LineItem[]): { items: LineItem[]; guestDelta: number } {
  let guestDelta = 0;
  const out: LineItem[] = [];
  for (const li of items) {
    if (li.unit === "guest" && li.quantity) { guestDelta += li.quantity; out.push(...guestCountLines(p, li.quantity)); }
    else out.push(li);
  }
  return { items: out, guestDelta };
}

/** Match a free-text line to a vendor by name or category word. */
export function matchVendor(p: Project, text: string): Vendor | null {
  const t = text.toLowerCase();
  const vs = vendors(p);
  return vs.find((v) => t.includes(v.name.toLowerCase())) ??
    vs.find((v) => v.category.toLowerCase().split(/[\s/&,]+/).some((w) => w.length > 2 && t.includes(w))) ??
    (/(sparkler|send-?off)/.test(t) ? vs.find((v) => /coordinat|venue/i.test(v.category)) ?? null : null) ??
    (/(hour|overtime|song|music)/.test(t) ? vs.find((v) => /dj|band|music/i.test(v.category)) ?? null : null);
}

export function upcomingPayments(p: Project, today: string) {
  return vendors(p)
    .filter((v) => v.dueDate && v.contract - v.paid > 0)
    .map((v) => ({ vendor: v, due: v.dueDate!, amount: v.contract - v.paid, overdue: v.dueDate! < today }))
    .sort((a, b) => a.due.localeCompare(b.due));
}

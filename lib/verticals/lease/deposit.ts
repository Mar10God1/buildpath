import type { ChangeRequest, Evidence, Project } from "../core/types";
import { strength } from "../core/evidence";

// Deposit disposition engine. The timeline settles the dispute: for every item we line up the
// move-in record, the move-out record and any cost evidence, and do the arithmetic in code.

export type Condition = "new" | "good" | "fair" | "poor" | "damaged";
export const CONDITIONS: Condition[] = ["new", "good", "fair", "poor", "damaged"];
export type InspectionItem = { id: string; room: string; item: string; condition: Condition; note?: string; photoIds: string[] };
export type Inspection = { id: string; type: "move_in" | "move_out" | "periodic"; date: string; items: InspectionItem[]; signedByTenant?: boolean };
export type Tenancy = { tenantIds: string[]; leaseStart: string; leaseEnd: string; rent: number; deposit: number; moveOutDate: string | null; returnDays: number; jurisdiction: string };
export type DeductionOverride = { include?: boolean; amount?: number | null; reason?: string };

export type Classification = "no_change" | "normal_wear" | "damage" | "no_baseline";
export const CLASS_LABELS: Record<Classification, string> = {
  no_change: "No change",
  normal_wear: "Normal wear",
  damage: "Beyond normal wear",
  no_baseline: "No move-in record",
};

export type DepositRow = {
  key: string;
  room: string;
  item: string;
  moveIn: InspectionItem | null;
  moveOut: InspectionItem;
  steps: number;
  classification: Classification;
  costEvidence: { id: string; title: string; amount: number }[];
  suggested: number | null;
  include: boolean;
  amount: number | null;
  reason: string;
  /** 0–100, how well this line would hold up if disputed. */
  support: number;
  /** Tenant reports about this item during the tenancy: the timeline can cut against a charge. */
  priorReports: { id: string; title: string; at: string }[];
  gaps: string[];
};

const rank = (c: Condition) => CONDITIONS.indexOf(c);
const key = (room: string, item: string) => `${room}|${item}`.toLowerCase();
const DAY = 86400000;

export function tenancy(p: Project): Tenancy { return p.ext.tenancy; }
export function inspections(p: Project): Inspection[] { return p.ext.inspections ?? []; }

/**
 * Normal wear scales with time: a one-step decline over a tenancy of a year or more is wear,
 * not damage. "Damaged" at move-out, or a drop of two or more steps, is beyond normal wear.
 */
export function classify(moveIn: InspectionItem | null, moveOut: InspectionItem, months: number): { cls: Classification; steps: number } {
  if (!moveIn) return { cls: moveOut.condition === "damaged" || moveOut.condition === "poor" ? "no_baseline" : "no_change", steps: 0 };
  const steps = rank(moveOut.condition) - rank(moveIn.condition);
  if (steps <= 0) return { cls: "no_change", steps };
  if (moveOut.condition === "damaged" || steps >= 2 || (steps === 1 && months < 12)) return { cls: "damage", steps };
  return { cls: "normal_wear", steps };
}

export function depositRows(p: Project, evidence: Evidence[], requests: ChangeRequest[]): DepositRow[] {
  const ins = inspections(p);
  const moveIn = ins.find((i) => i.type === "move_in");
  const moveOut = ins.find((i) => i.type === "move_out");
  if (!moveOut) return [];
  const t = tenancy(p);
  const months = (Date.parse(t.moveOutDate ?? moveOut.date) - Date.parse(t.leaseStart)) / (DAY * 30.44);
  const overrides: Record<string, DeductionOverride> = p.ext.deductions ?? {};
  const byKey = new Map((moveIn?.items ?? []).map((i) => [key(i.room, i.item), i]));
  const confirmed = evidence.filter((e) => e.status === "confirmed");

  return moveOut.items.map((out) => {
    const k = key(out.room, out.item);
    const inn = byKey.get(k) ?? null;
    const { cls, steps } = classify(inn, out, months);
    // Cost evidence: receipts/invoices linked to the move-out item, plus approved work orders that cite it.
    // A quote or invoice already cited by an approved work order is counted once, via the work order.
    const orders = requests.filter((r) => r.status === "approved" && r.amount != null && r.sourceEvidenceIds.includes(out.id));
    const cited = new Set(orders.flatMap((r) => r.sourceEvidenceIds));
    const costEvidence = [
      ...confirmed.filter((e) => e.amount != null && e.links.includes(out.id) && !cited.has(e.id)).map((e) => ({ id: e.id, title: e.title, amount: e.amount as number })),
      ...orders.map((r) => ({ id: r.id, title: `Work order #${r.number}: ${r.title}`, amount: r.amount as number })),
    ];
    const suggested = costEvidence.length ? Math.round(costEvidence.reduce((s, c) => s + c.amount, 0) * 100) / 100 : null;
    const priorReports = confirmed
      .filter((e) => e.category === "maintenance" && e.links.includes(out.id) && e.at.slice(0, 10) < moveOut.date)
      .map((e) => ({ id: e.id, title: e.title, at: e.at }));
    const ov = overrides[k] ?? {};
    // A tenant who reported the problem during the tenancy is unlikely to owe for it.
    const include = ov.include ?? (cls === "damage" && !priorReports.length);
    const amount = ov.amount !== undefined ? ov.amount : suggested;

    const gaps: string[] = [];
    const photos = (ids: string[]) => confirmed.filter((e) => ids.includes(e.id) && e.kind === "photo");
    const inPhotos = inn ? photos(inn.photoIds) : [];
    const outPhotos = photos(out.photoIds);
    if (!inn) gaps.push("No move-in record for this item");
    else if (!inPhotos.length) gaps.push("No move-in photo");
    if (!outPhotos.length) gaps.push("No move-out photo");
    if (include && amount == null) gaps.push("No invoice, receipt or quote for the amount");
    if (inn && !moveIn?.signedByTenant) gaps.push("Move-in report not signed by tenant");
    if (priorReports.length) gaps.push(`Tenant reported this ${priorReports.length}× during the tenancy (first ${priorReports[0].at.slice(0, 10)})`);

    const parts = [...inPhotos, ...outPhotos].map(strength);
    const base = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 30;
    const support = Math.max(0, Math.round(base - gaps.length * 15));

    return {
      key: k, room: out.room, item: out.item, moveIn: inn, moveOut: out, steps, classification: cls,
      costEvidence, suggested, include, amount, support, gaps, priorReports,
      reason: ov.reason ?? defaultReason(inn, out, cls),
    };
  });
}

function defaultReason(inn: InspectionItem | null, out: InspectionItem, cls: Classification) {
  const was = inn ? `${inn.condition} at move-in` : "not recorded at move-in";
  return `${out.item} (${out.room}): ${was}, ${out.condition} at move-out${out.note ? ` — ${out.note}` : ""}. ${CLASS_LABELS[cls]}.`;
}

export function depositSummary(p: Project, rows: DepositRow[], today: string) {
  const t = tenancy(p);
  const deductions = rows.filter((r) => r.include);
  const unpriced = deductions.filter((r) => r.amount == null);
  const total = deductions.reduce((s, r) => s + (r.amount ?? 0), 0);
  const deadline = t.moveOutDate ? new Date(Date.parse(t.moveOutDate) + t.returnDays * DAY).toISOString().slice(0, 10) : null;
  const daysLeft = deadline ? Math.ceil((Date.parse(deadline) - Date.parse(today)) / DAY) : null;
  return {
    deposit: t.deposit,
    deductionsTotal: Math.round(total * 100) / 100,
    refund: Math.round(Math.max(0, t.deposit - total) * 100) / 100,
    owedByTenant: Math.round(Math.max(0, total - t.deposit) * 100) / 100,
    unpriced: unpriced.length,
    deadline,
    daysLeft,
    weakest: deductions.filter((r) => r.support < 60),
  };
}

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

/** Itemized statement, written in code from the rows so every figure is traceable. */
export function itemizationLetter(p: Project, tenantNames: string[], rows: DepositRow[], today: string) {
  const s = depositSummary(p, rows, today);
  const lines = rows.filter((r) => r.include);
  return [
    `${today}`,
    ``,
    `To: ${tenantNames.join(" and ")}`,
    `Re: Security deposit, ${p.name}, ${p.address}`,
    ``,
    `Your tenancy ended on ${tenancy(p).moveOutDate ?? "(move-out date)"}. Your security deposit was ${money(s.deposit)}.`,
    lines.length ? `The following deductions are made for damage beyond normal wear and tear. Move-in and move-out photos for each item are attached.` : `No deductions are being made.`,
    ``,
    ...lines.map((r, i) => `${i + 1}. ${r.reason} ${r.amount != null ? money(r.amount) : "AMOUNT NEEDED"}${r.costEvidence.length ? ` (per ${r.costEvidence.map((c) => c.title).join("; ")})` : ""}`),
    ``,
    `Total deductions: ${money(s.deductionsTotal)}`,
    s.owedByTenant > 0 ? `Balance owed by tenant: ${money(s.owedByTenant)}` : `Refund due to you: ${money(s.refund)}`,
    ``,
    `Items that changed only through normal wear and tear have not been charged.`,
  ].join("\n");
}

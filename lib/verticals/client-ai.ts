import type { ProductConfig } from "./core/product";
import type { ChangeRequest, Evidence, LineItem, Person, Project } from "./core/types";
import type { AiContext, CaptureItem, RequestDraft } from "./ai/tasks";
import { nowLocal, todayLocal, uid } from "./core/evidence";
import { expandGuestLines, matchVendor, vendors } from "./event/budget";
import { points } from "./restore/drying";

export type AiMeta = { mode: "ai" | "pattern"; model: string | null };

export function aiContext(cfg: ProductConfig, project: Project, people: Person[]): AiContext {
  const roleLabel = (k: string) => cfg.roles.find((r) => r.key === k)?.label ?? k;
  return {
    projectName: project.name,
    projectSummary: [project.subtitle, project.address].filter(Boolean).join(" · "),
    people: people.map((p) => ({ name: p.name, role: roleLabel(p.role) + (p.org ? `, ${p.org}` : "") })),
    vendors: cfg.key === "event" ? vendors(project).map((v) => `${v.name} (${v.category}${v.perHead ? `, $${v.perHead}/guest` : ""})`) : undefined,
    points: cfg.key === "restore" ? points(project).map((p) => `${p.label} ${p.material}, goal ${p.goal}`) : undefined,
    today: todayLocal(),
  };
}

export async function callAi<T>(body: Record<string, unknown>): Promise<{ result: T } & AiMeta> {
  const res = await fetch("/api/verticals/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

/** BuildPath rule: do the arithmetic in code, never in the model. */
export function priceLines(items: Omit<LineItem, "amount">[] | LineItem[]): { items: LineItem[]; total: number | null } {
  const out = items.map((li) => {
    const qty = li.quantity ?? (li.unit_price != null ? 1 : null);
    const amount = qty != null && li.unit_price != null ? Math.round(qty * li.unit_price * 100) / 100 : null;
    return { ...li, code: li.code ?? null, quantity: qty, amount };
  });
  const fully = out.length > 0 && out.every((li) => li.amount != null);
  return { items: out, total: fully ? Math.round(out.reduce((s, li) => s + (li.amount as number), 0) * 100) / 100 : null };
}

export function requestFromDraft(cfg: ProductConfig, project: Project, people: Person[], existing: ChangeRequest[], draft: RequestDraft, sourceText: string, sourceEvidenceIds: string[], meta: AiMeta, by: string): ChangeRequest {
  let items = draft.line_items.map((li) => ({ ...li, amount: null })) as LineItem[];
  const missing = [...draft.missing_info];
  let assigneeId: string | null = null;
  const links = [...sourceEvidenceIds];
  if (cfg.key === "event") {
    const expanded = expandGuestLines(project, items);
    items = expanded.items;
    if (expanded.guestDelta) missing.push(`Guest count ${project.ext.guestCount} → ${project.ext.guestCount + expanded.guestDelta}: confirm venue capacity and rentals`);
    for (const li of items) {
      const v = matchVendor(project, li.description);
      if (v) { links.push(v.id); if (v.personId && !assigneeId) assigneeId = v.personId; }
    }
  }
  const priced = priceLines(items);
  const requester = people.find((p) => draft.requested_by && p.name.toLowerCase().startsWith(draft.requested_by.toLowerCase().split(" ")[0]));
  return {
    id: uid("cr"),
    projectId: project.id,
    number: Math.max(0, ...existing.map((r) => r.number)) + 1,
    title: draft.title,
    description: draft.description,
    reason: draft.reason,
    requestedBy: requester?.name ?? draft.requested_by,
    lineItems: priced.items,
    amount: priced.total,
    scheduleImpactDays: draft.schedule_impact_days,
    missingInfo: [...new Set(missing)],
    status: "draft",
    sourceText,
    sourceEvidenceIds: [...new Set(links)],
    aiModel: meta.model,
    assigneeId,
    history: [{ at: nowLocal(), status: "draft", by, note: meta.mode === "ai" ? `Drafted by ${meta.model}` : "Drafted by pattern matching (AI not configured)" }],
  };
}

/** Capture → candidate evidence. Nothing becomes fact until a person confirms it (LifePath). */
export function evidenceFromCapture(cfg: ProductConfig, project: Project, people: Person[], items: CaptureItem[], authorId: string | undefined): Evidence[] {
  const pts = points(project);
  const laneCategory: Record<string, string> = {
    // restore
    mitigation: "photos", drying: "drying", equipment: "equipment", carrier: "carrier", homeowner: "homeowner",
    // lease
    inspection: "condition", tenant: "maintenance", maintenance: "maintenance", vendor: "work_orders", lease: "lease_docs",
    // event
    client: "messages", plan: "plan", money: "money",
  };
  return items.map((it) => {
    const linkedPeople = people.filter((p) => it.people.some((n) => p.name.toLowerCase().includes(n.toLowerCase().split(" ")[0]))).map((p) => p.id);
    const pt = it.reading ? pts.find((p) => p.label.toLowerCase() === it.reading!.point.toLowerCase()) : undefined;
    const vendor = cfg.key === "event" ? matchVendor(project, `${it.title} ${it.body}`) : null;
    const kind = pt ? "reading" : it.kind;
    return {
      id: uid("ev"),
      projectId: project.id,
      kind,
      lane: cfg.lanes.some((l) => l.key === it.lane) ? it.lane : cfg.lanes[0].key,
      title: pt ? `${pt.label} ${it.reading!.value}` : it.title,
      body: it.body !== it.title ? it.body : undefined,
      at: it.at ?? nowLocal(),
      dateKind: it.at ? it.date_kind : "approximate",
      source: it.source,
      authorId,
      links: [...linkedPeople, ...(pt ? [pt.id, pt.roomId] : []), ...(vendor ? [vendor.id] : [])],
      status: "candidate",
      category: cfg.key === "lease" && it.lane === "tenant" && !it.is_request ? "messages" : laneCategory[it.lane] ?? cfg.categories[0].key,
      amount: it.amount,
      data: pt ? { pointId: pt.id, value: it.reading!.value, isRequest: it.is_request } : { isRequest: it.is_request },
    } satisfies Evidence;
  });
}

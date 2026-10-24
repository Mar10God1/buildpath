import type { CategoryAccess, ChangeRequest, Evidence, Person, SharingLevel } from "./types";
import type { ProductConfig } from "./product";

/**
 * Per-person sharing, carried over from LifePath's /family-sharing:
 * - Private by default. Outside parties get a level; the team sees everything.
 * - Levels are presets over categories; Custom sets each category Off / Some / All.
 * - "Some" means hand-picked items plus anything the person is a participant in
 *   (linked to them, assigned to them, or authored by them) — that is "their slice".
 * - Never-shared categories (internal notes) are not part of any level.
 * - Projections drop private notes, and drop amounts unless the person can see money.
 */

export function isTeam(config: ProductConfig, person: Person | null) {
  if (!person) return true;
  return config.roles.find((r) => r.key === person.role)?.team ?? false;
}

export function accessMap(config: ProductConfig, person: Person | null): Record<string, CategoryAccess> {
  const all = Object.fromEntries(config.categories.map((c) => [c.key, "all" as CategoryAccess]));
  if (isTeam(config, person)) return all;
  const level: SharingLevel = person!.sharing?.level ?? defaultLevel(config, person!.role);
  const out: Record<string, CategoryAccess> = {};
  for (const c of config.categories) {
    if (config.neverShared.includes(c.key)) { out[c.key] = "off"; continue; }
    if (level === "custom") { out[c.key] = person!.sharing?.custom?.[c.key] ?? "off"; continue; }
    out[c.key] = config.levels[level].categories[c.key] ?? "off";
  }
  return out;
}

export function defaultLevel(config: ProductConfig, role: string): SharingLevel {
  return config.roles.find((r) => r.key === role)?.defaultLevel ?? "basics";
}

function participant(person: Person, item: { id: string; links?: string[]; authorId?: string; assigneeId?: string | null; requestedBy?: string | null }) {
  return Boolean(
    item.links?.includes(person.id) ||
    item.authorId === person.id ||
    item.assigneeId === person.id ||
    (item.requestedBy && item.requestedBy === person.name)
  );
}

export function canSee(config: ProductConfig, person: Person | null, category: string, item: Parameters<typeof participant>[1]) {
  if (isTeam(config, person)) return true;
  const access = accessMap(config, person)[category] ?? "off";
  if (access === "all") return true;
  if (access === "some") return participant(person!, item) || Boolean(person!.sharing?.picks?.includes(item.id));
  return false;
}

export function canSeeMoney(config: ProductConfig, person: Person | null) {
  return isTeam(config, person) || accessMap(config, person)[config.moneyCategory] !== "off";
}

/** What an outside viewer actually receives. Unconfirmed candidates never leave the team. */
export function projectEvidence(config: ProductConfig, person: Person | null, list: Evidence[]): Evidence[] {
  if (isTeam(config, person)) return list;
  const money = canSeeMoney(config, person);
  return list
    .filter((e) => e.status === "confirmed" && canSee(config, person, e.category, e))
    .map(({ privateNote: _p, ...e }) => ({ ...e, amount: money ? e.amount : undefined }));
}

export function projectRequests(config: ProductConfig, person: Person | null, list: ChangeRequest[]): ChangeRequest[] {
  if (isTeam(config, person)) return list;
  const money = canSeeMoney(config, person);
  return list
    .filter((r) => r.status !== "draft" && canSee(config, person, config.requestCategory, { id: r.id, links: r.sourceEvidenceIds, assigneeId: r.assigneeId, requestedBy: r.requestedBy }))
    .map((r) => (money ? r : { ...r, amount: null, lineItems: r.lineItems.map((li) => ({ ...li, unit_price: null, amount: null })) }));
}

/** One line per category for the "what will they see" preview. */
export function previewSummary(config: ProductConfig, person: Person) {
  const access = accessMap(config, person);
  return config.categories.map((c) => ({
    ...c,
    access: access[c.key],
    never: config.neverShared.includes(c.key),
  }));
}

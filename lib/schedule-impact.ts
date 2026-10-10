// Phase schedule + setback impact engine.
//
// Phases (activities) have planned dates and finish-to-start (FS) or
// start-to-start (SS) dependencies. Setbacks are events linked to the phase
// they hit, carrying reported schedule-impact days. We forward-pass the
// network to forecast every phase, then re-run it without a given setback to
// isolate exactly what that one setback pushed — and what it didn't.
//
// Days are calendar days. This is a transparent, evidence-based forecast from
// recorded impacts, not a resource-levelled CPM schedule.

export type Activity = {
  id: string; name: string; trade: string | null; sort_order: number;
  planned_start: string; planned_finish: string;
  actual_start: string | null; actual_finish: string | null;
  percent_complete: number; notes?: string | null;
};
export type Dependency = { id?: string; predecessor_id: string; successor_id: string; dependency_type: "FS" | "SS" | string; lag_days: number };
/** One setback hitting one phase. */
export type ImpactLink = { id?: string; event_id: string; activity_id: string; days: number };

export type Forecast = { start: number; finish: number; slip: number; ownDays: number; complete: boolean; started: boolean };
export type Outcome = "direct" | "pushed" | "absorbed" | "unaffected";

const DAY = 86400000;
export const toDay = (iso: string) => Math.round(Date.parse(iso.slice(0, 10) + "T12:00:00Z") / DAY);
export const fromDay = (n: number) => new Date(n * DAY).toISOString().slice(0, 10);

/** Topological order; anything caught in a cycle is appended in sort order so it still renders. */
export function topoOrder(activities: Activity[], deps: Dependency[]): Activity[] {
  const byId = new Map(activities.map(a => [a.id, a]));
  const indeg = new Map(activities.map(a => [a.id, 0]));
  const out = new Map<string, string[]>();
  for (const d of deps) {
    if (!byId.has(d.predecessor_id) || !byId.has(d.successor_id)) continue;
    indeg.set(d.successor_id, (indeg.get(d.successor_id) || 0) + 1);
    out.set(d.predecessor_id, [...(out.get(d.predecessor_id) || []), d.successor_id]);
  }
  const sorted = [...activities].sort((a, b) => a.sort_order - b.sort_order || a.planned_start.localeCompare(b.planned_start));
  const queue = sorted.filter(a => !indeg.get(a.id));
  const result: Activity[] = [];
  const seen = new Set<string>();
  while (queue.length) {
    const a = queue.shift()!;
    if (seen.has(a.id)) continue;
    seen.add(a.id); result.push(a);
    for (const s of out.get(a.id) || []) {
      indeg.set(s, (indeg.get(s) || 0) - 1);
      if (!indeg.get(s)) queue.push(byId.get(s)!);
    }
  }
  for (const a of sorted) if (!seen.has(a.id)) result.push(a);
  return result;
}

export function forecastSchedule(activities: Activity[], deps: Dependency[], impacts: ImpactLink[], excludeEventId?: string | null): Map<string, Forecast> {
  const result = new Map<string, Forecast>();
  const preds = new Map<string, Dependency[]>();
  for (const d of deps) preds.set(d.successor_id, [...(preds.get(d.successor_id) || []), d]);
  const own = new Map<string, number>();
  for (const i of impacts) if (i.event_id !== excludeEventId && i.days > 0) own.set(i.activity_id, (own.get(i.activity_id) || 0) + i.days);

  for (const a of topoOrder(activities, deps)) {
    const pStart = toDay(a.planned_start), pFinish = toDay(a.planned_finish);
    const duration = pFinish - pStart;
    const ownDays = own.get(a.id) || 0;
    if (a.actual_finish) {
      const finish = toDay(a.actual_finish);
      result.set(a.id, { start: a.actual_start ? toDay(a.actual_start) : pStart, finish, slip: finish - pFinish, ownDays, complete: true, started: true });
      continue;
    }
    let start = a.actual_start ? toDay(a.actual_start) : pStart;
    if (!a.actual_start) {
      for (const d of preds.get(a.id) || []) {
        const p = result.get(d.predecessor_id);
        if (!p) continue;
        const candidate = d.dependency_type === "SS" ? p.start + (d.lag_days || 0) : p.finish + 1 + (d.lag_days || 0);
        if (candidate > start) start = candidate;
      }
    }
    // An in-progress phase can't finish before it pushes through its remaining duration.
    let finish = start + duration + ownDays;
    if (a.actual_start) {
      for (const d of preds.get(a.id) || []) {
        const p = result.get(d.predecessor_id);
        if (p && d.dependency_type !== "SS") finish = Math.max(finish, p.finish + 1 + (d.lag_days || 0));
      }
    }
    result.set(a.id, { start, finish, slip: finish - pFinish, ownDays, complete: false, started: Boolean(a.actual_start) });
  }
  return result;
}

/** Phases reachable downstream of `fromId` through dependencies. */
export function downstreamOf(fromIds: string[], deps: Dependency[]): Set<string> {
  const out = new Map<string, string[]>();
  for (const d of deps) out.set(d.predecessor_id, [...(out.get(d.predecessor_id) || []), d.successor_id]);
  const seen = new Set<string>();
  const stack = [...fromIds];
  while (stack.length) {
    const id = stack.pop()!;
    for (const s of out.get(id) || []) if (!seen.has(s)) { seen.add(s); stack.push(s); }
  }
  return seen;
}

export type SetbackEffect = {
  eventId: string;
  directIds: string[];
  /** Additional days this setback adds to each phase's forecast finish. */
  delta: Map<string, number>;
  outcome: Map<string, Outcome>;
  /** Days of slack that soaked up the delay, for absorbed phases. */
  absorbed: Map<string, number>;
};

/** Isolates one setback: forecast with it vs. without it. */
export function setbackEffect(eventId: string, activities: Activity[], deps: Dependency[], impacts: ImpactLink[], base?: Map<string, Forecast>): SetbackEffect {
  const withIt = base || forecastSchedule(activities, deps, impacts);
  const without = forecastSchedule(activities, deps, impacts, eventId);
  const directIds = impacts.filter(i => i.event_id === eventId).map(i => i.activity_id);
  const eventDays = Math.max(0, ...impacts.filter(i => i.event_id === eventId).map(i => i.days));
  const downstream = downstreamOf(directIds, deps);
  const delta = new Map<string, number>();
  const outcome = new Map<string, Outcome>();
  const absorbed = new Map<string, number>();
  for (const a of activities) {
    const d = (withIt.get(a.id)?.finish ?? 0) - (without.get(a.id)?.finish ?? 0);
    delta.set(a.id, d);
    if (directIds.includes(a.id)) outcome.set(a.id, "direct");
    else if (d > 0) outcome.set(a.id, "pushed");
    else if (downstream.has(a.id)) { outcome.set(a.id, "absorbed"); absorbed.set(a.id, eventDays); }
    else outcome.set(a.id, "unaffected");
  }
  return { eventId, directIds, delta, outcome, absorbed };
}

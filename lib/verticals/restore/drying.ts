import type { Evidence, Project } from "../core/types";

// Drying documentation engine. Everything here is arithmetic in code, never in the model:
// the carrier pays on readings and equipment days, so those numbers must be reproducible.

export type Room = { id: string; name: string };
export type MoisturePoint = { id: string; roomId: string; label: string; material: string; goal: number };
export type Equipment = { id: string; type: string; tag: string; roomId: string; placedAt: string; removedAt: string | null };

const DAY = 86400000;
/** Timestamps are stored as floating local time ("YYYY-MM-DDTHH:MM:SS", no zone); do date math in UTC so days never shift. */
export const ts = (s: string) => Date.parse(s.length === 10 ? `${s}T00:00:00Z` : `${s.slice(0, 19)}Z`);
export const isoDay = (t: number | string) => (typeof t === "string" ? t.slice(0, 10) : new Date(t).toISOString().slice(0, 10));

export function rooms(p: Project): Room[] { return p.ext.rooms ?? []; }
export function points(p: Project): MoisturePoint[] { return p.ext.points ?? []; }
export function equipment(p: Project): Equipment[] { return p.ext.equipment ?? []; }

export function readings(evidence: Evidence[]) {
  return evidence
    .filter((e) => e.kind === "reading" && e.status === "confirmed" && typeof e.data?.pointId === "string")
    .map((e) => ({ id: e.id, pointId: e.data!.pointId as string, value: Number(e.data!.value), at: e.at, day: isoDay(e.at) }))
    .sort((a, b) => a.at.localeCompare(b.at));
}

export function dayRange(from: string, to: string) {
  const out: string[] = [];
  for (let t = ts(from.slice(0, 10)); t <= ts(to.slice(0, 10)); t += DAY) out.push(isoDay(t));
  return out;
}

export type PointStatus = {
  point: MoisturePoint;
  latest: number | null;
  atGoal: boolean;
  /** First day the point read at or below goal and stayed there. */
  dryDay: string | null;
  cells: Record<string, number | null>;
};

export function pointStatuses(p: Project, evidence: Evidence[]): { days: string[]; rows: PointStatus[] } {
  const rs = readings(evidence);
  const first = rs[0]?.day ?? p.ext.dateOfLoss ?? p.startDate;
  const last = rs[rs.length - 1]?.day ?? first;
  const days = dayRange(first, last);
  const rows = points(p).map((pt) => {
    const mine = rs.filter((r) => r.pointId === pt.id);
    const cells: Record<string, number | null> = Object.fromEntries(days.map((d) => [d, null]));
    for (const r of mine) cells[r.day] = r.value; // last reading of the day wins
    let dryDay: string | null = null;
    for (const r of mine) {
      if (r.value <= pt.goal) { dryDay ??= r.day; } else dryDay = null;
    }
    const latest = mine.length ? mine[mine.length - 1].value : null;
    return { point: pt, latest, atGoal: latest !== null && latest <= pt.goal, dryDay, cells };
  });
  return { days, rows };
}

/** A room is dry when every point in it is at goal; its dry day is the latest of its points' dry days. */
export function roomDryDay(roomId: string, rows: PointStatus[]) {
  const mine = rows.filter((r) => r.point.roomId === roomId);
  if (!mine.length || mine.some((r) => !r.dryDay)) return null;
  return mine.map((r) => r.dryDay!).sort().at(-1)!;
}

/** Billable equipment days: started 24-hour periods on site. */
export function equipmentDays(eq: Equipment, asOf: string) {
  const end = ts(eq.removedAt ?? asOf);
  return Math.max(1, Math.ceil((end - ts(eq.placedAt)) / DAY));
}

export type Finding = { severity: "risk" | "warn" | "ok"; title: string; detail: string };

/**
 * What an adjuster will challenge. Each finding is phrased as the dispute it heads off.
 */
export function dryingFindings(p: Project, evidence: Evidence[], asOf: string): Finding[] {
  const out: Finding[] = [];
  const { days, rows } = pointStatuses(p, evidence);
  const eq = equipment(p);

  // 1. Days with equipment running but no reading for a point in that room.
  for (const row of rows) {
    const roomEq = eq.filter((e) => e.roomId === row.point.roomId);
    const missing = days.filter((d) => {
      if (row.cells[d] !== null) return false;
      if (row.dryDay && d > row.dryDay) return false;
      return roomEq.some((e) => isoDay(e.placedAt) <= d && (!e.removedAt || isoDay(e.removedAt) >= d));
    });
    if (missing.length) {
      out.push({ severity: "risk", title: `No reading at ${row.point.label} on ${missing.length} day${missing.length > 1 ? "s" : ""}`, detail: `Equipment was running in ${roomName(p, row.point.roomId)} on ${missing.join(", ")} with no reading logged. Carriers often deny equipment days that have no reading behind them.` });
    }
  }

  // 2. Equipment left running more than a day after its room reached goal.
  for (const r of rooms(p)) {
    const dry = roomDryDay(r.id, rows);
    if (!dry) continue;
    for (const e of eq.filter((x) => x.roomId === r.id)) {
      const end = isoDay(e.removedAt ?? asOf);
      const extra = Math.round((ts(end) - ts(dry)) / DAY) - 1;
      if (extra > 0) out.push({ severity: "warn", title: `${e.type} ${e.tag} ran ${extra} day${extra > 1 ? "s" : ""} past dry`, detail: `${r.name} reached goal on ${dry}; ${e.type.toLowerCase()} ${e.tag} ${e.removedAt ? `was removed ${end}` : "is still on site"}. Expect the carrier to cut these days unless there's a note explaining why.` });
    }
  }

  // 3. Points never at goal yet.
  const wet = rows.filter((r) => !r.atGoal);
  if (wet.length) out.push({ severity: "warn", title: `${wet.length} point${wet.length > 1 ? "s" : ""} not at dry goal`, detail: wet.map((w) => `${w.point.label} (${w.latest ?? "no reading"} vs goal ${w.point.goal})`).join("; ") });

  // 4. Required documents.
  const has = (pred: (e: Evidence) => boolean) => evidence.some((e) => e.status === "confirmed" && pred(e));
  if (!has((e) => e.kind === "document" && /authori[sz]ation|work auth/i.test(e.title))) out.push({ severity: "risk", title: "No signed work authorization", detail: "Upload the signed work authorization / direction to pay. Without it the carrier may pay the homeowner directly." });
  if (!has((e) => e.lane === "carrier")) out.push({ severity: "warn", title: "No adjuster contact logged", detail: "Log the first call or email with the adjuster, with the date and what was agreed." });
  for (const r of rooms(p)) {
    if (!has((e) => e.kind === "photo" && e.links.includes(r.id))) out.push({ severity: "warn", title: `No photos for ${r.name}`, detail: "Add at least one before photo and one equipment-placement photo for each affected room." });
  }
  if (!out.some((f) => f.severity !== "ok")) out.push({ severity: "ok", title: "Documentation is complete", detail: "Every equipment day has a reading behind it and every room has photos." });
  return out;
}

export function readinessScore(findings: Finding[]) {
  const penalty = findings.reduce((s, f) => s + (f.severity === "risk" ? 20 : f.severity === "warn" ? 7 : 0), 0);
  return Math.max(0, 100 - penalty);
}

export function roomName(p: Project, id: string) {
  return rooms(p).find((r) => r.id === id)?.name ?? "Unknown room";
}

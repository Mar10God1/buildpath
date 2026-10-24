import type { DateKind, Evidence, EvidenceSource } from "./types";

/**
 * Trust weights are decision heuristics, not calibrated probabilities (LifePath evidence-policy).
 * An instrument reading or signed document outranks a remembered phone call; a person's own
 * correction outranks everything.
 */
export const EVIDENCE_WEIGHTS: Record<EvidenceSource, number> = {
  user_correction: 100,
  instrument: 98,
  signed_document: 99,
  carrier_record: 96,
  document: 94,
  photo_metadata: 90,
  email: 85,
  text_message: 82,
  call_note: 70,
  voice_note: 70,
  user: 70,
  inferred: 35,
};

export const SOURCE_LABELS: Record<EvidenceSource, string> = {
  user_correction: "Corrected by a person",
  instrument: "Meter / instrument",
  signed_document: "Signed document",
  carrier_record: "Carrier record",
  document: "Document",
  photo_metadata: "Photo timestamp",
  email: "Email",
  text_message: "Text message",
  call_note: "Call note",
  voice_note: "Voice note",
  user: "Entered by hand",
  inferred: "Inferred",
};

export const DATE_KIND_LABELS: Record<DateKind, string> = {
  exact: "Exact",
  approximate: "Approx.",
  inferred: "Inferred",
  unknown: "Date unknown",
};

export function evidenceScore(source: EvidenceSource) {
  return EVIDENCE_WEIGHTS[source] ?? 55;
}

/** Strength of a record for a dispute: source weight, discounted for soft dates and unconfirmed status. */
export function strength(e: Pick<Evidence, "source" | "dateKind" | "status">) {
  const dateFactor = { exact: 1, approximate: 0.85, inferred: 0.6, unknown: 0.5 }[e.dateKind];
  const statusFactor = e.status === "confirmed" ? 1 : 0.5;
  return Math.round(evidenceScore(e.source) * dateFactor * statusFactor);
}

export function strengthLabel(score: number) {
  if (score >= 85) return { label: "Strong", tone: "good" as const };
  if (score >= 60) return { label: "Supporting", tone: "ok" as const };
  return { label: "Weak", tone: "weak" as const };
}

/**
 * The LifePath rule: higher-supported evidence may replace a value, ties keep the existing one,
 * and a person's correction is never overwritten by anything automatic.
 */
export function evidenceWinner(current: { source: EvidenceSource } | null, incoming: { source: EvidenceSource }) {
  if (current?.source === "user_correction") return "keep" as const;
  return evidenceScore(incoming.source) > (current ? evidenceScore(current.source) : 0) ? ("replace" as const) : ("keep" as const);
}

/** Evidence that should never appear as fact until reviewed. */
export function needsReview(e: Evidence) {
  return e.status === "candidate";
}

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export const dayKey = (iso: string) => iso.slice(0, 10);

/** Current local time as a floating timestamp, matching how captures are stored. */
export function nowLocal(at: Date = new Date()) {
  const n = at;
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}T${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}`;
}
export const todayLocal = () => nowLocal().slice(0, 10);

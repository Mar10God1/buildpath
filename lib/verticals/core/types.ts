// Shared project-memory model used by every vertical.
// Lifted from BuildPath (projects, evidence, change orders, daily logs) and
// LifePath (date certainty, evidence weights, candidate-vs-confirmed, sharing levels).

export type ProductKey = "restore" | "lease" | "event";

/** LifePath: uncertainty is honest data. Never invent precision. */
export type DateKind = "exact" | "approximate" | "inferred" | "unknown";

/** Where a record came from. Weights live in evidence.ts. */
export type EvidenceSource =
  | "user_correction" | "instrument" | "photo_metadata" | "signed_document" | "document"
  | "carrier_record" | "text_message" | "email" | "call_note" | "voice_note" | "user" | "inferred";

export type EvidenceKind =
  | "photo" | "reading" | "note" | "voice" | "text" | "email" | "call" | "document" | "receipt" | "equipment" | "inspection" | "approval";

/**
 * Every captured thing is evidence. Capture once, link everywhere:
 * `links` connects it to rooms, units, vendors, requests, people, etc.
 */
export type Evidence = {
  id: string;
  projectId: string;
  kind: EvidenceKind;
  /** Swim lane on the timeline, product-specific (e.g. "drying", "carrier", "tenant", "vendor"). */
  lane: string;
  title: string;
  body?: string;
  at: string; // ISO timestamp
  dateKind: DateKind;
  source: EvidenceSource;
  authorId?: string;
  links: string[]; // ids of anything else in the project
  /** LifePath: AI and imports propose candidates; nothing becomes fact until a person confirms it. */
  status: "confirmed" | "candidate";
  /** Sharing category key; see sharing.ts. */
  category: string;
  /** Fields that are never projected to anyone but the team (notes, prices, addresses). */
  privateNote?: string;
  amount?: number | null;
  photo?: { hue: number; label: string };
  data?: Record<string, unknown>;
};

export type LineItem = { description: string; code?: string | null; quantity: number | null; unit: string | null; unit_price: number | null; amount: number | null };

/** BuildPath's change order, renamed per vertical (supplement, work order, change request). */
export type ChangeRequest = {
  id: string;
  projectId: string;
  number: number;
  title: string;
  description: string;
  reason: string;
  requestedBy: string | null;
  lineItems: LineItem[];
  amount: number | null;
  scheduleImpactDays: number | null;
  missingInfo: string[];
  status: "draft" | "sent" | "approved" | "declined";
  sourceText: string;
  sourceEvidenceIds: string[];
  aiModel: string | null;
  assigneeId?: string | null;
  history: { at: string; status: ChangeRequest["status"]; by: string; note?: string }[];
};

export type DailyLog = {
  id: string;
  projectId: string;
  date: string; // YYYY-MM-DD
  summary: string;
  sections: Record<string, string>;
  status: "draft" | "final";
  sourceEvidenceIds: string[];
  aiModel: string | null;
};

export type SharingLevel = "basics" | "standard" | "everything" | "custom";
export type CategoryAccess = "off" | "some" | "all";

export type Person = {
  id: string;
  projectId: string | null; // null = org staff
  name: string;
  role: string; // product role key
  org?: string;
  phone?: string;
  email?: string;
  /** Per-person sharing (LifePath). Team members see everything; outside parties get a level. */
  sharing?: { level: SharingLevel; custom?: Record<string, CategoryAccess>; picks?: string[] };
};

export type Project = {
  id: string;
  product: ProductKey;
  name: string;
  subtitle: string;
  address: string;
  status: string;
  startDate: string;
  /** Product-specific structured data (moisture points, units, vendors…). */
  ext: Record<string, any>;
};

export type ProductData = {
  projects: Project[];
  people: Person[];
  evidence: Evidence[];
  requests: ChangeRequest[];
  logs: DailyLog[];
};

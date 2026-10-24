import type { ProductConfig } from "../core/product";
import type { DateKind, EvidenceKind, EvidenceSource, LineItem } from "../core/types";

// The three AI jobs every vertical shares. Prompts and schemas live here so the API route
// and the no-key fallback return exactly the same shapes.

export type RequestDraft = {
  title: string;
  description: string;
  reason: string;
  requested_by: string | null;
  line_items: Omit<LineItem, "amount">[];
  schedule_impact_days: number | null;
  missing_info: string[];
};

export type LogDraft = { summary: string; sections: Record<string, string> };

export type CaptureItem = {
  kind: EvidenceKind;
  lane: string;
  title: string;
  body: string;
  at: string | null;
  date_kind: DateKind;
  source: EvidenceSource;
  amount: number | null;
  people: string[];
  reading: { point: string; value: number } | null;
  is_request: boolean;
};

export type AiContext = {
  projectName: string;
  projectSummary: string;
  people: { name: string; role: string }[];
  vendors?: string[];
  points?: string[];
  today: string;
};

export function requestPrompt(cfg: ProductConfig, ctx: AiContext, text: string) {
  return `${cfg.projectNoun}: ${ctx.projectName} — ${ctx.projectSummary}
People on this ${cfg.projectNoun.toLowerCase()}: ${ctx.people.map((p) => `${p.name} (${p.role})`).join(", ") || "none listed"}
${ctx.vendors?.length ? `Vendors: ${ctx.vendors.join(", ")}\n` : ""}
Draft a ${cfg.requestNoun.toLowerCase()} from this message. It may be a text, an email, or a voice note:
"""
${text.slice(0, 12000)}
"""

Rules:
${cfg.ai.requestRules}
- Only include a quantity or unit_price when the message states it; otherwise null. Do not estimate prices.
- requested_by: the person who asked, if named; otherwise null.
- schedule_impact_days: only if stated or clearly implied; otherwise null.`;
}

export const requestSchema = {
  properties: {
    title: { type: "string", description: "Short name for the request" },
    description: { type: "string", description: "Scope in 1-4 plain sentences" },
    reason: { type: "string", description: "Why this is happening and who asked" },
    requested_by: { type: ["string", "null"] },
    line_items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          code: { type: ["string", "null"] },
          quantity: { type: ["number", "null"] },
          unit: { type: ["string", "null"] },
          unit_price: { type: ["number", "null"] },
        },
        required: ["description", "code", "quantity", "unit", "unit_price"],
      },
    },
    schedule_impact_days: { type: ["integer", "null"] },
    missing_info: { type: "array", items: { type: "string" } },
  },
  required: ["title", "description", "reason", "requested_by", "line_items", "schedule_impact_days", "missing_info"],
};

export function logPrompt(cfg: ProductConfig, ctx: AiContext, date: string, records: string[]) {
  return `Write the daily log for ${ctx.projectName} (${ctx.projectSummary}) on ${date}.
These are the captures from that day, oldest first:

${records.join("\n\n")}

Each section is short plain sentences or "- " bullet lines. Use "None recorded." for a section with nothing in the captures.
Quote moisture readings exactly as recorded, with the point label.`;
}

export function logSchema(cfg: ProductConfig) {
  return {
    properties: {
      summary: { type: "string", description: "2-3 sentence overview of the day" },
      sections: {
        type: "object",
        properties: Object.fromEntries(cfg.dailyLog.sections.map((s) => [s.key, { type: "string", description: s.hint }])),
        required: cfg.dailyLog.sections.map((s) => s.key),
      },
    },
    required: ["summary", "sections"],
  };
}

export function capturePrompt(cfg: ProductConfig, ctx: AiContext, text: string) {
  return `${cfg.projectNoun}: ${ctx.projectName} — ${ctx.projectSummary}. Today is ${ctx.today}.
Known people: ${ctx.people.map((p) => `${p.name} (${p.role})`).join(", ") || "none"}
${ctx.points?.length ? `Moisture points: ${ctx.points.join(", ")}\n` : ""}${ctx.vendors?.length ? `Vendors: ${ctx.vendors.join(", ")}\n` : ""}
Split this into separate records, one per distinct fact, event or request:
"""
${text.slice(0, 12000)}
"""

Rules:
- lane must be one of: ${cfg.lanes.map((l) => `${l.key} (${l.label})`).join(", ")}.
- at: an ISO timestamp only if the text gives a date or time; combine a stated time with today's date. Otherwise null.
- date_kind: "exact" if date and time are stated, "approximate" if only roughly stated ("this morning", "last week"), "unknown" if not stated.
- source: text_message, email, call_note, voice_note, instrument (meter readings) or user.
- reading: only for moisture readings tied to a named point; otherwise null.
- is_request: true when someone is asking for added work, a repair, or an addition.
- people: names exactly as they appear, only people mentioned.`;
}

export function captureSchema(cfg: ProductConfig) {
  return {
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["note", "text", "email", "call", "reading", "photo", "receipt", "document", "equipment"] },
            lane: { type: "string", enum: cfg.lanes.map((l) => l.key) },
            title: { type: "string" },
            body: { type: "string" },
            at: { type: ["string", "null"] },
            date_kind: { type: "string", enum: ["exact", "approximate", "inferred", "unknown"] },
            source: { type: "string", enum: ["text_message", "email", "call_note", "voice_note", "instrument", "user"] },
            amount: { type: ["number", "null"] },
            people: { type: "array", items: { type: "string" } },
            reading: { type: ["object", "null"], properties: { point: { type: "string" }, value: { type: "number" } } },
            is_request: { type: "boolean" },
          },
          required: ["kind", "lane", "title", "body", "at", "date_kind", "source", "amount", "people", "reading", "is_request"],
        },
      },
    },
    required: ["items"],
  };
}

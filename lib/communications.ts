export type CommunicationKind = "sms" | "call";
export type CommunicationMeta = {
  version: 1; kind: CommunicationKind; direction: "inbound" | "outbound" | "imported";
  contact: string; phone: string; durationSeconds?: number; status?: string;
  providerId?: string; summary?: string; actions?: { title: string; type: "follow_up" | "scope_change"; detail: string }[];
  media?: { url: string; type: string }[];
};
export type Communication = { id: string; title: string; raw_text: string | null; occurred_at: string | null; metadata: CommunicationMeta };
export const COMMUNICATION_SOURCE = "path_communications";
export const phoneValid = (value: string) => /^\+[1-9]\d{7,14}$/.test(value);

export function parseCommunication(value: unknown): CommunicationMeta {
  if (!value || typeof value !== "object") throw new Error("Conversation details are required.");
  const v = value as Record<string, unknown>;
  if (v.kind !== "sms" && v.kind !== "call") throw new Error("Choose text or call.");
  if (!["inbound", "outbound", "imported"].includes(String(v.direction))) throw new Error("Choose a direction.");
  const contact = String(v.contact || "").trim().slice(0, 160);
  const phone = String(v.phone || "").trim();
  if (!contact) throw new Error("Enter a customer or client name.");
  if (phone && !phoneValid(phone)) throw new Error("Use a phone number with country code, such as +15125551234.");
  return { version: 1, kind: v.kind, direction: v.direction as CommunicationMeta["direction"], contact, phone };
}

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type PhoneRoute = { projectId: string; number: string; forwardTo?: string };
export function phoneRoutes(): PhoneRoute[] {
  try {
    const routes = JSON.parse(process.env.PATH_PHONE_ROUTES || "[]");
    if (!Array.isArray(routes)) return [];
    const valid = routes.filter((r: PhoneRoute) => r && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(r.projectId) && /^\+[1-9]\d{7,14}$/.test(r.number));
    if (new Set(valid.map((r: PhoneRoute) => r.number)).size !== valid.length) return [];
    return valid;
  } catch { return []; }
}
export function providerReady() {
  return process.env.PATH_PHONE_ENABLED === "true" && Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.PATH_PHONE_WEBHOOK_ORIGIN && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
export function verifyTwilio(url: string, params: URLSearchParams, signature: string | null, token: string) {
  if (!signature || !token) return false;
  const keys = [...new Set(params.keys())].sort();
  // Refuse ambiguous duplicate fields instead of validating a different payload.
  if (keys.some(k => params.getAll(k).length !== 1)) return false;
  const payload = url + keys.map(k => k + params.get(k)).join("");
  const expected = createHmac("sha1", token).update(payload).digest("base64");
  const a = Buffer.from(signature), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function providerEvidenceId(sid: string) {
  const hex = createHash("sha256").update("path-communications:twilio:" + sid).digest("hex");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
}
export function mediaProof(id: string, projectId: string, media: unknown) {
  return createHmac("sha256", process.env.TWILIO_AUTH_TOKEN || "").update(JSON.stringify([id, projectId, media])).digest("hex");
}
export const xmlEscape = (s: string) => s.replace(/[<>&"']/g, c => ({ "<":"&lt;", ">":"&gt;", "&":"&amp;", '"':"&quot;", "'":"&apos;" })[c]!);

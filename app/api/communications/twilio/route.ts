import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { COMMUNICATION_SOURCE } from "@/lib/communications";
import { phoneRoutes, providerReady, providerEvidenceId, verifyTwilio, xmlEscape, mediaProof } from "@/lib/communications-provider";

export const runtime = "nodejs";
const xml = (body: string) => new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, { headers: { "Content-Type": "text/xml" } });
export async function POST(req: NextRequest) {
  if (!providerReady()) return NextResponse.json({ error: "Phone connection is inactive." }, { status: 503 });
  const params = new URLSearchParams(await req.text());
  const origin = process.env.PATH_PHONE_WEBHOOK_ORIGIN!.replace(/\/$/, "");
  const canonical = origin + req.nextUrl.pathname + req.nextUrl.search;
  if (!verifyTwilio(canonical, params, req.headers.get("x-twilio-signature"), process.env.TWILIO_AUTH_TOKEN!) || params.get("AccountSid") !== process.env.TWILIO_ACCOUNT_SID) return new NextResponse("Forbidden", { status: 403 });
  const event = req.nextUrl.searchParams.get("event");
  const route = phoneRoutes().find(r => r.number === params.get(event === "sms_status" ? "From" : "To"));
  if (!route) return new NextResponse("Unrouted number", { status: 404 });
  const sms = Boolean(params.get("MessageSid"));
  const sid = params.get(sms ? "MessageSid" : "CallSid") || "";
  if (!/^(SM|MM|CA)[0-9a-f]{32}$/i.test(sid)) return new NextResponse("Invalid event", { status: 400 });
  const from = params.get("From") || "Unknown caller";
  const media = Array.from({ length: Math.min(10, Math.max(0, Number(params.get("NumMedia")) || 0)) }, (_, i) => ({ url: params.get(`MediaUrl${i}`), type: params.get(`MediaContentType${i}`) })).filter(m => m.url?.startsWith(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/`));
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  if (event === "sms_status" || event === "call_end") {
    const id = event === "sms_status" ? req.nextUrl.searchParams.get("record") : providerEvidenceId(sid);
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Invalid record", { status: 400 });
    const existing = await db.from("evidence").select("metadata").eq("id", id).eq("project_id", route.projectId).eq("source_system", COMMUNICATION_SOURCE).single();
    if (existing.error) return new NextResponse("Record not available", { status: 503 });
    const nextStatus = params.get(event === "sms_status" ? "MessageStatus" : "DialCallStatus") || "unknown";
    const terminal = ["delivered", "undelivered", "failed", "read"];
    if (!terminal.includes(existing.data.metadata?.status) || terminal.includes(nextStatus)) {
      const updated = await db.from("evidence").update({ metadata: { ...existing.data.metadata, status: nextStatus, ...(event === "call_end" ? { durationSeconds: Math.max(0,Number(params.get("DialCallDuration")) || 0) } : {}) } }).eq("id", id).eq("project_id", route.projectId);
      if (updated.error) return new NextResponse("Unable to update event", { status: 500 });
    }
    return event === "sms_status" ? new NextResponse(null, { status: 204 }) : xml("<Hangup/>");
  }
  const result = await db.from("evidence").upsert({ id: providerEvidenceId(sid), project_id: route.projectId, evidence_type: sms ? "text_message" : "call_log", title: `${sms ? "Text" : "Call"} · ${from}`, source_system: COMMUNICATION_SOURCE, raw_text: sms ? (params.get("Body") || (media.length ? "Media message" : "Empty message")) : "Incoming business call. Add notes or a transcript after the call.", metadata: { version: 1, kind: sms ? "sms" : "call", direction: "inbound", contact: from, phone: from, providerId: sid, status: params.get(sms ? "SmsStatus" : "CallStatus"), media, mediaProof: mediaProof(providerEvidenceId(sid), route.projectId, media) }, occurred_at: new Date().toISOString() }, { onConflict: "id", ignoreDuplicates: true });
  if (result.error) return new NextResponse("Unable to save event", { status: 500 });
  if (sms) return xml("");
  // Calling works on either mobile OS via forwarding; recording is deliberately off.
  if (route.forwardTo && /^\+[1-9]\d{7,14}$/.test(route.forwardTo) && route.forwardTo !== route.number) return xml(`<Dial timeout="25" action="${xmlEscape(origin + req.nextUrl.pathname + "?event=call_end")}" method="POST">${xmlEscape(route.forwardTo)}</Dial>`);
  return xml("<Say>This business line is not configured for calls yet.</Say><Hangup/>");
}

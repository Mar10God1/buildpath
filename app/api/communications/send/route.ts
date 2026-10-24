import { NextRequest, NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";
import { COMMUNICATION_SOURCE, phoneValid } from "@/lib/communications";
import { phoneRoutes, providerReady } from "@/lib/communications-provider";

export async function POST(req: NextRequest) {
  const auth = await supabaseForRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { projectId, phone, text, requestId } = await req.json();
    if (!phoneValid(String(phone)) || typeof text !== "string" || !text.trim() || text.length > 1600 || !/^[0-9a-f-]{36}$/i.test(requestId || "")) return NextResponse.json({ error: "Enter a valid number and message (maximum 1,600 characters)." }, { status: 400 });
    const access = await auth.supabase.rpc("project_permission_summary", { target_project: projectId });
    if (access.error || !access.data?.view_documents || !access.data?.upload_documents) return NextResponse.json({ error: "Access denied." }, { status: 403 });
    const route = phoneRoutes().find(r => r.projectId === projectId);
    if (!providerReady() || !route) return NextResponse.json({ error: "Connect a business phone provider before sending texts." }, { status: 503 });
    // Reserve the caller's request ID before contacting the provider. Replays never send twice.
    const metadata = { version: 1, kind: "sms", direction: "outbound", contact: phone, phone, status: "sending" };
    const claim = await auth.supabase.from("evidence").insert({ id: requestId, project_id: projectId, evidence_type: "text_message", title: `Text · ${phone}`, source_system: COMMUNICATION_SOURCE, raw_text: text.trim(), occurred_at: new Date().toISOString(), created_by: auth.user.id, metadata });
    if (claim.error) return NextResponse.json({ error: "This send request already exists or could not be saved. Check the conversation history before trying again." }, { status: 409 });
    let response: Response;
    try {
      response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, { method: "POST", headers: { Authorization: "Basic " + Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ From: route.number, To: phone, Body: text.trim(), StatusCallback: process.env.PATH_PHONE_WEBHOOK_ORIGIN!.replace(/\/$/, "") + "/api/communications/twilio?event=sms_status&record=" + requestId }), signal: AbortSignal.timeout(15000) });
    } catch {
      await auth.supabase.from("evidence").update({ metadata: { ...metadata, status: "delivery_unknown" } }).eq("id", requestId).eq("project_id", projectId).eq("metadata->>status", "sending");
      return NextResponse.json({ error: "Delivery is unconfirmed. Check your provider before sending again." }, { status: 502 });
    }
    const payload = await response.json();
    // Do not overwrite a callback that arrived while the provider request was in flight.
    const saved = await auth.supabase.from("evidence").update({ metadata: { ...metadata, status: response.ok ? payload.status || "queued" : "failed", providerId: response.ok ? payload.sid : undefined } }).eq("id", requestId).eq("project_id", projectId).eq("metadata->>status", "sending").select("id");
    if (saved.error) return NextResponse.json({ error: "The provider processed this request, but its status could not be saved. Check your provider before sending again." }, { status: 502 });
    if (!response.ok) return NextResponse.json({ error: "The provider rejected this message. Check number registration and recipient opt-in." }, { status: 502 });
    return NextResponse.json({ id: requestId, status: payload.status || "queued" });
  } catch { return NextResponse.json({ error: "Unable to process this message." }, { status: 500 }); }
}

import { NextRequest, NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";
import { COMMUNICATION_SOURCE, parseCommunication } from "@/lib/communications";
import { phoneRoutes, providerReady } from "@/lib/communications-provider";

export async function GET(req: NextRequest) {
  const auth = await supabaseForRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "Select a project." }, { status: 400 });
  const access = await auth.supabase.rpc("project_permission_summary", { target_project: projectId });
  if (access.error || !access.data?.view_documents) return NextResponse.json({ error: "Access denied." }, { status: 403 });
  const rows = await auth.supabase.from("evidence").select("id,title,raw_text,occurred_at,metadata").eq("project_id", projectId).eq("source_system", COMMUNICATION_SOURCE).order("occurred_at", { ascending: false }).limit(200);
  if (rows.error) return NextResponse.json({ error: "Unable to load conversations." }, { status: 500 });
  const route = phoneRoutes().find(r => r.projectId === projectId);
  return NextResponse.json({ conversations: rows.data, canEdit: Boolean(access.data.upload_documents), canPromote: Boolean(access.data.edit_timeline), connected: Boolean(providerReady() && route), businessNumber: providerReady() ? route?.number : null });
}

export async function POST(req: NextRequest) {
  const auth = await supabaseForRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const meta = parseCommunication(body.metadata);
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const date = new Date(body.occurredAt);
    if (!body.projectId || !text || text.length > 50000 || !Number.isFinite(date.getTime())) throw new Error("Enter a conversation, valid date and project (maximum 50,000 characters).");
    const access = await auth.supabase.rpc("project_permission_summary", { target_project: body.projectId });
    if (access.error || !access.data?.upload_documents || !access.data?.view_documents) return NextResponse.json({ error: "Access denied." }, { status: 403 });
    const saved = await auth.supabase.from("evidence").insert({ project_id: body.projectId, evidence_type: meta.kind === "call" ? "call_transcript" : "text_message", title: `${meta.kind === "call" ? "Call" : "Text"} · ${meta.contact}`, raw_text: text, occurred_at: date.toISOString(), source_system: COMMUNICATION_SOURCE, created_by: auth.user.id, metadata: meta }).select("id").single();
    if (saved.error) return NextResponse.json({ error: "Unable to save this conversation." }, { status: 500 });
    return NextResponse.json({ id: saved.data.id }, { status: 201 });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid conversation." }, { status: 400 }); }
}

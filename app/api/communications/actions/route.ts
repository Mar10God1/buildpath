import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";
import { COMMUNICATION_SOURCE } from "@/lib/communications";

export async function POST(req: NextRequest) {
  const auth = await supabaseForRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { projectId, evidenceId, index } = await req.json();
    if (!Number.isInteger(index) || index < 0 || index > 4) return NextResponse.json({ error: "Invalid suggestion." }, { status: 400 });
    const access = await auth.supabase.rpc("project_permission_summary", { target_project: projectId });
    if (access.error || !access.data?.view_documents || !access.data?.edit_timeline) return NextResponse.json({ error: "Access denied." }, { status: 403 });
    const row = await auth.supabase.from("evidence").select("metadata,occurred_at,title").eq("id", evidenceId).eq("project_id", projectId).eq("source_system", COMMUNICATION_SOURCE).single();
    const action = row.data?.metadata?.actions?.[index];
    if (row.error || !action) return NextResponse.json({ error: "Suggestion not found." }, { status: 404 });
    const hex = createHash("sha256").update(`${evidenceId}:${action.type}:${action.title}:${action.detail}`).digest("hex");
    const id = `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
    const result = await auth.supabase.from("project_events").upsert({ id, project_id: projectId, event_type: action.type === "scope_change" ? "change" : "task", title: action.title, description: `${action.detail}\n\nSource: ${row.data!.title} (evidence ${evidenceId}). Suggested from a conversation; scope and pricing require separate approval.`, status: "pending", start_at: null, date_precision: "unknown", cost_impact: null, schedule_impact_days: null, created_by: auth.user.id }, { onConflict: "id", ignoreDuplicates: true });
    if (result.error) throw result.error;
    return NextResponse.json({ id });
  } catch { return NextResponse.json({ error: "Unable to save this suggested action." }, { status: 500 }); }
}

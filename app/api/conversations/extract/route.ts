import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";
import { aiConfigured, claudeStructured } from "@/lib/ai/claude";
import { CONVERSATION_SYSTEM, MAX_TRANSCRIPT_LENGTH, conversationSchema, validateConversationActions } from "@/lib/conversation-intelligence";

export const runtime = "nodejs";
export const maxDuration = 60;
function stableId(value: string) {
  const h = createHash("sha256").update(value).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export async function POST(req: NextRequest) {
  const auth = await supabaseForRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { supabase, user } = auth;
  let jobId: string | null = null;
  try {
    const body = await req.json();
    if (typeof body.evidenceId !== "string" || !/^[\da-f-]{36}$/i.test(body.evidenceId)) return NextResponse.json({ error: "Choose saved conversation evidence." }, { status: 400 });
    const evidence = await supabase.from("evidence").select("id,project_id,raw_text,metadata,storage_path").eq("id", body.evidenceId).single();
    if (evidence.error || !evidence.data) return NextResponse.json({ error: "Conversation unavailable." }, { status: 403 });
    const e = evidence.data;
    const permission = await supabase.rpc("project_permission_summary", { target_project: e.project_id });
    if (permission.error || !permission.data?.upload_documents || !permission.data?.view_documents) return NextResponse.json({ error: "You cannot process evidence for this project." }, { status: 403 });
    if (e.metadata?.source !== "conversation_intelligence" || e.metadata?.transcript_reviewed !== true) return NextResponse.json({ error: "Review and save the transcript before extraction." }, { status: 400 });
    const text = (e.raw_text || "").trim();
    if (text.length < 5 || text.length > MAX_TRANSCRIPT_LENGTH) return NextResponse.json({ error: "Transcript must contain 5–24,000 characters." }, { status: 400 });
    const id = stableId(`conversation-v1:${e.id}:${text}`);
    const existing = await supabase.from("ingestion_jobs").select("id,status,created_at").eq("id", id).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data && ["needs_review", "complete"].includes(existing.data.status)) {
      const count = await supabase.from("extraction_candidates").select("id", { count: "exact", head: true }).eq("job_id", id);
      if (count.error) throw count.error;
      return NextResponse.json({ jobId: id, candidateCount: count.count || 0, alreadyProcessed: true });
    }
    if (!aiConfigured()) return NextResponse.json({ error: "Transcript is saved. AI extraction is not configured on this deployment." }, { status: 503 });
    if (existing.data?.status === "processing" && Date.now() - new Date(existing.data.created_at).getTime() < 120000) return NextResponse.json({ error: "This conversation is already being processed. Try again shortly." }, { status: 409 });
    // Stable job ID prevents concurrent requests from creating duplicate review items.
    const claim = existing.data
      ? await supabase.from("ingestion_jobs").update({ status: "processing", created_at: new Date().toISOString() }).eq("id", id).eq("status", existing.data.status).eq("created_at", existing.data.created_at).select("id").maybeSingle()
      : await supabase.from("ingestion_jobs").insert({ id, project_id: e.project_id, evidence_id: e.id,
        storage_path: e.storage_path || `conversation://${e.id}`, file_name: "conversation-transcript.txt", mime_type: "text/plain", status: "processing", created_by: user.id }).select("id").single();
    if (claim.error?.code === "23505" || (!claim.error && !claim.data)) return NextResponse.json({ error: "This conversation is already being processed." }, { status: 409 });
    if (claim.error) throw claim.error;
    jobId = id;
    const output = await claudeStructured<unknown>({ system: CONVERSATION_SYSTEM, prompt: `Conversation transcript:\n<transcript>\n${text}\n</transcript>`,
      toolName: "extract_conversation_drafts", toolDescription: "Propose evidence-backed information for automation review.", schema: conversationSchema, maxTokens: 5000 });
    const actions = validateConversationActions(output, text);
    if (actions.length) {
      const candidates = await supabase.from("extraction_candidates").upsert(actions.map((action, i) => ({
        id: stableId(`${id}:action:${i}`), job_id: id, project_id: e.project_id, candidate_type: "document_fact",
        candidate_key: `conversation:${action.kind}`, confidence: null, status: "pending",
        proposed_value: { ...action, evidence_id: e.id, source: "conversation_intelligence", description: action.source_quote,
          status: "draft", automation: { kind: action.kind, state: "draft", requires_confirmation: true, fields: action.fields } },
      })), { onConflict: "id", ignoreDuplicates: true });
      if (candidates.error) throw candidates.error;
    }
    const done = await supabase.from("ingestion_jobs").update({ status: actions.length ? "needs_review" : "complete", extracted_text: text,
      extracted_metadata: { source: "conversation_intelligence", candidate_count: actions.length, execution_enabled: false }, completed_at: new Date().toISOString() }).eq("id", id);
    if (done.error) throw done.error;
    return NextResponse.json({ jobId: id, candidateCount: actions.length });
  } catch (error) {
    if (jobId) await supabase.from("ingestion_jobs").update({ status: "failed" }).eq("id", jobId);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Extraction failed. Your saved transcript is available for retry." }, { status: 500 });
  }
}

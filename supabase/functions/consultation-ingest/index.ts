import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

type Workstream = { key: string; label: string };

// Generic signals that work for most implementations (Salesforce, NetSuite, HubSpot, ServiceNow, custom builds, …).
// Each is matched against the engagement's own workstream names, so custom workstreams still get sensible routing.
const GENERIC_SIGNALS: { pattern: RegExp; hints: RegExp }[] = [
  { pattern: /integration|import|export|api|migration|migrate|data load|connector|feed|interface|extract|file/i, hints: /data|integration|migration|interface/i },
  { pattern: /report|dashboard|analytics|kpi|variance|metric/i, hints: /report|analytic|dashboard|insight/i },
  { pattern: /uat|user acceptance|test|testing|test script|defect|bug/i, hints: /test|uat|quality|qa/i },
  { pattern: /training|train|go.?live|cutover|launch|hypercare|adoption|change management/i, hints: /train|go.?live|launch|cutover|adoption|change/i },
  { pattern: /requirement|design|discovery|workshop|process map|blueprint|solution design/i, hints: /design|discovery|requirement|blueprint/i },
  { pattern: /configur|build|setup|set up|workflow|field|object|module|customi[sz]/i, hints: /config|build|setup|develop/i },
];

const STOP = new Set(["and", "the", "for", "with", "data", "phase"]);

function workstreamFor(sentence: string, streams: Workstream[]) {
  if (!streams.length) return "general";
  // 1. The sentence names one of the engagement's own workstreams (e.g. "CPQ", "Order-to-cash", "Payroll").
  for (const w of streams) {
    const words = w.label.toLowerCase().split(/[^a-z0-9]+/).filter(x => x.length > 2 && !STOP.has(x));
    if (words.some(x => new RegExp("\\b" + x, "i").test(sentence))) return w.key;
  }
  // 2. A generic signal points at a workstream whose name fits that kind of work.
  for (const g of GENERIC_SIGNALS) {
    if (!g.pattern.test(sentence)) continue;
    const hit = streams.find(w => g.hints.test(w.label) || g.hints.test(w.key));
    if (hit) return hit.key;
  }
  // 3. Fall back to the first workstream; the consultant can change it in the Review Inbox.
  return streams[0].key;
}

function milestoneTitle(s: string) {
  const clean = s.replace(/^(we|client|customer|finance|team)\s+/i, "").replace(/[.!?]+$/, "").trim();
  return clean.length > 74 ? clean.slice(0, 71) + "…" : clean;
}

function dateFrom(s: string) {
  const iso = s.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso) return iso[1] + "-" + iso[2].padStart(2, "0") + "-" + iso[3].padStart(2, "0");
  return "";
}

function extract(text: string, evidenceId: string, meetingDate: string | null, streams: Workstream[]) {
  const sentences = text.replace(/\r/g, " ").split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(s => s.length > 18);
  const rules = [
    { subtype: "milestone", test: /\b(approved|approval|complete|completed|sign.?off|signed off|ready|validated|validation|delivered|delivery|configured|built|tested|uat|training|go.?live readiness)\b/i, title: "Suggested milestone" },
    { subtype: "change", test: /\b(add|change|expand|include|new requirement|out of scope|scope)\b/i, title: "Possible scope change" },
    { subtype: "decision", test: /\b(decided|agreed|approved|decision|we will use|go with)\b/i, title: "Possible decision" },
    { subtype: "dependency", test: /\b(client|customer|they|their team|team)\b.*\b(provide|send|deliver|upload|confirm|approve|owe|waiting)\b/i, title: "Possible client dependency" },
    { subtype: "commitment", test: /\b(i will|we will|we'll|by friday|by monday|by next|commit|follow up)\b/i, title: "Possible commitment" },
    { subtype: "risk", test: /\b(risk|delay|blocked|blocker|issue|concern|slip|late)\b/i, title: "Possible risk" },
  ];

  const seen = new Set<string>();
  const out: any[] = [];
  for (const sentence of sentences) {
    for (const rule of rules) {
      if (!rule.test.test(sentence)) continue;
      const key = rule.subtype + "|" + sentence.toLowerCase();
      if (seen.has(key)) break;
      seen.add(key);
      const milestone = rule.subtype === "milestone";
      out.push({
        candidate_type: milestone ? "requirement" : rule.subtype === "commitment" ? "commitment" : "event",
        candidate_key: rule.subtype,
        confidence: milestone ? 0.84 : 0.72,
        proposed_value: {
          subtype: rule.subtype,
          title: milestone ? milestoneTitle(sentence) : rule.title,
          description: sentence,
          source_quote: sentence,
          date: meetingDate?.slice(0, 10) || null,
          evidence_id: evidenceId,
          schedule_impact_days: 0,
          cost_impact: 0,
          status: milestone ? "not_started" : "open",
          workstream_key: milestone ? workstreamFor(sentence, streams) : undefined,
          target_date: milestone ? dateFrom(sentence) : undefined,
          owner: "",
          scope_origin: milestone && /\b(add|new|extra|additional|phase one instead|wasn't|was not|not in scope)\b/i.test(sentence) ? "added" : "original",
        },
      });
      break;
    }
  }
  return out.slice(0, 20);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Missing authorization" }, 401);

  const publishableKeys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}");
  const publishable = publishableKeys.default || Deno.env.get("SUPABASE_ANON_KEY");
  const url = Deno.env.get("SUPABASE_URL");
  if (!url || !publishable) return json({ error: "Function environment is not configured" }, 500);

  const supabase = createClient(url, publishable, { global: { headers: { Authorization: auth } } });
  const token = auth.replace(/^Bearer\s+/i, "");
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "Unauthorized" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const evidenceId = body?.evidence_id;
  if (!evidenceId) return json({ error: "evidence_id is required" }, 400);

  const { data: evidence, error: evidenceError } = await supabase
    .from("evidence")
    .select("id,project_id,title,raw_text,occurred_at")
    .eq("id", evidenceId)
    .single();
  if (evidenceError || !evidence) return json({ error: evidenceError?.message || "Evidence not found" }, 404);
  if (!evidence.raw_text?.trim()) return json({ error: "Evidence has no transcript text" }, 422);

  const existing = await supabase
    .from("ingestion_jobs")
    .select("id,status")
    .eq("evidence_id", evidence.id)
    .maybeSingle();
  if (existing.data) return json({ job_id: existing.data.id, status: existing.data.status, duplicate: true });

  const { data: job, error: jobError } = await supabase
    .from("ingestion_jobs")
    .insert({
      project_id: evidence.project_id,
      evidence_id: evidence.id,
      storage_path: "inline/" + evidence.id,
      file_name: (evidence.title || "meeting") + ".txt",
      mime_type: "text/plain",
      status: "processing",
      extracted_text: evidence.raw_text.trim(),
      extracted_metadata: { source: "meeting", processor: "consultation-ingest-v2" },
      created_by: userData.user.id,
    })
    .select("id")
    .single();

  if (jobError || !job) return json({ error: jobError?.message || "Could not create ingestion job" }, 500);

  const streamRows = await supabase
    .from("project_requirements")
    .select("requirement_key,label,enabled")
    .eq("project_id", evidence.project_id)
    .like("requirement_key", "cp_scope_%")
    .order("created_at");
  const streams: Workstream[] = (streamRows.data || [])
    .filter(r => r.enabled)
    .map(r => ({ key: String(r.requirement_key).slice("cp_scope_".length), label: r.label || "" }));

  const candidates = extract(evidence.raw_text.trim(), evidence.id, evidence.occurred_at, streams)
    .map(c => ({ ...c, job_id: job.id, project_id: evidence.project_id }));

  if (candidates.length) {
    const { error: candidateError } = await supabase.from("extraction_candidates").insert(candidates);
    if (candidateError) {
      await supabase.from("ingestion_jobs").update({ status: "failed", error_message: candidateError.message }).eq("id", job.id);
      return json({ error: candidateError.message }, 500);
    }
  }

  await supabase.from("ingestion_jobs").update({
    status: candidates.length ? "needs_review" : "complete",
    completed_at: candidates.length ? null : new Date().toISOString(),
    extracted_metadata: { source: "meeting", processor: "consultation-ingest-v2", candidate_count: candidates.length },
  }).eq("id", job.id);

  return json({ job_id: job.id, candidate_count: candidates.length, status: candidates.length ? "needs_review" : "complete" });
});

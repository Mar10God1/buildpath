import { NextRequest, NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";
import { BUILDER_SYSTEM, CLAUDE_MODEL, aiConfigured, claudeStructured } from "@/lib/ai/claude";

export const runtime = "nodejs";
export const maxDuration = 60;

type Submission = {
  id: string; submission_type: string; title: string | null; notes: string | null; transcript: string | null;
  media_type: string | null; storage_path: string | null; amount: number | null; vendor_name: string | null;
  occurred_at: string | null; created_at: string;
};
type LogDraft = {
  summary: string; work_completed: string; deliveries: string; issues: string;
  safety: string; weather: string; open_items: string;
};

const LABELS: Record<string, string> = {
  progress: "Progress photo", receipt: "Receipt", invoice: "Invoice", incident: "Incident", safety: "Safety observation",
  delivery: "Delivery", voice_note: "Voice note", other: "Note",
};

/**
 * POST { projectId, logDate: "YYYY-MM-DD", dayStart: ISO, dayEnd: ISO }
 * Writes (or rewrites) a draft daily log for that job/day from the day's field captures.
 * dayStart/dayEnd come from the browser so "today" matches the builder's local time.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await supabaseForRequest(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!aiConfigured()) return NextResponse.json({ error: "AI is not configured yet. Add ANTHROPIC_API_KEY to the BuildPath environment variables." }, { status: 503 });
    const { supabase, user } = auth;
    const { projectId, logDate, dayStart, dayEnd } = await req.json();
    if (!projectId || !/^\d{4}-\d{2}-\d{2}$/.test(logDate || "") || !dayStart || !dayEnd) {
      return NextResponse.json({ error: "projectId, logDate, dayStart and dayEnd are required" }, { status: 400 });
    }

    const existing = await supabase.from("daily_logs").select("id,status").eq("project_id", projectId).eq("log_date", logDate).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data?.status === "final") {
      return NextResponse.json({ error: "This day's log is already finalized. Reopen it as a draft to regenerate." }, { status: 409 });
    }

    const project = await supabase.from("projects").select("name,city,state,project_type").eq("id", projectId).single();
    if (project.error) throw project.error;

    const subs = await supabase
      .from("field_submissions")
      .select("id,submission_type,title,notes,transcript,media_type,storage_path,amount,vendor_name,occurred_at,created_at")
      .eq("project_id", projectId)
      .gte("created_at", dayStart)
      .lt("created_at", dayEnd)
      .order("created_at", { ascending: true });
    if (subs.error) throw subs.error;
    const rows = (subs.data || []) as Submission[];
    if (!rows.length) {
      return NextResponse.json({ error: "No field captures for this day yet. Capture photos, voice notes or receipts first." }, { status: 422 });
    }

    // Let Claude see up to 8 of the day's photos via short-lived signed URLs.
    const images: string[] = [];
    const photoNumber = new Map<string, number>();
    for (const r of rows) {
      if (images.length >= 8) break;
      if (r.storage_path && (r.media_type || "").startsWith("image/")) {
        const signed = await supabase.storage.from("field-capture").createSignedUrl(r.storage_path, 600);
        if (signed.data?.signedUrl) {
          images.push(signed.data.signedUrl);
          photoNumber.set(r.id, images.length);
        }
      }
    }

    const records = rows.map((r, i) => {
      const photo = photoNumber.get(r.id);
      const time = new Date(r.occurred_at || r.created_at).toISOString();
      const parts = [
        `#${i + 1} ${LABELS[r.submission_type] || r.submission_type} at ${time}`,
        r.title && `Title: ${r.title}`,
        (r.transcript || r.notes) && `Notes: ${r.transcript || r.notes}`,
        r.vendor_name && `Vendor: ${r.vendor_name}`,
        r.amount != null && `Amount: $${r.amount}`,
        photo ? `Photo: attached image ${photo}` : r.media_type && `Attachment: ${r.media_type} (not shown)`,
      ].filter(Boolean);
      return parts.join("\n");
    });

    const p = project.data;
    const draft = await claudeStructured<LogDraft>({
      system: BUILDER_SYSTEM,
      toolName: "write_daily_log",
      toolDescription: "Record the daily log for this job and day.",
      images,
      prompt: `Write the daily log for ${p.name}${p.city ? ` (${[p.city, p.state].filter(Boolean).join(", ")})` : ""} on ${logDate}.
These are the field captures from that day, oldest first.${images.length ? ` ${images.length} photo(s) are attached as images 1-${images.length}; each capture says which image is its photo.` : ""}

${records.join("\n\n")}

Each section should be short plain sentences or "- " bullet lines. Use "None recorded." for a section with nothing in the captures.
Weather: only if the captures mention or clearly show it; otherwise "Not recorded."`,
      schema: {
        properties: {
          summary: { type: "string", description: "2-3 sentence overview of the day on this job" },
          work_completed: { type: "string", description: "Work performed and progress made" },
          deliveries: { type: "string", description: "Materials delivered and purchases (vendor and amount when given)" },
          issues: { type: "string", description: "Problems, delays, incidents, damage or client requests" },
          safety: { type: "string", description: "Safety observations or incidents" },
          weather: { type: "string", description: "Weather conditions if recorded" },
          open_items: { type: "string", description: "Follow-ups someone needs to act on" },
        },
        required: ["summary", "work_completed", "deliveries", "issues", "safety", "weather", "open_items"],
      },
    });

    const saved = await supabase
      .from("daily_logs")
      .upsert(
        {
          project_id: projectId,
          log_date: logDate,
          ...draft,
          status: "draft",
          source_submission_ids: rows.map((r) => r.id),
          ai_generated: true,
          ai_model: CLAUDE_MODEL,
          created_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "project_id,log_date" }
      )
      .select("*")
      .single();
    if (saved.error) throw saved.error;
    return NextResponse.json({ log: saved.data, captureCount: rows.length, photoCount: images.length });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Could not write the daily log" }, { status: 500 });
  }
}

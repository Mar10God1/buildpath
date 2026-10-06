import { NextRequest, NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";
import { BUILDER_SYSTEM, CLAUDE_MODEL, aiConfigured, claudeStructured } from "@/lib/ai/claude";

export const runtime = "nodejs";
export const maxDuration = 60;

type LineItem = { description: string; quantity: number | null; unit: string | null; unit_price: number | null };
type CODraft = {
  title: string;
  description: string;
  reason: string;
  requested_by: string | null;
  line_items: LineItem[];
  schedule_impact_days: number | null;
  missing_info: string[];
};

/**
 * POST { projectId, sourceText, evidenceIds?: string[] }
 * Turns a client text, email or voice-note transcript into a draft change order.
 * The draft is saved with status "draft" for the builder to review, price and send.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await supabaseForRequest(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!aiConfigured()) return NextResponse.json({ error: "AI is not configured yet. Add ANTHROPIC_API_KEY to the BuildPath environment variables." }, { status: 503 });
    const { supabase, user } = auth;
    const { projectId, sourceText, evidenceIds } = await req.json();
    const text = String(sourceText || "").trim();
    if (!projectId || text.length < 5) return NextResponse.json({ error: "Paste or record what was asked for first." }, { status: 400 });

    const project = await supabase.from("projects").select("name,project_type,client_id").eq("id", projectId).single();
    if (project.error) throw project.error;

    const draft = await claudeStructured<CODraft>({
      system: BUILDER_SYSTEM,
      toolName: "draft_change_order",
      toolDescription: "Record a draft change order for the builder to review.",
      prompt: `Job: ${project.data.name}${project.data.project_type ? ` (${project.data.project_type})` : ""}

Draft a change order from this request. It may be a client text, an email, or a voice note from the field:
"""
${text.slice(0, 12000)}
"""

Rules:
- Split the work into clear line items a homeowner can understand.
- Only include a quantity or unit_price when the request states it; otherwise use null. Do not estimate prices.
- requested_by: the person who asked, if named; otherwise null.
- schedule_impact_days: only if stated or clearly implied; otherwise null.
- missing_info: what the builder still needs to confirm before sending (pricing, specs, finish selections, etc.).`,
      schema: {
        properties: {
          title: { type: "string", description: "Short name, e.g. 'Add outlet in kitchen island'" },
          description: { type: "string", description: "Scope of the change in 1-4 plain sentences" },
          reason: { type: "string", description: "Why the change is happening (client request, hidden condition, code, etc.)" },
          requested_by: { type: ["string", "null"] },
          line_items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                description: { type: "string" },
                quantity: { type: ["number", "null"] },
                unit: { type: ["string", "null"], description: "ea, lf, sf, hr, ls…" },
                unit_price: { type: ["number", "null"] },
              },
              required: ["description", "quantity", "unit", "unit_price"],
            },
          },
          schedule_impact_days: { type: ["integer", "null"] },
          missing_info: { type: "array", items: { type: "string" } },
        },
        required: ["title", "description", "reason", "requested_by", "line_items", "schedule_impact_days", "missing_info"],
      },
    });

    // Do the arithmetic in code, never in the model.
    const items = (draft.line_items || []).map((li) => {
      const qty = li.quantity ?? (li.unit_price != null ? 1 : null);
      const amount = qty != null && li.unit_price != null ? Math.round(qty * li.unit_price * 100) / 100 : null;
      return { ...li, quantity: qty, amount };
    });
    const fullyPriced = items.length > 0 && items.every((li) => li.amount != null);
    const total = fullyPriced ? items.reduce((s, li) => s + (li.amount as number), 0) : null;

    const next = await supabase.rpc("next_change_order_number", { p_project_id: projectId });
    if (next.error) throw next.error;

    const saved = await supabase
      .from("change_orders")
      .insert({
        project_id: projectId,
        client_id: project.data.client_id || null,
        number: next.data as number,
        title: draft.title,
        description: draft.description + (draft.missing_info?.length ? "\n\nTo confirm before sending:\n- " + draft.missing_info.join("\n- ") : ""),
        reason: draft.reason,
        requested_by: draft.requested_by,
        line_items: items,
        amount: total,
        schedule_impact_days: draft.schedule_impact_days,
        status: "draft",
        source_text: text,
        source_evidence_ids: Array.isArray(evidenceIds) ? evidenceIds : [],
        ai_generated: true,
        ai_model: CLAUDE_MODEL,
        created_by: user.id,
      })
      .select("*")
      .single();
    if (saved.error) throw saved.error;
    return NextResponse.json({ changeOrder: saved.data, missingInfo: draft.missing_info || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Could not draft the change order" }, { status: 500 });
  }
}

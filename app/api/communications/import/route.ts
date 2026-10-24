import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";
import { COMMUNICATION_SOURCE } from "@/lib/communications";
import { parsePhoneImport } from "@/lib/phone-import";

export async function POST(req: NextRequest) {
  const auth = await supabaseForRequest(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { projectId, records, device } = await req.json();
    if (!["iphone","android"].includes(device) || !Array.isArray(records) || !records.length || records.length > 500) throw new Error("Choose a device and up to 500 records.");
    const access = await auth.supabase.rpc("project_permission_summary", { target_project: projectId });
    if (access.error || !access.data?.view_documents || !access.data?.upload_documents) return NextResponse.json({ error: "Access denied." }, { status: 403 });
    const parsed = parsePhoneImport(JSON.stringify(records), "records.json");
    const rows = parsed.map(r => {
      const hex = createHash("sha256").update(JSON.stringify([projectId, device, r.metadata.kind, r.metadata.direction, r.metadata.phone, r.metadata.contact, r.occurredAt, r.text])).digest("hex");
      const id = `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
      return { id, project_id: projectId, evidence_type: r.metadata.kind === "sms" ? "text_message" : "call_transcript", title: `${r.metadata.kind === "sms" ? "Text" : "Call"} · ${r.metadata.contact}`, source_system: COMMUNICATION_SOURCE, raw_text: r.text, occurred_at: r.occurredAt, metadata: { ...r.metadata, device }, created_by: auth.user.id };
    });
    const result = await auth.supabase.from("evidence").upsert(rows, { onConflict: "id", ignoreDuplicates: true }).select("id");
    if (result.error) throw new Error("Import could not be saved. No records were imported.");
    return NextResponse.json({ imported: result.data.length, skipped: records.length-result.data.length });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid import." }, { status: 400 }); }
}

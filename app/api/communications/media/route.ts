import { NextRequest, NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";
import { COMMUNICATION_SOURCE } from "@/lib/communications";
import { mediaProof } from "@/lib/communications-provider";

export async function GET(req: NextRequest) {
  const auth = await supabaseForRequest(req);
  if (!auth) return new NextResponse("Unauthorized", { status: 401 });
  const index = Number(req.nextUrl.searchParams.get("index"));
  if (!Number.isInteger(index) || index < 0 || index > 9) return new NextResponse("Invalid attachment", { status: 400 });
  const row = await auth.supabase.from("evidence").select("id,project_id,metadata").eq("id", req.nextUrl.searchParams.get("id")).eq("source_system", COMMUNICATION_SOURCE).single();
  const media = row.data?.metadata?.media?.[index];
  if (row.error || !media?.url || !process.env.TWILIO_AUTH_TOKEN || !media.url.startsWith(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/`)) return new NextResponse("Not found", { status: 404 });
  // Evidence metadata is editable by project contributors: authenticate the provider media list.
  if (row.data.metadata.mediaProof !== mediaProof(row.data.id, row.data.project_id, row.data.metadata.media)) return new NextResponse("Unverified attachment", { status: 403 });
  const remote = await fetch(media.url, { headers: { Authorization: "Basic " + Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64") }, redirect: "manual", signal: AbortSignal.timeout(15000) });
  // Never forward credentials to a redirect target. Provider media can require a separate download flow.
  if (!remote.ok) return new NextResponse("Attachment unavailable from provider", { status: 502 });
  return new NextResponse(remote.body, { headers: { "Content-Type": "application/octet-stream", "Content-Disposition": "attachment; filename=attachment", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}

import { NextRequest, NextResponse } from "next/server";
import { CLAUDE_MODEL, aiConfigured, claudeStructured } from "@/lib/ai/claude";
import { getProduct } from "@/lib/verticals/products";
import {
  captureSchema, capturePrompt, logPrompt, logSchema, requestPrompt, requestSchema,
  type AiContext, type CaptureItem, type LogDraft, type RequestDraft,
} from "@/lib/verticals/ai/tasks";
import { fallbackCapture, fallbackLog, fallbackRequest } from "@/lib/verticals/ai/fallback";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST { product, task: "request" | "log" | "capture", context, text?, date?, records? }
 * Returns { result, mode: "ai" | "pattern", model }.
 * Results are drafts and candidates; the client saves them for a person to review.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const cfg = getProduct(String(body.product));
    if (!cfg) return NextResponse.json({ error: "Unknown product" }, { status: 400 });
    const ctx = body.context as AiContext;
    const text = String(body.text ?? "").trim();
    const ai = aiConfigured();
    const meta = { mode: ai ? "ai" : "pattern", model: ai ? CLAUDE_MODEL : null };

    if (body.task === "request") {
      if (text.length < 5) return NextResponse.json({ error: "Paste or dictate what was asked for first." }, { status: 400 });
      const result = ai
        ? await claudeStructured<RequestDraft>({ system: cfg.ai.system, prompt: requestPrompt(cfg, ctx, text), toolName: "draft_request", toolDescription: `Record a draft ${cfg.requestNoun.toLowerCase()} for review.`, schema: requestSchema })
        : fallbackRequest(cfg, ctx, text);
      return NextResponse.json({ result, ...meta });
    }

    if (body.task === "capture") {
      if (text.length < 5) return NextResponse.json({ error: "Say or paste something first." }, { status: 400 });
      const result = ai
        ? (await claudeStructured<{ items: CaptureItem[] }>({ system: cfg.ai.system, prompt: capturePrompt(cfg, ctx, text), toolName: "record_captures", toolDescription: "Record each distinct fact as a candidate record.", schema: captureSchema(cfg) })).items
        : fallbackCapture(cfg, ctx, text);
      return NextResponse.json({ result, ...meta });
    }

    if (body.task === "log") {
      if (!cfg.dailyLog.enabled) return NextResponse.json({ error: "Daily logs are not part of this product." }, { status: 400 });
      const records = (body.records ?? []) as { lane: string; text: string }[];
      if (!records.length) return NextResponse.json({ error: "No captures for this day yet." }, { status: 422 });
      const result = ai
        ? await claudeStructured<LogDraft>({ system: cfg.ai.system, prompt: logPrompt(cfg, ctx, String(body.date), records.map((r, i) => `#${i + 1} [${r.lane}] ${r.text}`)), toolName: "write_daily_log", toolDescription: "Record the daily log.", schema: logSchema(cfg) })
        : fallbackLog(cfg, records);
      return NextResponse.json({ result, ...meta });
    }

    return NextResponse.json({ error: "Unknown task" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "AI request failed" }, { status: 500 });
  }
}

import Anthropic from "@anthropic-ai/sdk";

// Server-only helper for calling Claude. Requires ANTHROPIC_API_KEY in the
// environment (Vercel → Project → Settings → Environment Variables).
// ANTHROPIC_MODEL is optional and defaults to Claude Sonnet 5.5.

export const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

export function aiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("AI is not configured yet. Add ANTHROPIC_API_KEY to the BuildPath environment variables.");
  }
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

/**
 * Ask Claude for structured output. Claude is forced to "call" a single tool whose
 * input schema is the shape we want back, which gives reliable JSON.
 */
export async function claudeStructured<T>(opts: {
  system: string;
  prompt: string;
  toolName: string;
  toolDescription: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
  /** Optional publicly fetchable image URLs (e.g. Supabase signed URLs) for Claude to look at. */
  images?: string[];
}): Promise<T> {
  const content: Anthropic.ContentBlockParam[] = [
    ...(opts.images || []).slice(0, 10).map((url) => ({ type: "image" as const, source: { type: "url" as const, url } })),
    { type: "text", text: opts.prompt },
  ];
  const res = await getClient().messages.create({
    model: CLAUDE_MODEL,
    max_tokens: opts.maxTokens ?? 4000,
    system: opts.system,
    tools: [
      {
        name: opts.toolName,
        description: opts.toolDescription,
        input_schema: { type: "object", ...opts.schema } as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: opts.toolName },
    messages: [{ role: "user", content }],
  });
  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error("Claude did not return structured output.");
  return block.input as T;
}

export const BUILDER_SYSTEM = `You are BuildPath's assistant for small residential and light-commercial builders, remodelers and specialty contractors.
Write the way a capable office manager at a small building company would: plain, specific, no jargon or filler.
Only state facts supported by the field records you are given. Never invent quantities, prices, names or dates.
When something is unknown, say so briefly (e.g. "Price TBD") rather than guessing.`;

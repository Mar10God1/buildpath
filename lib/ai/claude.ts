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
 * Structured outputs require every object in the schema to forbid extra keys.
 * Callers write plain JSON Schema; this adds `additionalProperties: false` throughout.
 */
function strictSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strictSchema);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) out[k] = strictSchema(v);
  const type = out.type;
  if (type === "object" || (Array.isArray(type) && type.includes("object"))) out.additionalProperties = false;
  return out;
}

/**
 * Ask Claude for JSON matching `schema`, using structured outputs (`output_config.format`).
 * Current models (Sonnet 5.5, Opus 5.5, Fable 5.1) reject forced tool_choice, so we no longer
 * force a tool call. `toolName` and `toolDescription` describe the task to the model.
 */
export async function claudeStructured<T>(opts: {
  system: string;
  prompt: string;
  toolName: string;
  toolDescription: string;
  schema: Record<string, unknown>;
  /** Room for the answer. Thinking also counts against max_tokens, so at least 16k is sent. */
  maxTokens?: number;
  /** Optional publicly fetchable image URLs (e.g. Supabase signed URLs) for Claude to look at. */
  images?: string[];
}): Promise<T> {
  const content: Anthropic.ContentBlockParam[] = [
    ...(opts.images || []).slice(0, 10).map((url) => ({ type: "image" as const, source: { type: "url" as const, url } })),
    { type: "text", text: `${opts.prompt}\n\nRespond with the ${opts.toolName.replace(/_/g, " ")} as JSON: ${opts.toolDescription}` },
  ];
  const res = await getClient().messages.create({
    model: CLAUDE_MODEL,
    max_tokens: Math.max(opts.maxTokens ?? 0, 16000),
    system: opts.system,
    output_config: { format: { type: "json_schema", schema: strictSchema({ type: "object", ...opts.schema }) as Record<string, unknown> } },
    messages: [{ role: "user", content }],
  });
  if (res.stop_reason === "refusal") throw new Error("Claude declined this request.");
  if (res.stop_reason === "max_tokens") throw new Error("Claude's answer was cut off. Try again with less text.");
  const text = res.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("Claude did not return structured output.");
  return JSON.parse(text.text) as T;
}

export const BUILDER_SYSTEM = `You are BuildPath's assistant for small residential and light-commercial builders, remodelers and specialty contractors.
Write the way a capable office manager at a small building company would: plain, specific, no jargon or filler.
Only state facts supported by the field records you are given. Never invent quantities, prices, names or dates.
When something is unknown, say so briefly (e.g. "Price TBD") rather than guessing.`;

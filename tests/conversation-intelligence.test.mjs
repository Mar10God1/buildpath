import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import { validateConversationActions } from "../lib/conversation-intelligence.ts";

const require = createRequire(import.meta.url), ts = require("typescript");
const text = "Deliver twelve sheets of drywall Friday. I will send the proposal tomorrow. The price is [unclear].";
const action = { kind: "material_request", title: "Drywall delivery", source_quote: "Deliver twelve sheets of drywall Friday.",
  fields: [{ key: "quantity", value: "twelve", source_quote: "twelve sheets of drywall", needs_confirmation: false },
    { key: "date", value: "2026-10-30", source_quote: "Friday", needs_confirmation: false }], missing_info: ["Delivery address"] };

test("spoken values remain grounded; invented normalization becomes unknown", () => {
  const result = validateConversationActions({ actions: [action] }, text);
  assert.equal(result[0].fields[0].value, "twelve");
  assert.equal(result[0].fields[1].value, null);
  assert.equal(result[0].fields[1].needs_confirmation, true);
});
test("fabricated quotations, unclear passages, and unsupported action kinds are rejected", () => {
  assert.deepEqual(validateConversationActions({ actions: [
    { ...action, source_quote: "Order fifty sheets." }, { ...action, source_quote: "The price is [unclear]." },
    { ...action, kind: "send_payment" },
  ] }, text), []);
  assert.throws(() => validateConversationActions(null, text));
});

// Exercise the route's authentication, review gate, persistence, retry and idempotency
// against a database double. No live user data or paid model calls are used.
function fixture() {
  const state = { authorized: true, allow: true, reviewed: true, calls: 0, fail: false,
    jobs: [], candidates: [], evidence: { id: "10000000-0000-4000-a000-000000000001", project_id: "20000000-0000-4000-a000-000000000001", raw_text: text,
      metadata: { source: "conversation_intelligence", transcript_reviewed: true }, storage_path: null } };
  const db = {
    rpc: async () => ({ data: { upload_documents: state.allow, view_documents: state.allow }, error: null }),
    from(table) {
      const q = { action: "select", filters: [], values: null, options: null, one: false,
        select(_columns, options) { this.options = options; return this; },
        eq(key, value) { this.filters.push([key, value]); return this; },
        insert(values) { this.action = "insert"; this.values = values; return this; },
        update(values) { this.action = "update"; this.values = values; return this; },
        upsert(values) { this.action = "upsert"; this.values = values; return this; },
        single() { this.one = true; return this; }, maybeSingle() { this.one = true; return this; },
        then(resolve, reject) {
          try {
            state.evidence.metadata.transcript_reviewed = state.reviewed;
            const rows = table === "ingestion_jobs" ? state.jobs : table === "extraction_candidates" ? state.candidates : [state.evidence];
            let found = rows.filter(r => this.filters.every(([k, v]) => r[k] === v));
            if (this.action === "insert" || this.action === "upsert") {
              const added = [];
              for (const value of Array.isArray(this.values) ? this.values : [this.values]) {
                if (rows.some(r => r.id === value.id)) {
                  if (this.action === "insert") return Promise.resolve(resolve({ error: { code: "23505" }, data: null }));
                  continue;
                }
                const row = { ...value, created_at: new Date().toISOString() }; rows.push(row); added.push(row);
              }
              found = added;
            } else if (this.action === "update") found.forEach(r => Object.assign(r, this.values));
            return Promise.resolve(resolve({ error: null, data: this.one ? found[0] || null : found, count: found.length }));
          } catch (e) { return Promise.reject(e).then(resolve, reject); }
        },
      };
      return q;
    },
  };
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL("../app/api/conversations/extract/route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(code, { exports, Date, Error,
    require: name => name === "next/server" ? { NextResponse: { json: (data, opts) => new Response(JSON.stringify(data), opts) } }
      : name.endsWith("supabase/server") ? { supabaseForRequest: async () => state.authorized ? { supabase: db, user: { id: "user" } } : null }
      : name.endsWith("ai/claude") ? { aiConfigured: () => true, claudeStructured: async () => { state.calls++; if (state.fail) throw new Error("Temporary model failure"); return { actions: [action] }; } }
      : name.endsWith("conversation-intelligence") ? { validateConversationActions, CONVERSATION_SYSTEM: "test", MAX_TRANSCRIPT_LENGTH: 24000, conversationSchema: {} }
      : require(name),
  });
  return { state, post: () => exports.POST(new Request("http://localhost/api/conversations/extract", { method: "POST", body: JSON.stringify({ evidenceId: state.evidence.id }) })) };
}
test("unauthorized, denied project access, and unreviewed transcripts never call the model", async () => {
  for (const [key, value, status] of [["authorized", false, 401], ["allow", false, 403], ["reviewed", false, 400]]) {
    const f = fixture(); f.state[key] = value;
    assert.equal((await f.post()).status, status); assert.equal(f.state.calls, 0);
  }
});
test("extraction writes drafts; repeated processing creates no duplicates", async () => {
  const f = fixture(); assert.equal((await f.post()).status, 200); assert.equal((await f.post()).status, 200);
  assert.equal(f.state.calls, 1); assert.equal(f.state.candidates.length, 1);
  assert.equal(f.state.candidates[0].status, "pending");
  assert.equal(f.state.candidates[0].proposed_value.automation.state, "draft");
  assert.equal(f.state.candidates[0].proposed_value.automation.requires_confirmation, true);
});
test("failed model call retains saved evidence and can be retried", async () => {
  const f = fixture(); f.state.fail = true;
  assert.equal((await f.post()).status, 500); assert.equal(f.state.jobs[0].status, "failed");
  assert.equal(f.state.evidence.raw_text, text); f.state.fail = false;
  assert.equal((await f.post()).status, 200); assert.equal(f.state.candidates.length, 1);
});

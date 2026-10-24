import type { ProductConfig } from "../core/product";
import type { AiContext, CaptureItem, LogDraft, RequestDraft } from "./tasks";

// Pattern-matching stand-ins used when ANTHROPIC_API_KEY isn't set (same approach as
// BuildPath's extraction fallback). Conservative on purpose: it never invents a price.

const LANE_WORDS: Record<string, Record<string, RegExp>> = {
  restore: {
    equipment: /\b(dehu|dehumidifier|air movers?|fans?|scrubber|pulled|placed|set up)\b/i,
    drying: /\b(read|reading|moisture|%|dry goal|at goal|wet|meter|P\d+)\b/i,
    carrier: /\b(adjuster|carrier|claim|approved|denied|summit|mutual|insurance|email from)\b/i,
    homeowner: /\b(homeowner|owner ok|signed|authori[sz])\b/i,
  },
  lease: {
    tenant: /\b(text from|tenant|maya|says|asked)\b/i,
    vendor: /\b(vendor|plumbing|electric|hvac|invoice|replaced|repaired)\b/i,
    maintenance: /\b(leak|broken|noise|not working|clog|repair|fix)\b/i,
    inspection: /\b(inspection|walk-?through|move-?(in|out))\b/i,
  },
  event: {
    client: /\b(from \w+|can we|omg|mom|dad|we want|could we)\b/i,
    vendor: /\b(quote|vendor|florist|catering|dj|band|bloom|venue)\b/i,
    money: /\b(deposit|paid|payment|invoice|balance)\b/i,
  },
};

const ASK = /\b(add|can we|could (we|you|someone)|need|want|replace|fix|leak|extra|more|approve|remove|open(ing)? the wall|upgrade|swap|grinding|broken|come tomorrow)\b/i;

function sentences(text: string) {
  return text.split(/(?<=[.!?])\s+|\n+|\s+(?:and also|also,?)\s+/i).map((s) => s.trim()).filter((s) => s.length > 3);
}

function money(s: string) {
  const m = s.match(/\$\s?(\d[\d,]*(?:\.\d+)?)/);
  return m ? Number(m[1].replace(/,/g, "")) : null;
}

/** Who wrote the message, only when it opens with a header like "Maya:" or "From Priya 11:52pm:". */
function header(text: string) {
  const m = text.match(/^(?:text |email )?(?:from\s+)?([A-Z][\w&' ]{1,30}?)(?:\s*\([^)]*\))?\s*(?:\d{1,2}[/:]\S*\s*\S*)?:/);
  return m ? m[1].trim() : null;
}

function speaker(text: string, ctx: AiContext) {
  return header(text) ?? ctx.people.find((p) => text.includes(p.name.split(" ")[0]))?.name ?? null;
}

function clean(s: string) {
  return s.replace(/^(?:text |email )?(?:from\s+)?[A-Z][\w&' ]{1,30}?(?:\s*\([^)]*\))?\s*(?:\d{1,2}[/:]\S*\s*\S*)?:\s*/, "").replace(/\s+/g, " ").trim();
}

function title(s: string) {
  const t = clean(s).replace(/^(omg|hi|hey|so|and|also)[,!\s]+/i, "").replace(/[?!.🙈]+$/u, "");
  const cut = t.length > 72 ? t.slice(0, 72).replace(/\s+\S*$/, "") + "…" : t;
  return cut.charAt(0).toUpperCase() + cut.slice(1);
}

export function fallbackRequest(cfg: ProductConfig, ctx: AiContext, text: string): RequestDraft {
  const parts = sentences(text).filter((s) => ASK.test(s));
  const items: RequestDraft["line_items"] = [];
  for (const s of parts.length ? parts : [text]) {
    const guests = s.match(/(\d+)\s+(?:more|additional|extra)\s+(?:people|guests)/i) ?? s.match(/(?:invite|add)\s+(\d+)\s+(?:more\s+)?(?:people|guests)/i);
    if (guests && cfg.key === "event") {
      items.push({ description: "Additional guests", code: null, quantity: Number(guests[1]), unit: "guest", unit_price: null });
      continue;
    }
    const days = s.match(/(\d+)\s+(?:more|extra|additional)\s+days?/i);
    const price = money(s);
    items.push({ description: title(s), code: s.match(/\b[A-Z]{3}\s?[A-Z0-9+<>]{2,6}\b/)?.[0] ?? null, quantity: days ? Number(days[1]) : null, unit: days ? "day" : null, unit_price: price });
  }
  const by = speaker(text, ctx);
  const missing = [
    items.some((i) => i.unit_price == null && i.unit !== "guest") ? "Pricing for each line" : null,
    cfg.key === "restore" ? "Adjuster approval in writing (email or carrier portal note)" : null,
    cfg.key === "restore" ? "Photos and readings supporting each line" : null,
    cfg.key === "lease" ? "Access window with the tenant" : null,
    cfg.key === "event" && /sparkler/i.test(text) ? "Confirm the venue allows sparklers" : null,
    cfg.key === "event" ? "Vendor availability and quotes" : null,
  ].filter(Boolean) as string[];
  return {
    title: items[0]?.description.slice(0, 60) || `New ${cfg.requestNoun.toLowerCase()}`,
    description: items.map((i) => i.description).join(". ") + ".",
    reason: by ? `Requested by ${by}.` : "Request received by message.",
    requested_by: by,
    line_items: items,
    schedule_impact_days: null,
    missing_info: missing,
  };
}

export function fallbackLog(cfg: ProductConfig, records: { lane: string; text: string }[]): LogDraft {
  const map: Record<string, string> = { mitigation: "work_completed", drying: "drying_progress", equipment: "equipment", carrier: "carrier", homeowner: "issues" };
  const sections = Object.fromEntries(cfg.dailyLog.sections.map((s) => [s.key, [] as string[]]));
  for (const r of records) {
    const key = /mold|hidden|found|damage|leak/i.test(r.text) ? "issues" : map[r.lane] ?? "work_completed";
    (sections[key] ?? sections.work_completed).push(`- ${r.text}`);
  }
  return {
    summary: `${records.length} capture${records.length === 1 ? "" : "s"} recorded today across ${new Set(records.map((r) => r.lane)).size} area(s). Written by pattern matching; review before finalizing.`,
    sections: Object.fromEntries(Object.entries(sections).map(([k, v]) => [k, v.length ? v.join("\n") : "None recorded."])),
  };
}

export function fallbackCapture(cfg: ProductConfig, ctx: AiContext, text: string): CaptureItem[] {
  const words = LANE_WORDS[cfg.key] ?? {};
  const who = header(text);
  const isText = /^(text|from|\w+\s*\(?\d|[A-Z]\w+:)/i.test(text.trim()) || /\btext\b/i.test(text);
  return sentences(text).map((s) => {
    const lane = Object.entries(words).find(([, re]) => re.test(s))?.[0] ?? cfg.lanes[0].key;
    const reading = s.match(/\b(P\d+)\b\D{0,20}?(\d{1,3}(?:\.\d)?)\b/i);
    const time = s.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?/i);
    let at: string | null = null;
    if (time) {
      let h = Number(time[1]);
      if (time[3]?.toLowerCase() === "pm" && h < 12) h += 12;
      if (!time[3] && h < 7) h += 12; // "2:10" on a job site is afternoon
      at = `${ctx.today}T${String(h).padStart(2, "0")}:${time[2]}:00`;
    }
    const people = ctx.people.filter((p) => s.includes(p.name.split(" ")[0])).map((p) => p.name);
    if (who && !people.includes(who)) people.push(who);
    return {
      kind: reading && cfg.key === "restore" ? "reading" : /call(ed)?\b/i.test(s) ? "call" : /email/i.test(s) ? "email" : isText ? "text" : "note",
      lane,
      title: title(s),
      body: clean(s),
      at,
      date_kind: at ? "exact" : /today|this morning|tonight/i.test(s) ? "approximate" : "unknown",
      source: reading ? "instrument" : /call(ed)?\b/i.test(s) ? "call_note" : /email/i.test(s) ? "email" : isText ? "text_message" : "user",
      amount: money(s),
      people,
      reading: reading && cfg.key === "restore" ? { point: reading[1].toUpperCase(), value: Number(reading[2]) } : null,
      is_request: ASK.test(s) && !/approved/i.test(s),
    } satisfies CaptureItem;
  });
}

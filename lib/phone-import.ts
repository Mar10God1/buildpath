import { type CommunicationMeta, parseCommunication } from "@/lib/communications";

export type PhoneImportRow = { key: string; text: string; occurredAt: string; metadata: CommunicationMeta };

// CSV schema deliberately explicit: no guessing about sender, dates or project.
function csvRows(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], value = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') { if (quoted && text[i+1] === '"') { value += '"'; i++; } else quoted = !quoted; }
    else if (ch === ',' && !quoted) { row.push(value); value = ""; }
    else if ((ch === '\n' || ch === '\r') && !quoted) { if (ch === '\r' && text[i+1] === '\n') i++; row.push(value); if (row.some(Boolean)) rows.push(row); row = []; value = ""; }
    else value += ch;
  }
  if (quoted) throw new Error("The CSV contains an unfinished quoted field.");
  row.push(value); if (row.some(Boolean)) rows.push(row); return rows;
}

export function parsePhoneImport(text: string, filename: string): PhoneImportRow[] {
  let source: Record<string, unknown>[];
  if (/\.json$/i.test(filename)) {
    const data = JSON.parse(text); source = Array.isArray(data) ? data : data.records;
    if (!Array.isArray(source)) throw new Error("JSON must contain a records array.");
  } else if (/\.csv$/i.test(filename)) {
    const rows = csvRows(text.replace(/^\uFEFF/, ""));
    const header = rows.shift()?.map(x => x.trim()) || [];
    if (!["kind", "contact", "phone", "occurredAt", "text"].every(x => header.includes(x))) throw new Error("CSV needs kind, contact, phone, occurredAt, text columns. Download the template below.");
    source = rows.map(row => Object.fromEntries(header.map((key, i) => [key, row[i] || ""])));
  } else throw new Error("Choose a JSON or CSV export.");
  if (!source.length || source.length > 500) throw new Error("Import between 1 and 500 records at a time.");
  return source.map((r, index) => {
    const metadata = parseCommunication({ ...r, direction: r.direction || "imported" });
    const date = new Date(String(r.occurredAt || ""));
    const body = String(r.text || "").trim();
    if (!body || body.length > 50000 || !Number.isFinite(date.getTime())) throw new Error(`Record ${index+1} needs text and a valid ISO date including timezone.`);
    if (!/(Z|[+-]\d{2}:\d{2})$/i.test(String(r.occurredAt))) throw new Error(`Record ${index+1}: include the date's timezone, such as Z or -05:00.`);
    return { key: String(index), text: body, occurredAt: date.toISOString(), metadata };
  });
}

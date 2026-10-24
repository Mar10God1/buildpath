"use client";

import { useEffect, useState } from "react";
import { useProject } from "@/lib/verticals/store";
import { aiContext, callAi, priceLines, requestFromDraft } from "@/lib/verticals/client-ai";
import type { RequestDraft } from "@/lib/verticals/ai/tasks";
import type { ChangeRequest, LineItem } from "@/lib/verticals/core/types";
import { nowLocal } from "@/lib/verticals/core/evidence";
import { canSeeMoney } from "@/lib/verticals/core/sharing";
import { EvidenceBadges, Empty, fmtDay, money } from "./ui";

const STATUS_TONE: Record<ChangeRequest["status"], string> = { draft: "", sent: "ok", approved: "good", declined: "risk" };

/**
 * BuildPath's change-order engine, renamed per vertical. Claude drafts scope and line items from
 * a text or call note; prices are never invented; arithmetic happens in code; approvals are recorded
 * with who and when. The approver can act from their own shared view (client portal).
 */
export function Requests({ projectId, seed, onSeedUsed }: { projectId: string; seed: { text: string; evidenceIds: string[] } | null; onSeedUsed: () => void }) {
  const { cfg, project, people, allRequests, requests, viewer, saveRequest, allEvidence } = useProject(projectId);
  const [text, setText] = useState("");
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const me = people.find((p) => p.projectId === null);

  useEffect(() => {
    if (seed) { setText(seed.text); setSourceIds(seed.evidenceIds); onSeedUsed(); }
  }, [seed, onSeedUsed]);

  if (!project) return null;
  const list = viewer ? requests : allRequests;

  async function draft() {
    setBusy(true); setError(null);
    try {
      const res = await callAi<RequestDraft>({ product: cfg.key, task: "request", context: aiContext(cfg, project!, people), text });
      const r = requestFromDraft(cfg, project!, people, allRequests, res.result, text, sourceIds, res, me?.name ?? "Team");
      saveRequest(r); setOpenId(r.id); setText(""); setSourceIds([]);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="stack">
      {!viewer && (
        <div className="card">
          <div className="card-head"><div><h2>New {cfg.requestNoun.toLowerCase()} from a message</h2><p className="muted small">Paste the text, email or call note. You get a draft with line items; prices stay blank unless the message states them.</p></div></div>
          <textarea className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={`e.g. ${cfg.requestExamples[0].slice(0, 90)}…`} />
          {sourceIds.length > 0 && <p className="small muted" style={{ marginTop: 6 }}>Linked to {sourceIds.length} captured record(s).</p>}
          <div className="spread" style={{ marginTop: 10 }}>
            <button className="example" style={{ flex: 1 }} onClick={() => setText(cfg.requestExamples[0])}>Try: “{cfg.requestExamples[0].slice(0, 100)}…”</button>
            <button className="btn primary" disabled={busy || text.trim().length < 5} onClick={draft}>{busy ? "Drafting…" : `Draft ${cfg.requestNoun.toLowerCase()}`}</button>
          </div>
          {error && <p className="notice err" style={{ marginTop: 10 }}>{error}</p>}
        </div>
      )}
      <div className="card flush">
        <div className="card-head" style={{ padding: "14px 16px 0" }}><h2>{cfg.requestPlural}</h2></div>
        {!list.length && <Empty>No {cfg.requestPlural.toLowerCase()} {viewer ? "shared with this person" : "yet"}.</Empty>}
        {list.map((r) => (
          <RequestRow key={r.id} r={r} open={openId === r.id} onToggle={() => setOpenId(openId === r.id ? null : r.id)} projectId={projectId} allEvidence={allEvidence} />
        ))}
      </div>
    </div>
  );
}

function RequestRow({ r, open, onToggle, projectId, allEvidence }: { r: ChangeRequest; open: boolean; onToggle: () => void; projectId: string; allEvidence: ReturnType<typeof useProject>["allEvidence"] }) {
  const { cfg, people, viewer, saveRequest } = useProject(projectId);
  const team = !viewer;
  const showMoney = canSeeMoney(cfg, viewer);
  const assignee = people.find((p) => p.id === r.assigneeId);
  const sources = allEvidence.filter((e) => r.sourceEvidenceIds.includes(e.id) && (team || e.status === "confirmed"));
  const canApprove = viewer && cfg.approverRoles.includes(viewer.role) && r.status === "sent";

  const setStatus = (status: ChangeRequest["status"], by: string) =>
    saveRequest({ ...r, status, history: [...r.history, { at: nowLocal(), status, by }] });
  const setLines = (items: LineItem[]) => { const p = priceLines(items); saveRequest({ ...r, lineItems: p.items, amount: p.total }); };
  const editLine = (i: number, patch: Partial<LineItem>) => setLines(r.lineItems.map((li, j) => (j === i ? { ...li, ...patch } : li)));
  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  return (
    <div style={{ borderTop: "1px solid var(--line)" }}>
      <button onClick={onToggle} style={{ all: "unset", cursor: "pointer", display: "flex", gap: 12, alignItems: "center", padding: "12px 16px", width: "100%", boxSizing: "border-box", flexWrap: "wrap" }}>
        <span className="badge">#{r.number}</span>
        <strong style={{ flex: 1, minWidth: 160 }}>{r.title}</strong>
        {assignee && <span className="small muted">→ {assignee.org ?? assignee.name}</span>}
        {showMoney && <span className="small" style={{ fontWeight: 700 }}>{r.amount != null ? money(r.amount) : "Price TBD"}</span>}
        <span className={`badge ${STATUS_TONE[r.status]}`}>{r.status}</span>
        {r.aiModel && <span className="badge accent">AI draft</span>}
      </button>
      {open && (
        <div style={{ padding: "0 16px 16px" }} className="stack">
          <p>{r.description}</p>
          <p className="small muted">Reason: {r.reason}{r.requestedBy ? ` · Requested by ${r.requestedBy}` : ""}{r.scheduleImpactDays ? ` · Schedule impact ${r.scheduleImpactDays} day(s)` : ""}</p>
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Item</th>{cfg.ai.codeLabel && <th>{cfg.ai.codeLabel}</th>}<th className="num">Qty</th><th>Unit</th>{showMoney && <><th className="num">Unit price</th><th className="num">Amount</th></>}</tr></thead>
              <tbody>
                {r.lineItems.map((li, i) => (
                  <tr key={i}>
                    <td>{team && r.status === "draft" ? <input className="input" value={li.description} onChange={(e) => editLine(i, { description: e.target.value })} /> : li.description}</td>
                    {cfg.ai.codeLabel && <td>{team && r.status === "draft" ? <input className="input" style={{ width: 90 }} value={li.code ?? ""} onChange={(e) => editLine(i, { code: e.target.value || null })} /> : li.code ?? "—"}</td>}
                    <td className="num">{team && r.status === "draft" ? <input className="input" style={{ width: 70 }} value={li.quantity ?? ""} onChange={(e) => editLine(i, { quantity: num(e.target.value) })} /> : li.quantity ?? "—"}</td>
                    <td>{team && r.status === "draft" ? <input className="input" style={{ width: 60 }} value={li.unit ?? ""} onChange={(e) => editLine(i, { unit: e.target.value || null })} /> : li.unit ?? ""}</td>
                    {showMoney && <td className="num">{team && r.status === "draft" ? <input className="input" style={{ width: 90 }} placeholder="Price" value={li.unit_price ?? ""} onChange={(e) => editLine(i, { unit_price: num(e.target.value) })} /> : money(li.unit_price)}</td>}
                    {showMoney && <td className="num">{li.amount != null ? money(li.amount) : <span className="badge warn">TBD</span>}</td>}
                  </tr>
                ))}
                {showMoney && <tr><td colSpan={cfg.ai.codeLabel ? 5 : 4}><strong>Total</strong></td><td className="num"><strong>{r.amount != null ? money(r.amount) : "Price every line to total"}</strong></td></tr>}
              </tbody>
            </table>
          </div>
          {team && r.status === "draft" && <button className="btn sm" style={{ alignSelf: "flex-start" }} onClick={() => setLines([...r.lineItems, { description: "New line", code: null, quantity: null, unit: null, unit_price: null, amount: null }])}>+ Line</button>}
          {team && r.missingInfo.length > 0 && (
            <div className="notice warn"><strong>To confirm before sending:</strong><ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>{r.missingInfo.map((m) => <li key={m}>{m}</li>)}</ul></div>
          )}
          {sources.length > 0 && (
            <div className="stack" style={{ gap: 6 }}>
              <h3>Evidence behind it</h3>
              {sources.map((e) => <div key={e.id} className="row small"><span>{fmtDay(e.at)} · {e.title}</span><EvidenceBadges e={e} /></div>)}
            </div>
          )}
          {team && r.sourceText && <details className="small"><summary className="muted">Original message</summary><p style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{r.sourceText}</p></details>}
          <div className="small muted">{r.history.map((h) => `${fmtDay(h.at, { month: "short", day: "numeric" })} ${h.status} by ${h.by}${h.note ? ` (${h.note})` : ""}`).join(" → ")}</div>
          <div className="row">
            {team && r.status === "draft" && <button className="btn primary" onClick={() => setStatus("sent", people.find((p) => p.projectId === null)?.name ?? "Team")}>Mark sent to {cfg.approver.toLowerCase()}</button>}
            {team && r.status === "sent" && (
              <>
                <button className="btn primary" onClick={() => setStatus("approved", `${cfg.approver} (recorded by team)`)}>Record approval</button>
                <button className="btn" onClick={() => setStatus("declined", `${cfg.approver} (recorded by team)`)}>Record decline</button>
              </>
            )}
            {canApprove && (
              <>
                <button className="btn primary" onClick={() => setStatus("approved", viewer!.name)}>Approve as {viewer!.name}</button>
                <button className="btn" onClick={() => setStatus("declined", viewer!.name)}>Decline</button>
              </>
            )}
            {team && r.status === "declined" && <button className="btn" onClick={() => setStatus("draft", "Team")}>Reopen as draft</button>}
          </div>
        </div>
      )}
    </div>
  );
}

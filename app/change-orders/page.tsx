"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { JobPageShell, callApi, money, useJob } from "@/components/job-page";

type LineItem = { description: string; quantity: number | null; unit: string | null; unit_price: number | null; amount: number | null };
type ChangeOrder = {
  id: string; number: number; title: string; description: string | null; reason: string | null; requested_by: string | null;
  line_items: LineItem[]; amount: number | null; schedule_impact_days: number | null;
  status: "draft" | "sent" | "approved" | "declined" | "void"; source_text: string | null; ai_generated: boolean;
  sent_at: string | null; decided_at: string | null; decided_by_name: string | null; created_at: string;
};

const STATUS_LABEL: Record<ChangeOrder["status"], string> = { draft: "Draft", sent: "Sent to client", approved: "Approved", declined: "Declined", void: "Void" };

function recompute(items: LineItem[]) {
  const lines = items.map((li) => {
    const amount = li.quantity != null && li.unit_price != null ? Math.round(li.quantity * li.unit_price * 100) / 100 : null;
    return { ...li, amount };
  });
  const priced = lines.length > 0 && lines.every((li) => li.amount != null);
  return { lines, total: priced ? lines.reduce((s, li) => s + (li.amount as number), 0) : null };
}
const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(/[^0-9.-]/g, "")));

export default function ChangeOrdersPage() {
  const { job, heroImage } = useJob();
  const [orders, setOrders] = useState<ChangeOrder[]>([]);
  const [selected, setSelected] = useState<ChangeOrder | null>(null);
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [listening, setListening] = useState(false);
  const speech = useRef<any>(null);

  async function load(selectId?: string) {
    if (!job) return;
    const r = await createClient().from("change_orders").select("*").eq("project_id", job.id).order("number", { ascending: false });
    if (r.error) { setMsg(r.error.message.includes("change_orders") ? "Change orders need the new database update before they can be saved. See the pull request notes." : r.error.message); return; }
    const list = (r.data || []) as ChangeOrder[];
    setOrders(list);
    const id = selectId || selected?.id;
    setSelected(list.find((o) => o.id === id) || null);
  }
  useEffect(() => { void load(); }, [job]);

  function toggleDictation() {
    if (listening) { try { speech.current?.stop(); } catch {} setListening(false); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setMsg("Voice dictation isn't supported in this browser. Type or paste instead."); return; }
    const rec = new SR(); rec.continuous = true; rec.interimResults = false; rec.lang = "en-US";
    rec.onresult = (e: any) => { let t = ""; for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) t += e.results[i][0].transcript + " "; if (t.trim()) setSource((p) => (p ? p + " " : "") + t.trim()); };
    rec.onend = () => setListening(false);
    rec.start(); speech.current = rec; setListening(true);
  }

  async function draft() {
    if (!job || !source.trim()) return;
    setBusy(true); setMsg("");
    const { ok, data } = await callApi<{ changeOrder: ChangeOrder; missingInfo: string[] }>("/api/change-orders/draft", { projectId: job.id, sourceText: source });
    setBusy(false);
    if (!ok) { setMsg(data.error || "Could not draft the change order."); return; }
    setSource("");
    setMsg(`Drafted CO #${data.changeOrder.number}.${data.missingInfo?.length ? " A few things still need confirming before you send it." : ""}`);
    await load(data.changeOrder.id);
  }

  async function blank() {
    if (!job) return;
    const s = createClient();
    const n = await s.rpc("next_change_order_number", { p_project_id: job.id });
    if (n.error) { setMsg(n.error.message); return; }
    const r = await s.from("change_orders").insert({ project_id: job.id, number: n.data, title: "New change order", line_items: [], status: "draft" }).select("*").single();
    if (r.error) { setMsg(r.error.message); return; }
    await load((r.data as ChangeOrder).id);
  }

  async function save(co: ChangeOrder, extra: Partial<ChangeOrder> = {}) {
    const { lines, total } = recompute(co.line_items);
    const r = await createClient().from("change_orders").update({
      title: co.title, description: co.description, reason: co.reason, requested_by: co.requested_by,
      line_items: lines, amount: total, schedule_impact_days: co.schedule_impact_days, updated_at: new Date().toISOString(), ...extra,
    }).eq("id", co.id).select("*").single();
    if (r.error) { setMsg(r.error.message); return null; }
    await load(co.id);
    return r.data as ChangeOrder;
  }

  async function setStatus(co: ChangeOrder, status: ChangeOrder["status"]) {
    if (!job) return;
    const now = new Date().toISOString();
    let extra: Partial<ChangeOrder> = { status };
    if (status === "sent") extra.sent_at = now;
    if (status === "approved" || status === "declined") {
      const who = window.prompt(status === "approved" ? "Who approved it? (client name)" : "Who declined it? (client name)", co.requested_by || "");
      if (who === null) return;
      extra = { ...extra, decided_at: now, decided_by_name: who || null };
    }
    const saved = await save(co, extra);
    if (!saved) return;
    if (status === "approved") {
      // Put the approved change on the job timeline so cost and schedule roll up.
      await createClient().from("project_events").insert({
        project_id: job.id, event_type: "change", title: `CO #${saved.number}: ${saved.title}`,
        description: saved.description, start_at: now, date_precision: "day", status: "approved",
        cost_impact: saved.amount, schedule_impact_days: saved.schedule_impact_days,
      });
    }
    setMsg(`CO #${co.number} marked ${STATUS_LABEL[status].toLowerCase()}.`);
  }

  function edit(patch: Partial<ChangeOrder>) { if (selected) setSelected({ ...selected, ...patch }); }
  function editLine(i: number, patch: Partial<LineItem>) {
    if (!selected) return;
    const items = selected.line_items.map((li, j) => (j === i ? { ...li, ...patch } : li));
    setSelected({ ...selected, line_items: recompute(items).lines });
  }

  if (!job) return <main className="setup-shell"><section className="setup-card">Loading…</section></main>;
  const locked = selected ? ["approved", "declined", "void"].includes(selected.status) : false;
  const totals = selected ? recompute(selected.line_items) : null;
  const approvedTotal = orders.filter((o) => o.status === "approved").reduce((s, o) => s + (o.amount || 0), 0);
  const pendingCount = orders.filter((o) => o.status === "draft" || o.status === "sent").length;

  return (
    <JobPageShell job={job} heroImage={heroImage} active="Change Orders" title="Change Orders" subtitle="Paste a client's text or talk it through. BuildPath drafts the change order for you to price and send.">
      {msg && <div className="form-message">{msg}</div>}
      <div className="builder-two-col">
        <section className="panel page-panel">
          <div className="panel-title"><div><p className="eyebrow">NEW CHANGE</p><h3>What did they ask for?</h3></div></div>
          <textarea className="source-box" value={source} onChange={(e) => setSource(e.target.value)} rows={5}
            placeholder={'e.g. Text from Sarah: "Can we add an outlet on the kitchen island and switch the pantry light to a motion sensor? Also want the backsplash taken all the way to the ceiling."'} />
          <div className="setup-actions">
            <button className={listening ? "record-button recording" : "record-button"} onClick={toggleDictation}>{listening ? "■ Stop" : "● Dictate"}</button>
            <button className="secondary-action" onClick={blank}>Write it myself</button>
            <button className="primary-action" disabled={busy || source.trim().length < 5} onClick={draft}>{busy ? "Drafting…" : "✦ Draft change order"}</button>
          </div>

          <div className="panel-title co-list-title"><div><p className="eyebrow">THIS JOB</p><h3>{orders.length} change order{orders.length === 1 ? "" : "s"}</h3></div><small>{money(approvedTotal)} approved · {pendingCount} open</small></div>
          {orders.length ? (
            <div className="compact-list">
              {orders.map((o) => (
                <button key={o.id} className={"log-row" + (selected?.id === o.id ? " selected" : "")} onClick={() => setSelected(o)}>
                  <span className="approval-code">#{o.number}</span>
                  <p><strong>{o.title}</strong><small>{STATUS_LABEL[o.status]} · {money(o.amount)}</small></p>
                </button>
              ))}
            </div>
          ) : <p className="empty-inline">No change orders yet.</p>}
        </section>

        <section className="panel page-panel">
          {selected && totals ? (
            <div className="co-editor">
              <div className="panel-title">
                <div><p className="eyebrow">CHANGE ORDER #{selected.number}</p><h3>{STATUS_LABEL[selected.status]}</h3></div>
                {selected.ai_generated && <small className="beta-inline">DRAFTED BY BUILDPATH</small>}
              </div>
              <label className="log-section"><span>Title</span><input value={selected.title} readOnly={locked} onChange={(e) => edit({ title: e.target.value })} /></label>
              <label className="log-section"><span>Scope of change</span><textarea rows={5} value={selected.description || ""} readOnly={locked} onChange={(e) => edit({ description: e.target.value })} /></label>
              <div className="co-meta">
                <label className="log-section"><span>Reason</span><input value={selected.reason || ""} readOnly={locked} onChange={(e) => edit({ reason: e.target.value })} /></label>
                <label className="log-section"><span>Requested by</span><input value={selected.requested_by || ""} readOnly={locked} onChange={(e) => edit({ requested_by: e.target.value })} /></label>
                <label className="log-section"><span>Schedule impact (days)</span><input inputMode="numeric" value={selected.schedule_impact_days ?? ""} readOnly={locked} onChange={(e) => edit({ schedule_impact_days: num(e.target.value) })} /></label>
              </div>

              <div className="line-items">
                <div className="line-head"><span>Item</span><span>Qty</span><span>Unit</span><span>Unit price</span><span>Amount</span><span /></div>
                {selected.line_items.map((li, i) => (
                  <div className="line-row" key={i}>
                    <input value={li.description} readOnly={locked} onChange={(e) => editLine(i, { description: e.target.value })} />
                    <input inputMode="decimal" value={li.quantity ?? ""} readOnly={locked} onChange={(e) => editLine(i, { quantity: num(e.target.value) })} />
                    <input value={li.unit || ""} readOnly={locked} onChange={(e) => editLine(i, { unit: e.target.value || null })} />
                    <input inputMode="decimal" placeholder="TBD" value={li.unit_price ?? ""} readOnly={locked} onChange={(e) => editLine(i, { unit_price: num(e.target.value) })} />
                    <strong>{money(li.amount)}</strong>
                    {!locked ? <button className="text-button" aria-label="Remove line" onClick={() => edit({ line_items: selected.line_items.filter((_, j) => j !== i) })}>×</button> : <span />}
                  </div>
                ))}
                {!locked && <button className="text-button" onClick={() => edit({ line_items: [...selected.line_items, { description: "", quantity: 1, unit: "ea", unit_price: null, amount: null }] })}>＋ Add line</button>}
                <div className="total-row"><span>Total</span><strong>{totals.total == null ? "Price TBD on one or more lines" : money(totals.total)}</strong></div>
              </div>

              {selected.source_text && <details className="co-source"><summary>Original request</summary><p>{selected.source_text}</p></details>}
              {selected.decided_by_name && <p className="panel-copy">{STATUS_LABEL[selected.status]} by {selected.decided_by_name}{selected.decided_at ? " on " + new Date(selected.decided_at).toLocaleDateString() : ""}.</p>}

              <div className="setup-actions">
                {!locked && <button className="secondary-action" onClick={async () => { if (await save(selected)) setMsg("Saved."); }}>Save</button>}
                {selected.status === "draft" && <button className="primary-action" disabled={totals.total == null} title={totals.total == null ? "Price every line first" : ""} onClick={() => setStatus(selected, "sent")}>Mark sent to client</button>}
                {selected.status === "sent" && <><button className="primary-action" onClick={() => setStatus(selected, "approved")}>Client approved</button><button className="secondary-action" onClick={() => setStatus(selected, "declined")}>Client declined</button></>}
                {!locked && <button className="text-button" onClick={() => { if (window.confirm(`Void CO #${selected.number}?`)) void setStatus(selected, "void"); }}>Void</button>}
                <button className="secondary-action" onClick={() => window.print()}>Print / save PDF</button>
              </div>
            </div>
          ) : (
            <div className="empty-state"><span>△</span><p>Pick a change order on the left, or draft a new one from a client's request.</p></div>
          )}
        </section>
      </div>
    </JobPageShell>
  );
}

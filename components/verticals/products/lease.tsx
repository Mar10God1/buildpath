"use client";

import { useMemo, useState } from "react";
import { useProject } from "@/lib/verticals/store";
import { CLASS_LABELS, CONDITIONS, depositRows, depositSummary, inspections, itemizationLetter, tenancy, type Condition, type DepositRow, type Inspection } from "@/lib/verticals/lease/deposit";
import { todayLocal, uid } from "@/lib/verticals/core/evidence";
import { canSeeMoney } from "@/lib/verticals/core/sharing";
import { Photo, Stat, fmtDay, money } from "../ui";

const CLASS_TONE: Record<DepositRow["classification"], string> = { no_change: "good", normal_wear: "ok", damage: "risk", no_baseline: "warn" };

export function LeaseOverview({ projectId, go }: { projectId: string; go: (tab: string) => void }) {
  const { cfg, project, allEvidence, allRequests, evidence, requests, viewer, people } = useProject(projectId);
  const p = project!;
  const t = tenancy(p);
  const tenants = people.filter((x) => t.tenantIds.includes(x.id));
  const open = requests.filter((r) => r.status === "sent" || r.status === "draft");
  const rows = depositRows(p, allEvidence, allRequests);
  const s = depositSummary(p, rows, todayLocal());
  const money_ = canSeeMoney(cfg, viewer);
  const reports = evidence.filter((e) => e.category === "maintenance");
  return (
    <div className="stack">
      <div className="grid4">
        <Stat accent label="Tenancy" value={tenants.map((x) => x.name).join(", ") || "Vacant"} sub={`${fmtDay(t.leaseStart, { month: "short", year: "numeric" })} → ${t.moveOutDate ? `moved out ${fmtDay(t.moveOutDate, { month: "short", day: "numeric" })}` : fmtDay(t.leaseEnd, { month: "short", year: "numeric" })}`} />
        {money_ && <Stat label="Rent / deposit" value={`${money(t.rent)} / ${money(t.deposit)}`} />}
        <Stat label="Maintenance reports" value={reports.length} sub={`${open.length} open work order(s)`} />
        {t.moveOutDate && s.deadline && !viewer && <Stat label="Deposit deadline" value={s.daysLeft! >= 0 ? `${s.daysLeft} days left` : `${-s.daysLeft!} days late`} sub={`${t.jurisdiction} · due ${fmtDay(s.deadline)}`} />}
      </div>
      {t.moveOutDate && !viewer && (
        <div className="card">
          <div className="card-head"><div><h2>Deposit disposition</h2><p className="muted small">Move-in vs move-out, item by item, with every receipt and tenant report on the timeline.</p></div><button className="btn primary" onClick={() => go("deposit")}>Open deposit</button></div>
          <div className="grid4">
            <Stat label="Proposed deductions" value={money(s.deductionsTotal)} sub={s.unpriced ? `${s.unpriced} line(s) need a price` : undefined} />
            <Stat label={s.owedByTenant ? "Tenant owes" : "Refund to tenant"} value={money(s.owedByTenant || s.refund)} />
            <Stat label="Weak lines" value={s.weakest.length} sub={s.weakest.map((r) => r.item).join(", ") || "None"} />
          </div>
        </div>
      )}
      {!inspections(p).length && !viewer && <div className="card"><p>No inspections yet. <button className="btn sm" onClick={() => go("inspections")}>Start the move-in walk-through</button></p></div>}
    </div>
  );
}

export function Inspections({ projectId }: { projectId: string }) {
  const { project, evidence, viewer, updateProject, addEvidence } = useProject(projectId);
  const p = project!;
  const ins = inspections(p);
  const moveIn = ins.find((i) => i.type === "move_in");
  const moveOut = ins.find((i) => i.type === "move_out");
  const photo = (id: string) => evidence.find((e) => e.id === id);
  const keys = useMemo(() => {
    const all = [...(moveIn?.items ?? []), ...(moveOut?.items ?? [])].map((i) => `${i.room}|${i.item}`);
    return [...new Set(all)];
  }, [moveIn, moveOut]);
  const [form, setForm] = useState({ room: "", item: "", condition: "good" as Condition, note: "" });

  function addItem(type: Inspection["type"]) {
    if (!form.room || !form.item) return;
    const today = todayLocal();
    const id = uid("it");
    updateProject(p.id, (x) => {
      const list: Inspection[] = inspections(x);
      const existing = list.find((i) => i.type === type);
      const item = { id, room: form.room, item: form.item, condition: form.condition, note: form.note || undefined, photoIds: [] };
      const next = existing ? list.map((i) => (i === existing ? { ...i, items: [...i.items, item] } : i)) : [...list, { id: uid("insp"), type, date: today, items: [item] }];
      return { ...x, ext: { ...x.ext, inspections: next } };
    });
    addEvidence([{ id: uid("ev"), projectId: p.id, kind: "inspection", lane: "inspection", category: "condition", title: `${type === "move_in" ? "Move-in" : "Move-out"}: ${form.room}, ${form.item} — ${form.condition}`, body: form.note || undefined, at: `${today}T12:00:00`, dateKind: "approximate", source: "user", links: [id], status: "confirmed" }]);
    setForm({ ...form, item: "", note: "" });
  }

  return (
    <div className="stack">
      <div className="card flush">
        <div className="card-head" style={{ padding: "14px 16px 0" }}>
          <div><h2>Condition reports</h2><p className="muted small">{moveIn ? `Move-in ${fmtDay(moveIn.date)}${moveIn.signedByTenant ? " · signed by tenant" : " · not signed"}` : "No move-in report"} · {moveOut ? `Move-out ${fmtDay(moveOut.date)}` : "No move-out report"}</p></div>
        </div>
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Room / item</th><th>Move-in</th><th>Move-out</th></tr></thead>
            <tbody>
              {keys.map((k) => {
                const [room, item] = k.split("|");
                const a = moveIn?.items.find((i) => `${i.room}|${i.item}` === k);
                const b = moveOut?.items.find((i) => `${i.room}|${i.item}` === k);
                const cell = (x: typeof a) => x ? (
                  <div className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
                    {x.photoIds.map(photo).filter(Boolean).map((e) => <Photo key={e!.id} e={e!} />)}
                    <div><span className={`badge ${x.condition === "damaged" || x.condition === "poor" ? "risk" : x.condition === "fair" ? "warn" : "good"}`}>{x.condition}</span>{x.note && <p className="small muted">{x.note}</p>}{!x.photoIds.some(photo) && <p className="small" style={{ color: "var(--risk)" }}>No photo</p>}</div>
                  </div>
                ) : <span className="muted small">Not recorded</span>;
                return <tr key={k}><td><strong>{item}</strong><br /><span className="small muted">{room}</span></td><td>{cell(a)}</td><td>{cell(b)}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>
      {!viewer && (
        <div className="card">
          <h3 style={{ marginBottom: 8 }}>Add an item</h3>
          <div className="row">
            <input className="input" style={{ width: 130 }} placeholder="Room" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
            <input className="input" style={{ width: 160 }} placeholder="Item" value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} />
            <select className="input" style={{ width: "auto" }} value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value as Condition })}>{CONDITIONS.map((c) => <option key={c}>{c}</option>)}</select>
            <input className="input" style={{ flex: 1, minWidth: 160 }} placeholder="Note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            <button className="btn" onClick={() => addItem("move_in")}>Add to move-in</button>
            <button className="btn" onClick={() => addItem("move_out")}>Add to move-out</button>
          </div>
          <p className="small muted" style={{ marginTop: 8 }}>Attach photos from Capture, then link them to the item.</p>
        </div>
      )}
    </div>
  );
}

export function Deposit({ projectId }: { projectId: string }) {
  const { project, allEvidence, allRequests, people, updateProject, viewer } = useProject(projectId);
  const p = project!;
  const today = todayLocal();
  const rows = depositRows(p, allEvidence, allRequests);
  const s = depositSummary(p, rows, today);
  const [showLetter, setShowLetter] = useState(false);
  const tenants = people.filter((x) => tenancy(p).tenantIds.includes(x.id)).map((x) => x.name);
  if (viewer) return <div className="card"><p className="muted">The deposit worksheet is for the team. Tenants receive the final itemized letter.</p></div>;
  if (!rows.length) return <div className="card"><p className="muted">The deposit worksheet appears once there's a move-out inspection.</p></div>;

  const override = (key: string, patch: Record<string, unknown>) =>
    updateProject(p.id, (x) => ({ ...x, ext: { ...x.ext, deductions: { ...x.ext.deductions, [key]: { ...(x.ext.deductions?.[key] ?? {}), ...patch } } } }));

  return (
    <div className="stack">
      <div className="grid4">
        <Stat accent label="Deposit held" value={money(s.deposit)} />
        <Stat label="Deductions" value={money(s.deductionsTotal)} sub={s.unpriced ? `${s.unpriced} unpriced` : "All priced"} />
        <Stat label={s.owedByTenant ? "Tenant owes" : "Refund"} value={money(s.owedByTenant || s.refund)} />
        <Stat label="Statutory deadline" value={s.deadline ? fmtDay(s.deadline) : "—"} sub={s.daysLeft != null ? (s.daysLeft >= 0 ? `${s.daysLeft} days left` : `${-s.daysLeft} days late`) : undefined} />
      </div>
      <div className="card flush">
        <div className="card-head" style={{ padding: "14px 16px 0" }}>
          <div><h2>Item by item</h2><p className="muted small">Classified by comparing move-in and move-out condition over a {Math.round((Date.parse(tenancy(p).moveOutDate!) - Date.parse(tenancy(p).leaseStart)) / (86400000 * 30.44))}-month tenancy. Amounts come only from receipts, invoices, quotes or approved work orders.</p></div>
        </div>
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Charge?</th><th>Item</th><th>Change</th><th>Holds up?</th><th className="num">Amount</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td><input type="checkbox" checked={r.include} onChange={(e) => override(r.key, { include: e.target.checked })} /></td>
                  <td><strong>{r.item}</strong><br /><span className="small muted">{r.room}</span></td>
                  <td>
                    <span className="small">{r.moveIn?.condition ?? "—"} → {r.moveOut.condition}</span><br />
                    <span className={`badge ${CLASS_TONE[r.classification]}`}>{CLASS_LABELS[r.classification]}</span>
                    {r.priorReports.length > 0 && <p className="small" style={{ color: "var(--risk)", marginTop: 4 }}>⚠ Tenant reported this: {r.priorReports.map((x) => fmtDay(x.at, { month: "short", day: "numeric", year: "numeric" })).join(", ")}</p>}
                  </td>
                  <td style={{ minWidth: 180 }}>
                    <span className="meter" style={{ display: "block", width: 90 }}><i style={{ width: `${r.support}%`, background: r.support >= 60 ? "var(--good)" : "var(--warn)" }} /></span>
                    {r.gaps.map((g) => <p key={g} className="small muted">· {g}</p>)}
                  </td>
                  <td className="num">
                    <input className="input" style={{ width: 96, textAlign: "right" }} placeholder="Amount" value={r.amount ?? ""} onChange={(e) => override(r.key, { amount: e.target.value === "" ? null : Number(e.target.value) })} />
                    {r.costEvidence.map((c) => <p key={c.id} className="small muted">{c.title}: {money(c.amount)}</p>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="row">
        <button className="btn primary" onClick={() => setShowLetter((v) => !v)}>{showLetter ? "Hide" : "Preview"} itemized letter</button>
        {s.weakest.length > 0 && <span className="small muted">{s.weakest.length} charged line(s) would be hard to defend. Consider dropping them or adding evidence.</span>}
      </div>
      {showLetter && <div className="letter">{itemizationLetter(p, tenants, rows, today)}</div>}
    </div>
  );
}

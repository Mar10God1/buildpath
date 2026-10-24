"use client";

import { useState } from "react";
import { useProject } from "@/lib/verticals/store";
import { dryingFindings, equipment, equipmentDays, isoDay, pointStatuses, readinessScore, roomDryDay, roomName, rooms, type Finding } from "@/lib/verticals/restore/drying";
import { nowLocal, uid } from "@/lib/verticals/core/evidence";
import { canSeeMoney } from "@/lib/verticals/core/sharing";
import { EvidenceBadges, Photo, Stat, fmtDay, money } from "../ui";

const SEV: Record<Finding["severity"], string> = { risk: "risk", warn: "warn", ok: "good" };

export function RestoreOverview({ projectId, go }: { projectId: string; go: (tab: string) => void }) {
  const { project, evidence, requests, viewer } = useProject(projectId);
  const p = project!;
  const asOf = nowLocal();
  const { rows } = pointStatuses(p, evidence);
  const findings = dryingFindings(p, evidence, asOf);
  const score = readinessScore(findings);
  const onSite = equipment(p).filter((e) => !e.removedAt);
  const days = equipment(p).reduce((s, e) => s + equipmentDays(e, asOf), 0);
  return (
    <div className="stack">
      <div className="grid4">
        <Stat accent label="Claim readiness" value={`${score}%`} sub={<span className="meter" style={{ display: "block", marginTop: 6 }}><i style={{ width: `${score}%` }} /></span>} />
        <Stat label="Points at dry goal" value={`${rows.filter((r) => r.atGoal).length} / ${rows.length}`} sub={rows.filter((r) => !r.atGoal).map((r) => r.point.label).join(", ") || "All dry"} />
        <Stat label="Equipment on site" value={onSite.length} sub={`${days} billable equipment-days so far`} />
        <Stat label="Supplements" value={requests.length} sub={`${requests.filter((r) => r.status === "approved").length} approved · ${requests.filter((r) => r.status === "sent").length} with carrier`} />
      </div>
      {!viewer && <div className="card">
        <div className="card-head"><div><h2>What the adjuster will challenge</h2><p className="muted small">Checked against every reading, equipment day and photo on file.</p></div><button className="btn" onClick={() => go("packet")}>Open claim packet</button></div>
        {findings.map((f, i) => (
          <div key={i} className="finding"><span className={`badge ${SEV[f.severity]}`}>{f.severity === "ok" ? "OK" : f.severity === "risk" ? "Risk" : "Check"}</span><div><strong>{f.title}</strong><p className="muted small">{f.detail}</p></div></div>
        ))}
      </div>}
    </div>
  );
}

export function DryingLog({ projectId }: { projectId: string }) {
  const { project, evidence } = useProject(projectId);
  const p = project!;
  const { days, rows } = pointStatuses(p, evidence);
  const eq = equipment(p);
  return (
    <div className="stack">
      <div className="card flush">
        <div className="card-head" style={{ padding: "14px 16px 0" }}>
          <div><h2>Moisture map</h2><p className="muted small">Last reading of each day. Green is at or below the dry goal. Hatched cells are days with equipment running and no reading.</p></div>
        </div>
        <div className="table-wrap">
          <table className="t mx">
            <thead><tr><th style={{ textAlign: "left" }}>Point</th><th>Goal</th>{days.map((d) => <th key={d}>{fmtDay(d, { month: "numeric", day: "numeric" })}</th>)}<th>Dry on</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.point.id}>
                  <td style={{ textAlign: "left" }}><strong>{r.point.label}</strong> <span className="small muted">{roomName(p, r.point.roomId)} · {r.point.material}</span></td>
                  <td>{r.point.goal}</td>
                  {days.map((d) => {
                    const v = r.cells[d];
                    const running = eq.some((e) => e.roomId === r.point.roomId && isoDay(e.placedAt) <= d && (!e.removedAt || isoDay(e.removedAt) >= d));
                    if (v == null) return <td key={d} className={running && !(r.dryDay && d > r.dryDay) ? "gap" : ""}>{running && !(r.dryDay && d > r.dryDay) ? "missing" : ""}</td>;
                    return <td key={d} className={v <= r.point.goal ? "dry" : v <= r.point.goal * 1.25 ? "near" : "wet"}>{v}</td>;
                  })}
                  <td>{r.dryDay ? fmtDay(r.dryDay, { month: "short", day: "numeric" }) : <span className="badge warn">Not yet</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="grid2">
        {rooms(p).map((room) => {
          const dry = roomDryDay(room.id, rows);
          const photos = evidence.filter((e) => e.kind === "photo" && e.links.includes(room.id));
          return (
            <div key={room.id} className="card stack">
              <div className="spread"><h3>{room.name}</h3>{dry ? <span className="badge good">Dry {fmtDay(dry, { month: "short", day: "numeric" })}</span> : <span className="badge warn">Drying</span>}</div>
              <div className="row">{photos.length ? photos.map((e) => <Photo key={e.id} e={e} />) : <span className="badge risk">No photos</span>}</div>
              <p className="small muted">{eq.filter((e) => e.roomId === room.id).map((e) => `${e.tag}${e.removedAt ? " (removed)" : ""}`).join(", ") || "No equipment"}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function EquipmentLog({ projectId }: { projectId: string }) {
  const { project, updateProject, addEvidence, viewer, people } = useProject(projectId);
  const p = project!;
  const asOf = nowLocal();
  const [form, setForm] = useState({ type: "Air mover", tag: "", roomId: rooms(p)[0]?.id ?? "" });
  const tech = people.find((x) => x.role === "tech");
  const list = equipment(p);

  function place() {
    if (!form.tag.trim()) return;
    const id = uid("eq");
    const at = nowLocal();
    updateProject(p.id, (x) => ({ ...x, ext: { ...x.ext, equipment: [...equipment(x), { id, type: form.type, tag: form.tag.trim(), roomId: form.roomId, placedAt: at, removedAt: null }] } }));
    addEvidence([{ id: uid("ev"), projectId: p.id, kind: "equipment", lane: "equipment", category: "equipment", title: `Placed ${form.type.toLowerCase()} ${form.tag.trim()} in ${roomName(p, form.roomId)}`, at, dateKind: "exact", source: "user", authorId: tech?.id, links: [id, form.roomId], status: "confirmed" }]);
    setForm((f) => ({ ...f, tag: "" }));
  }
  function remove(id: string) {
    const e = list.find((x) => x.id === id)!;
    const at = nowLocal();
    updateProject(p.id, (x) => ({ ...x, ext: { ...x.ext, equipment: equipment(x).map((q) => (q.id === id ? { ...q, removedAt: at } : q)) } }));
    addEvidence([{ id: uid("ev"), projectId: p.id, kind: "equipment", lane: "equipment", category: "equipment", title: `Removed ${e.type.toLowerCase()} ${e.tag} from ${roomName(p, e.roomId)}`, at, dateKind: "exact", source: "user", authorId: tech?.id, links: [id, e.roomId], status: "confirmed" }]);
  }

  return (
    <div className="card flush">
      <div className="card-head" style={{ padding: "14px 16px 0" }}>
        <div><h2>Equipment log</h2><p className="muted small">Billable days are started 24-hour periods from placement to removal, counted in code.</p></div>
      </div>
      <div className="table-wrap">
        <table className="t">
          <thead><tr><th>Tag</th><th>Type</th><th>Room</th><th>Placed</th><th>Removed</th><th className="num">Days</th>{!viewer && <th />}</tr></thead>
          <tbody>
            {list.map((e) => (
              <tr key={e.id}>
                <td><strong>{e.tag}</strong></td><td>{e.type}</td><td>{roomName(p, e.roomId)}</td>
                <td>{fmtDay(e.placedAt)}</td><td>{e.removedAt ? fmtDay(e.removedAt) : <span className="badge ok">On site</span>}</td>
                <td className="num">{equipmentDays(e, asOf)}</td>
                {!viewer && <td>{!e.removedAt && <button className="btn sm" onClick={() => remove(e.id)}>Remove now</button>}</td>}
              </tr>
            ))}
            <tr><td colSpan={5}><strong>Total equipment-days</strong></td><td className="num"><strong>{list.reduce((s, e) => s + equipmentDays(e, asOf), 0)}</strong></td>{!viewer && <td />}</tr>
          </tbody>
        </table>
      </div>
      {!viewer && (
        <div className="row" style={{ padding: 16, borderTop: "1px solid var(--line)" }}>
          <select className="input" style={{ width: "auto" }} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{["Air mover", "Dehumidifier", "Air scrubber", "Heater"].map((t) => <option key={t}>{t}</option>)}</select>
          <input className="input" style={{ width: 110 }} placeholder="Tag (AM-15)" value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} />
          <select className="input" style={{ width: "auto" }} value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })}>{rooms(p).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
          <button className="btn primary" onClick={place}>Place equipment</button>
        </div>
      )}
    </div>
  );
}

/** One printable page an adjuster can pay from. Built entirely from the record; nothing generated. */
export function ClaimPacket({ projectId }: { projectId: string }) {
  const { cfg, project, evidence, requests, people, viewer } = useProject(projectId);
  const p = project!;
  const asOf = nowLocal();
  const { rows } = pointStatuses(p, evidence);
  const findings = dryingFindings(p, evidence, asOf).filter((f) => f.severity !== "ok");
  const showMoney = canSeeMoney(cfg, viewer);
  const carrier = evidence.filter((e) => e.lane === "carrier");
  const docs = evidence.filter((e) => e.kind === "document");
  return (
    <div className="stack">
      <div className="spread no-print">
        <p className="muted small">{viewer ? `This is the packet as ${viewer.name} sees it.` : "Fix the open items first, then print or save as PDF for the adjuster."}</p>
        <button className="btn primary" onClick={() => window.print()}>Print / save PDF</button>
      </div>
      {!viewer && findings.length > 0 && <div className="notice warn no-print">{findings.length} open item(s) on the Overview could weaken this packet.</div>}
      <div className="card stack">
        <div className="spread"><div><h1>{p.name}</h1><p className="muted">{p.address}</p></div><div style={{ textAlign: "right" }}><strong>{p.ext.carrier}</strong><p className="muted small">Claim {p.ext.claimNumber} · Loss {fmtDay(p.ext.dateOfLoss)}</p></div></div>
        <p>{p.subtitle}</p>
      </div>
      <div className="card stack">
        <h2>Drying summary</h2>
        <table className="t"><thead><tr><th>Point</th><th>Room</th><th>Material</th><th className="num">First</th><th className="num">Latest</th><th className="num">Goal</th><th>Dry on</th></tr></thead>
          <tbody>{rows.map((r) => { const vals = Object.values(r.cells).filter((v): v is number => v != null); return (
            <tr key={r.point.id}><td>{r.point.label}</td><td>{roomName(p, r.point.roomId)}</td><td>{r.point.material}</td><td className="num">{vals[0] ?? "—"}</td><td className="num">{r.latest ?? "—"}</td><td className="num">{r.point.goal}</td><td>{r.dryDay ? fmtDay(r.dryDay) : "Not yet"}</td></tr>); })}</tbody>
        </table>
      </div>
      <div className="card stack">
        <h2>Equipment</h2>
        <table className="t"><thead><tr><th>Tag</th><th>Type</th><th>Room</th><th>Placed</th><th>Removed</th><th className="num">Days</th></tr></thead>
          <tbody>{equipment(p).map((e) => <tr key={e.id}><td>{e.tag}</td><td>{e.type}</td><td>{roomName(p, e.roomId)}</td><td>{fmtDay(e.placedAt)}</td><td>{e.removedAt ? fmtDay(e.removedAt) : "On site"}</td><td className="num">{equipmentDays(e, asOf)}</td></tr>)}</tbody>
        </table>
      </div>
      {requests.length > 0 && (
        <div className="card stack">
          <h2>Supplements</h2>
          {requests.map((r) => <div key={r.id} className="spread"><span>#{r.number} {r.title} <span className="badge">{r.status}</span></span>{showMoney && <strong>{money(r.amount)}</strong>}</div>)}
        </div>
      )}
      {carrier.length > 0 && (
        <div className="card stack">
          <h2>Carrier communication</h2>
          {carrier.map((e) => <div key={e.id}><strong>{fmtDay(e.at)} · {e.title}</strong>{e.body && <p className="small muted">{e.body}</p>}<div className="tl-meta"><EvidenceBadges e={e} /></div></div>)}
        </div>
      )}
      <div className="card stack">
        <h2>Documents and photos</h2>
        {docs.map((e) => <div key={e.id} className="row small"><span>📄 {e.title} · {fmtDay(e.at)}</span><EvidenceBadges e={e} /></div>)}
        <div className="row">{evidence.filter((e) => e.kind === "photo").map((e) => <Photo key={e.id} e={e} />)}</div>
      </div>
      <p className="small muted">Prepared from {evidence.length} records by {people.find((x) => x.projectId === null)?.org ?? "the contractor"}. Every figure is computed from logged readings and equipment entries.</p>
    </div>
  );
}

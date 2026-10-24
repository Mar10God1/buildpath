"use client";

import { useProject } from "@/lib/verticals/store";
import { budgetSummary, runOfShow, upcomingPayments, vendors } from "@/lib/verticals/event/budget";
import { todayLocal } from "@/lib/verticals/core/evidence";
import { canSee, canSeeMoney, isTeam } from "@/lib/verticals/core/sharing";
import { Stat, fmtDay, money } from "../ui";

export function EventOverview({ projectId, go }: { projectId: string; go: (tab: string) => void }) {
  const { cfg, project, requests, allRequests, viewer } = useProject(projectId);
  const p = project!;
  const s = budgetSummary(p, viewer ? requests : allRequests);
  const daysOut = Math.ceil((Date.parse(p.ext.date) - Date.parse(todayLocal())) / 86400000);
  const showMoney = canSeeMoney(cfg, viewer) && (isTeam(cfg, viewer) || viewer?.role !== "vendor");
  const awaiting = requests.filter((r) => r.status === "sent");
  const due = upcomingPayments(p, todayLocal()).slice(0, 4);
  return (
    <div className="stack">
      <div className="grid4">
        <Stat accent label="Event date" value={fmtDay(p.ext.date, { month: "short", day: "numeric" })} sub={`${daysOut} days out · ${p.ext.guestCount} guests`} />
        {showMoney && <Stat label="Committed vs budget" value={`${money(s.committed)}`} sub={`of ${money(s.budget)} · ${money(s.remaining)} left`} />}
        {showMoney && <Stat label="Pending changes" value={s.pendingUnpriced && !s.pendingTotal ? "Price TBD" : money(s.pendingTotal)} sub={`${s.pendingUnpriced ? `${s.pendingUnpriced} unpriced · ` : ""}${money(s.ifAllApproved)} left if all approved`} />}
        <Stat label={`Awaiting ${cfg.approver.toLowerCase()}`} value={awaiting.length} sub={awaiting.map((r) => r.title).join(", ") || "Nothing pending"} />
      </div>
      {awaiting.length > 0 && viewer && cfg.approverRoles.includes(viewer.role) && (
        <div className="viewing-banner"><span>{awaiting.length} change{awaiting.length > 1 ? "s" : ""} waiting for your approval.</span><button className="btn primary" onClick={() => go("requests")}>Review</button></div>
      )}
      {showMoney && due.length > 0 && (
        <div className="card">
          <div className="card-head"><h2>Payments coming up</h2><button className="btn" onClick={() => go("budget")}>Vendors and budget</button></div>
          {due.map((d) => <div key={d.vendor.id} className="spread" style={{ padding: "6px 0" }}><span>{d.vendor.name} <span className="small muted">{d.vendor.category}</span></span><span className="row"><strong>{money(d.amount)}</strong><span className={`badge ${d.overdue ? "risk" : ""}`}>{d.overdue ? "Overdue " : "Due "}{fmtDay(d.due, { month: "short", day: "numeric" })}</span></span></div>)}
        </div>
      )}
    </div>
  );
}

export function Budget({ projectId }: { projectId: string }) {
  const { cfg, project, requests, allRequests, viewer, people, updateProject } = useProject(projectId);
  const p = project!;
  const team = !viewer;
  const showMoney = canSeeMoney(cfg, viewer);
  // Vendors see only their own contract line; everyone with vendor-roster access sees names.
  const list = vendors(p).filter((v) => team || viewer!.role !== "vendor" || v.personId === viewer!.id);
  const s = budgetSummary(p, team ? allRequests : requests);
  const approvedFor = (vid: string) => (team ? allRequests : requests).filter((r) => r.status === "approved" && r.sourceEvidenceIds.includes(vid)).reduce((t, r) => t + (r.amount ?? 0), 0);
  const setGuests = (n: number) => updateProject(p.id, (x) => ({ ...x, ext: { ...x.ext, guestCount: n } }));
  return (
    <div className="stack">
      {showMoney && (team || viewer!.role !== "vendor") && (
        <div className="grid4">
          <Stat accent label="Budget" value={money(s.budget)} />
          <Stat label="Contracted" value={money(s.contracted)} />
          <Stat label="Approved changes" value={money(s.approvedTotal)} />
          <Stat label="Paid / balance" value={`${money(s.paid)} / ${money(s.balance)}`} />
        </div>
      )}
      <div className="card flush">
        <div className="card-head" style={{ padding: "14px 16px 0" }}>
          <div><h2>Vendors</h2><p className="muted small">Per-head vendors re-price automatically when a change request adds guests.</p></div>
          {team && <label className="row small">Guests <input className="input" style={{ width: 80 }} type="number" value={p.ext.guestCount} onChange={(e) => setGuests(Number(e.target.value))} /></label>}
        </div>
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Vendor</th><th>Contact</th>{showMoney && <><th className="num">Contract</th><th className="num">Per guest</th><th className="num">Approved changes</th><th className="num">Paid</th><th>Next due</th></>}</tr></thead>
            <tbody>
              {list.map((v) => (
                <tr key={v.id}>
                  <td><strong>{v.name}</strong><br /><span className="small muted">{v.category}</span></td>
                  <td className="small">{people.find((x) => x.id === v.personId)?.name ?? "—"}</td>
                  {showMoney && <>
                    <td className="num">{money(v.contract)}</td>
                    <td className="num">{v.perHead != null ? money(v.perHead) : "—"}</td>
                    <td className="num">{approvedFor(v.id) ? money(approvedFor(v.id)) : "—"}</td>
                    <td className="num">{money(v.paid)}</td>
                    <td>{v.dueDate ? <span className={`badge ${v.dueDate < todayLocal() && v.contract > v.paid ? "risk" : ""}`}>{fmtDay(v.dueDate, { month: "short", day: "numeric" })}</span> : "—"}</td>
                  </>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function RunOfShow({ projectId }: { projectId: string }) {
  const { cfg, project, viewer, people } = useProject(projectId);
  const p = project!;
  if (viewer && !canSee(cfg, viewer, "plan", { id: "ros" })) return <div className="card"><p className="muted">The run of show isn't shared with {viewer.name}.</p></div>;
  const vs = vendors(p);
  const mine = viewer?.role === "vendor" ? vs.find((v) => v.personId === viewer.id)?.id : null;
  const fmt = (t: string) => { const [h, m] = t.split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`; };
  return (
    <div className="card">
      <div className="card-head"><div><h2>Run of show</h2><p className="muted small">{fmtDay(p.ext.date, { weekday: "long", month: "long", day: "numeric" })} · {p.address}{mine ? " · your cues are highlighted" : ""}</p></div></div>
      <div className="stack" style={{ gap: 0 }}>
        {runOfShow(p).map((r) => {
          const highlight = mine && r.vendorIds.includes(mine);
          return (
            <div key={r.id} className="row" style={{ padding: "10px 8px", borderTop: "1px solid #ebeae6", flexWrap: "nowrap", background: highlight ? "color-mix(in srgb,var(--accent) 9%,#fff)" : undefined, borderRadius: 6 }}>
              <strong style={{ width: 80, flex: "none", fontVariantNumeric: "tabular-nums" }}>{fmt(r.time)}</strong>
              <div style={{ flex: 1 }}>{r.item}<div className="small muted">{r.vendorIds.map((id) => vs.find((v) => v.id === id)?.name).filter(Boolean).join(" · ")}</div></div>
            </div>
          );
        })}
      </div>
      {!viewer && <p className="small muted" style={{ marginTop: 10 }}>Vendors see the full run of show with their own cues highlighted; {people.filter((x) => x.role === "vendor").length} vendor contacts have access.</p>}
    </div>
  );
}

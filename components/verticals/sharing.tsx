"use client";

import { useState } from "react";
import { useProject } from "@/lib/verticals/store";
import { accessMap, canSeeMoney, defaultLevel, isTeam, previewSummary, projectEvidence, projectRequests } from "@/lib/verticals/core/sharing";
import type { CategoryAccess, Person, SharingLevel } from "@/lib/verticals/core/types";
import { uid } from "@/lib/verticals/core/evidence";

const ACCESS: CategoryAccess[] = ["off", "some", "all"];
const ACCESS_LABEL: Record<CategoryAccess, string> = { off: "Off", some: "Their slice", all: "All" };

/**
 * LifePath's per-person sharing levels, applied to a job: one person at a time, a preset level
 * or Custom per category, a live preview of exactly what they'll receive, and "View as".
 */
export function Sharing({ projectId, onViewAs }: { projectId: string; onViewAs: (id: string) => void }) {
  const { cfg, people, allEvidence, allRequests, updatePerson, addPerson, viewer } = useProject(projectId);
  const outside = people.filter((p) => !isTeam(cfg, p));
  const [selected, setSelected] = useState<string | null>(outside[0]?.id ?? null);
  const [name, setName] = useState("");
  const [role, setRole] = useState(cfg.roles.find((r) => !r.team)!.key);
  const person = outside.find((p) => p.id === selected) ?? null;

  if (viewer) return <div className="card"><p className="muted">Sharing settings are for the team.</p></div>;

  function setLevel(p: Person, level: SharingLevel) {
    const custom = level === "custom" ? { ...accessMap(cfg, p) } : p.sharing?.custom;
    updatePerson(p.id, { sharing: { ...p.sharing, level, custom } });
  }
  function setCustom(p: Person, key: string, a: CategoryAccess) {
    updatePerson(p.id, { sharing: { ...p.sharing, level: "custom", custom: { ...accessMap(cfg, p), [key]: a } } });
  }

  return (
    <div className="grid2" style={{ gridTemplateColumns: "minmax(240px,320px) minmax(0,1fr)" }}>
      <div className="card stack">
        <h2>People outside your team</h2>
        <p className="muted small">Private by default. Each person sees only what their level allows. Unconfirmed records and internal notes are never shared.</p>
        {outside.map((p) => {
          const lvl = p.sharing?.level ?? defaultLevel(cfg, p.role);
          return (
            <button key={p.id} className={`chip${selected === p.id ? " on" : ""}`} style={{ justifyContent: "space-between", borderRadius: 8, padding: "9px 11px" }} onClick={() => setSelected(p.id)}>
              <span style={{ textAlign: "left" }}><strong>{p.name}</strong><br /><span className="small" style={{ opacity: .75 }}>{cfg.roles.find((r) => r.key === p.role)?.label}{p.org ? ` · ${p.org}` : ""}</span></span>
              <span className="small">{lvl === "custom" ? "Custom" : cfg.levels[lvl].label}</span>
            </button>
          );
        })}
        <div className="stack" style={{ gap: 6, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
          <h3>Invite someone</h3>
          <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
            {cfg.roles.filter((r) => !r.team).map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
          <button className="btn" disabled={!name.trim()} onClick={() => { const id = uid("p"); addPerson({ id, projectId, name: name.trim(), role, sharing: { level: defaultLevel(cfg, role) } }); setSelected(id); setName(""); }}>Add with default level</button>
          <p className="small muted">Demo mode: no invitation is sent.</p>
        </div>
      </div>

      {person ? (
        <div className="card stack">
          <div className="spread">
            <div><h2>{person.name}</h2><p className="muted small">{cfg.roles.find((r) => r.key === person.role)?.label}{person.org ? ` · ${person.org}` : ""}</p></div>
            <button className="btn primary" onClick={() => onViewAs(person.id)}>View as {person.name.split(" ")[0]} →</button>
          </div>
          <div className="vp-chips">
            {(["basics", "standard", "everything", "custom"] as SharingLevel[]).map((l) => (
              <button key={l} className={`chip${(person.sharing?.level ?? defaultLevel(cfg, person.role)) === l ? " on" : ""}`} onClick={() => setLevel(person, l)}>
                {l === "custom" ? "Custom" : cfg.levels[l].label}
              </button>
            ))}
          </div>
          {(person.sharing?.level ?? "basics") !== "custom" && <p className="small muted">{cfg.levels[(person.sharing?.level ?? defaultLevel(cfg, person.role)) as Exclude<SharingLevel, "custom">].hint}</p>}
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Category</th><th>Access</th></tr></thead>
              <tbody>
                {previewSummary(cfg, person).map((c) => (
                  <tr key={c.key}>
                    <td><strong>{c.label}</strong><br /><span className="small muted">{c.hint}</span></td>
                    <td>
                      {c.never ? <span className="badge">🔒 Never shared</span> : (
                        <div className="vp-chips">
                          {ACCESS.map((a) => <button key={a} className={`chip${c.access === a ? " on" : ""}`} onClick={() => setCustom(person, c.key, a)}>{ACCESS_LABEL[a]}</button>)}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Preview person={person} total={allEvidence.length} visible={projectEvidence(cfg, person, allEvidence).length} requests={projectRequests(cfg, person, allRequests).length} totalRequests={allRequests.length} money={canSeeMoney(cfg, person)} requestPlural={cfg.requestPlural} />
          <p className="small muted">“Their slice” means records they're part of: messages they sent, jobs assigned to them, and anything linked to them.</p>
        </div>
      ) : <div className="card"><p className="muted">Add someone to share with.</p></div>}
    </div>
  );
}

function Preview({ person, total, visible, requests, totalRequests, money, requestPlural }: { person: Person; total: number; visible: number; requests: number; totalRequests: number; money: boolean; requestPlural: string }) {
  return (
    <div className="notice">
      <strong>{person.name} will see</strong> {visible} of {total} records, {requests} of {totalRequests} {requestPlural.toLowerCase()} (drafts are never shared), and {money ? "prices and totals" : "no prices or totals"}. Private notes are removed from everything they see.
    </div>
  );
}

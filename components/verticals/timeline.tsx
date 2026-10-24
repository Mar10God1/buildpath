"use client";

import { useMemo, useState } from "react";
import { useProject } from "@/lib/verticals/store";
import { dayKey } from "@/lib/verticals/core/evidence";
import { EvidenceBadges, Empty, Photo, fmtDay, fmtTime, money } from "./ui";

/**
 * The record that settles disputes: every capture on one timeline, in swim-lane colors,
 * each with its date certainty, source and strength. Readings collapse to one row per day.
 */
export function Timeline({ projectId }: { projectId: string }) {
  const { cfg, evidence, requests, people, viewer, updateEvidence, removeEvidence } = useProject(projectId);
  const [lanes, setLanes] = useState<string[]>([]);
  const [showReadings, setShowReadings] = useState(false);
  const laneOf = (k: string) => cfg.lanes.find((l) => l.key === k);
  const name = (id?: string) => people.find((p) => p.id === id)?.name;

  const days = useMemo(() => {
    const list = evidence.filter((e) => !lanes.length || lanes.includes(e.lane));
    const byDay = new Map<string, typeof list>();
    for (const e of list) byDay.set(dayKey(e.at), [...(byDay.get(dayKey(e.at)) ?? []), e]);
    return [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [evidence, lanes]);

  const toggle = (k: string) => setLanes((l) => (l.includes(k) ? l.filter((x) => x !== k) : [...l, k]));

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Timeline</h2>
          <p className="muted small">{evidence.length} records{viewer ? ` visible to ${viewer.name}` : ""}. Newest first.</p>
        </div>
        <div className="vp-chips">
          {cfg.lanes.map((l) => (
            <button key={l.key} className={`chip${lanes.includes(l.key) ? " on" : ""}`} onClick={() => toggle(l.key)}>
              <span className="vp-dot" style={{ background: l.color }} />{l.label}
            </button>
          ))}
          {cfg.key === "restore" && <button className={`chip${showReadings ? " on" : ""}`} onClick={() => setShowReadings((v) => !v)}>Show every reading</button>}
        </div>
      </div>
      {!days.length && <Empty>Nothing here yet.</Empty>}
      {days.map(([day, items]) => {
        const readings = items.filter((e) => e.kind === "reading");
        const rest = items.filter((e) => e.kind !== "reading" || showReadings);
        const dayRequests = requests.filter((r) => r.history.some((h) => dayKey(h.at) === day));
        return (
          <div className="tl-day" key={day}>
            <div className="tl-date"><b>{fmtDay(day, { month: "short", day: "numeric" })}</b>{fmtDay(day, { weekday: "long" })}</div>
            <div className="tl-items">
              {!showReadings && readings.length > 0 && (
                <div className="tl-item" style={{ ["--lane" as string]: laneOf("drying")?.color }}>
                  <span className="tl-time">{fmtTime(readings[0].at)}</span>
                  <div>
                    <strong>{readings.length} moisture readings</strong>
                    <div className="muted small">{readings.map((r) => r.title).join(" · ")}</div>
                  </div>
                </div>
              )}
              {rest.map((e) => (
                <div key={e.id} className={`tl-item${e.status === "candidate" ? " cand" : ""}`} style={{ ["--lane" as string]: laneOf(e.lane)?.color }}>
                  <span className="tl-time">{e.dateKind === "unknown" ? "—" : fmtTime(e.at)}</span>
                  <div className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
                    {e.kind === "photo" && <Photo e={e} />}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <strong>{e.title}</strong>
                      {e.amount != null && <span className="badge" style={{ marginLeft: 6 }}>{money(e.amount)}</span>}
                      {e.body && <p className="muted small" style={{ marginTop: 3 }}>{e.body}</p>}
                      {e.privateNote && <div className="private">{e.privateNote}</div>}
                      <div className="tl-meta">
                        <span className="small muted">{laneOf(e.lane)?.label}{name(e.authorId) ? ` · ${name(e.authorId)}` : ""}</span>
                        <EvidenceBadges e={e} />
                        {e.category === "internal" && <span className="badge">🔒 Internal</span>}
                        {!viewer && e.status === "candidate" && (
                          <>
                            <button className="btn sm" onClick={() => updateEvidence(e.id, { status: "confirmed", source: e.source === "inferred" ? "user_correction" : e.source })}>Confirm</button>
                            <button className="btn sm ghost" onClick={() => removeEvidence(e.id)}>Discard</button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {dayRequests.map((r) => {
                const h = r.history.filter((x) => dayKey(x.at) === day).at(-1)!;
                return (
                  <div key={r.id + day} className="tl-item" style={{ ["--lane" as string]: "#111" }}>
                    <span className="tl-time">{fmtTime(h.at)}</span>
                    <div>
                      <strong>{cfg.requestNoun} #{r.number} {h.status}: {r.title}</strong>
                      <div className="tl-meta"><span className="small muted">by {h.by}</span>{r.amount != null && <span className="badge">{money(r.amount)}</span>}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

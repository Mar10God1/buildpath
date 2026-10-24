"use client";

import { useState } from "react";
import { useProject } from "@/lib/verticals/store";
import { aiContext, callAi } from "@/lib/verticals/client-ai";
import type { LogDraft } from "@/lib/verticals/ai/tasks";
import { dayKey, todayLocal, uid } from "@/lib/verticals/core/evidence";
import { canSee } from "@/lib/verticals/core/sharing";
import { fmtDay, fmtTime } from "./ui";

/** BuildPath's daily log: written from the day's confirmed captures, edited, then finalized. */
export function DailyLogs({ projectId }: { projectId: string }) {
  const { cfg, project, people, allEvidence, logs, viewer, saveLog } = useProject(projectId);
  const [date, setDate] = useState(todayLocal());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!project) return null;
  const visible = viewer && !canSee(cfg, viewer, "drying", { id: "log" }) ? [] : logs;
  const dayCaptures = allEvidence.filter((e) => dayKey(e.at) === date && e.status === "confirmed" && e.category !== "internal");

  async function write() {
    setBusy(true); setError(null);
    try {
      const records = dayCaptures.map((e) => ({ lane: e.lane, text: `${fmtTime(e.at)} ${e.title}${e.body ? `. ${e.body}` : ""}` }));
      const res = await callAi<LogDraft>({ product: cfg.key, task: "log", context: aiContext(cfg, project!, people), date, records });
      saveLog({ id: uid("log"), projectId, date, summary: res.result.summary, sections: res.result.sections, status: "draft", sourceEvidenceIds: dayCaptures.map((e) => e.id), aiModel: res.model });
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="stack">
      {!viewer && (
        <div className="card">
          <div className="card-head">
            <div><h2>Write a daily log</h2><p className="muted small">{dayCaptures.length} confirmed capture(s) on this day. Internal notes are left out.</p></div>
            <div className="row">
              <input type="date" className="input" style={{ width: "auto" }} value={date} onChange={(e) => setDate(e.target.value)} />
              <button className="btn primary" disabled={busy || !dayCaptures.length || logs.some((l) => l.date === date && l.status === "final")} onClick={write}>{busy ? "Writing…" : "Write log"}</button>
            </div>
          </div>
          {error && <p className="notice err">{error}</p>}
        </div>
      )}
      {!visible.length && <div className="card"><p className="muted">No daily logs {viewer ? "shared" : "yet"}.</p></div>}
      {visible.map((l) => (
        <div key={l.id} className="card stack">
          <div className="spread">
            <h2>{fmtDay(l.date, { weekday: "long", month: "long", day: "numeric" })}</h2>
            <div className="row">
              <span className={`badge ${l.status === "final" ? "good" : ""}`}>{l.status}</span>
              {l.aiModel ? <span className="badge accent">Written by {l.aiModel}</span> : l.status === "draft" && <span className="badge warn">Pattern draft</span>}
              {!viewer && <button className="btn sm" onClick={() => saveLog({ ...l, status: l.status === "final" ? "draft" : "final" })}>{l.status === "final" ? "Reopen" : "Finalize"}</button>}
            </div>
          </div>
          {!viewer && l.status === "draft" ? <textarea className="input" value={l.summary} onChange={(e) => saveLog({ ...l, summary: e.target.value })} /> : <p>{l.summary}</p>}
          <div className="grid2">
            {cfg.dailyLog.sections.map((s) => (
              <div key={s.key}>
                <h3 style={{ marginBottom: 4 }}>{s.label}</h3>
                {!viewer && l.status === "draft"
                  ? <textarea className="input" value={l.sections[s.key] ?? ""} onChange={(e) => saveLog({ ...l, sections: { ...l.sections, [s.key]: e.target.value } })} />
                  : <p className="small" style={{ whiteSpace: "pre-wrap" }}>{l.sections[s.key] || "None recorded."}</p>}
              </div>
            ))}
          </div>
          <p className="small muted">Built from {l.sourceEvidenceIds.length} capture(s).</p>
        </div>
      ))}
    </div>
  );
}

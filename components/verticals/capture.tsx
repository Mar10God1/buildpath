"use client";

import { useState } from "react";
import { useProject } from "@/lib/verticals/store";
import { aiContext, callAi, evidenceFromCapture, type AiMeta } from "@/lib/verticals/client-ai";
import type { CaptureItem } from "@/lib/verticals/ai/tasks";
import { nowLocal, uid } from "@/lib/verticals/core/evidence";
import { points, rooms } from "@/lib/verticals/restore/drying";
import { EvidenceBadges, Photo, readPhoto } from "./ui";

/**
 * Conversation first, forms second (LifePath). Paste a text, an email or talk through the day;
 * each fact comes back as a candidate for review before it joins the record.
 */
export function Capture({ projectId, onDraftRequest }: { projectId: string; onDraftRequest: (text: string, evidenceIds: string[]) => void }) {
  const { cfg, project, people, allEvidence, addEvidence, updateEvidence, removeEvidence, viewer } = useProject(projectId);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<AiMeta | null>(null);
  const me = people.find((p) => p.projectId === null);
  if (!project) return null;
  const pending = allEvidence.filter((e) => e.status === "candidate").sort((a, b) => b.at.localeCompare(a.at));

  async function run() {
    setBusy(true); setError(null);
    try {
      const res = await callAi<CaptureItem[]>({ product: cfg.key, task: "capture", context: aiContext(cfg, project!, people), text });
      addEvidence(evidenceFromCapture(cfg, project!, people, res.result, me?.id));
      setMeta(res); setText("");
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    const list = await Promise.all([...files].slice(0, 6).map(async (f) => ({
      id: uid("ph"), projectId, kind: "photo" as const, lane: cfg.lanes[0].key, title: f.name.replace(/\.[^.]+$/, ""),
      // The file's modified time is the best date we have in the browser; mark it approximate.
      at: nowLocal(new Date(f.lastModified)), dateKind: "approximate" as const, source: "photo_metadata" as const, authorId: me?.id, links: [],
      status: "candidate" as const, category: cfg.categories[0].key, data: { src: await readPhoto(f) },
    })));
    addEvidence(list);
  }

  if (viewer) return <div className="card"><p className="muted">Capture is for the team. Switch “Viewing as” back to Team to add records.</p></div>;

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <div>
            <h2>Capture</h2>
            <p className="muted small">{cfg.capturePrompt}</p>
          </div>
          <label className="btn">📷 Add photos<input type="file" accept="image/*" multiple hidden onChange={(e) => addPhotos(e.target.files)} /></label>
        </div>
        <textarea className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type, paste, or use your keyboard's dictation…" />
        <div className="spread" style={{ marginTop: 10 }}>
          <div className="stack" style={{ gap: 6, flex: 1, minWidth: 240 }}>
            {cfg.captureExamples.map((ex) => <button key={ex} className="example" onClick={() => setText(ex)}>Try: “{ex.slice(0, 110)}{ex.length > 110 ? "…" : ""}”</button>)}
          </div>
          <button className="btn primary" disabled={busy || text.trim().length < 5} onClick={run}>{busy ? "Reading…" : "Split into records"}</button>
        </div>
        {error && <p className="notice err" style={{ marginTop: 10 }}>{error}</p>}
        {meta && <p className={`notice${meta.mode === "pattern" ? " warn" : ""}`} style={{ marginTop: 10 }}>{meta.mode === "ai" ? `Read by ${meta.model}.` : "AI isn't configured (no ANTHROPIC_API_KEY), so this used pattern matching. Review each record carefully."} New records wait below until someone confirms them.</p>}
      </div>

      {cfg.key === "restore" && <QuickReading projectId={projectId} />}

      <div className="card">
        <div className="card-head">
          <div><h2>Waiting for review</h2><p className="muted small">Candidates never reach the timeline, the claim packet or anyone you share with until they're confirmed.</p></div>
          {pending.length > 1 && <button className="btn" onClick={() => pending.forEach((e) => updateEvidence(e.id, { status: "confirmed" }))}>Confirm all {pending.length}</button>}
        </div>
        {!pending.length && <p className="muted small">Nothing waiting.</p>}
        <div className="stack">
          {pending.map((e) => (
            <div key={e.id} className="tl-item cand" style={{ ["--lane" as string]: cfg.lanes.find((l) => l.key === e.lane)?.color }}>
              {e.kind === "photo" ? <Photo e={e} /> : <span />}
              <div className="stack" style={{ gap: 6 }}>
                <input className="input" value={e.title} onChange={(x) => updateEvidence(e.id, { title: x.target.value })} />
                {e.body && <p className="muted small">{e.body}</p>}
                <div className="row">
                  <select className="input" style={{ width: "auto" }} value={e.lane} onChange={(x) => updateEvidence(e.id, { lane: x.target.value })}>
                    {cfg.lanes.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
                  </select>
                  <select className="input" style={{ width: "auto" }} value={e.category} onChange={(x) => updateEvidence(e.id, { category: x.target.value })} title="Sharing category">
                    {cfg.categories.map((c) => <option key={c.key} value={c.key}>Share as: {c.label}</option>)}
                  </select>
                  {cfg.key === "restore" && rooms(project).length > 0 && (
                    <select className="input" style={{ width: "auto" }} value={rooms(project).find((r) => e.links.includes(r.id))?.id ?? ""} onChange={(x) => updateEvidence(e.id, { links: [...e.links.filter((l) => !rooms(project).some((r) => r.id === l)), x.target.value].filter(Boolean) })}>
                      <option value="">No room</option>
                      {rooms(project).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  )}
                  <input className="input" type="datetime-local" style={{ width: "auto" }} value={e.at.slice(0, 16)} onChange={(x) => updateEvidence(e.id, { at: `${x.target.value}:00`, dateKind: "exact", source: e.source === "inferred" ? "user_correction" : e.source })} title="Correct the date; corrected dates are marked exact" />
                </div>
                <div className="tl-meta">
                  <EvidenceBadges e={e} />
                  <button className="btn sm primary" onClick={() => updateEvidence(e.id, { status: "confirmed" })}>Confirm</button>
                  {Boolean(e.data?.isRequest) && <button className="btn sm" onClick={() => { updateEvidence(e.id, { status: "confirmed" }); onDraftRequest(e.body || e.title, [e.id]); }}>Draft {cfg.requestNoun.toLowerCase()} →</button>}
                  <button className="btn sm ghost" onClick={() => removeEvidence(e.id)}>Discard</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function QuickReading({ projectId }: { projectId: string }) {
  const { project, addEvidence, people } = useProject(projectId);
  const pts = points(project!);
  const [values, setValues] = useState<Record<string, string>>({});
  const tech = people.find((p) => p.role === "tech") ?? people.find((p) => p.projectId === null);
  function save() {
    const at = nowLocal();
    const list = pts.filter((p) => values[p.id]?.trim()).map((p) => ({
      id: uid("rd"), projectId, kind: "reading" as const, lane: "drying", category: "drying", title: `${p.label} ${Number(values[p.id])}`,
      at, dateKind: "exact" as const, source: "instrument" as const, authorId: tech?.id, links: [p.id, p.roomId], status: "confirmed" as const,
      data: { pointId: p.id, value: Number(values[p.id]) },
    }));
    if (list.length) { addEvidence(list); setValues({}); }
  }
  if (!pts.length) return null;
  return (
    <div className="card">
      <div className="card-head"><div><h2>Today's readings</h2><p className="muted small">Meter readings are instrument records: the strongest evidence a carrier sees.</p></div><button className="btn primary" onClick={save}>Save readings</button></div>
      <div className="grid4">
        {pts.map((p) => (
          <label key={p.id} className="field">{p.label} · {p.material} (goal {p.goal})
            <input className="input" inputMode="decimal" value={values[p.id] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [p.id]: e.target.value.replace(/[^\d.]/g, "") }))} />
          </label>
        ))}
      </div>
    </div>
  );
}

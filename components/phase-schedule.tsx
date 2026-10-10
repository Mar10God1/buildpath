"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  type Activity, type Dependency, type ImpactLink, type Outcome,
  forecastSchedule, setbackEffect, toDay, fromDay,
} from "@/lib/schedule-impact";
import styles from "./phase-schedule.module.css";

type EventLite = { id: string; event_type: string; title: string; start_at: string | null; end_at: string | null; schedule_impact_days: number | null };
type Project = { id: string; baseline_start: string | null; target_finish: string | null };
type LinkRow = { id: string; from_id: string; to_id: string };

const LABEL_W = 232, AXIS_H = 46, ROW_H = 40, BAR_H = 18;
const datePart = (s: string | null | undefined) => s?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
const fmt = (n: number, withYear = false) => new Date(fromDay(n) + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" });
const plural = (n: number, w: string) => n + " " + w + (n === 1 ? "" : "s");
const todayDay = () => { const d = new Date(); return toDay([d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-")); };

export function PhaseSchedule({ project, events, canEdit, focusEventId, onFocusEvent }: {
  project: Project; events: EventLite[]; canEdit: boolean;
  focusEventId: string | null; onFocusEvent: (id: string | null) => void;
}) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [deps, setDeps] = useState<Dependency[]>([]);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [error, setError] = useState("");
  const [panel, setPanel] = useState<null | "add" | "link" | { edit: string }>(null);
  const [saving, setSaving] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);

  const load = useCallback(async () => {
    const sb = createClient();
    const [a, d, r] = await Promise.all([
      sb.from("project_activities").select("id,name,trade,sort_order,planned_start,planned_finish,actual_start,actual_finish,percent_complete,notes").eq("project_id", project.id).order("sort_order"),
      sb.from("activity_dependencies").select("id,predecessor_id,successor_id,dependency_type,lag_days").eq("project_id", project.id),
      sb.from("relationships").select("id,from_id,to_id").eq("project_id", project.id).eq("from_type", "project_event").eq("relationship_type", "impacts").eq("to_type", "project_activity"),
    ]);
    const err = a.error || d.error || r.error;
    if (err) {
      // Table not created yet (migration not applied) → explain instead of erroring.
      if (/does not exist|schema cache|42P01/i.test(err.message)) { setState("missing"); return; }
      setError(err.message); setState("error"); return;
    }
    setActivities((a.data || []) as Activity[]); setDeps((d.data || []) as Dependency[]); setLinks((r.data || []) as LinkRow[]);
    setState("ready");
  }, [project.id]);
  useEffect(() => { setState("loading"); setPanel(null); load(); }, [load]);

  useEffect(() => {
    const el = plotRef.current; if (!el) return;
    const ro = new ResizeObserver(entries => setWidth(Math.max(480, entries[0].contentRect.width)));
    ro.observe(el); return () => ro.disconnect();
  }, [state, activities.length]);

  const eventById = useMemo(() => new Map(events.map(e => [e.id, e])), [events]);
  const impacts: ImpactLink[] = useMemo(() => links.filter(l => eventById.has(l.from_id)).map(l => ({
    id: l.id, event_id: l.from_id, activity_id: l.to_id, days: Math.max(0, Number(eventById.get(l.from_id)?.schedule_impact_days) || 0),
  })), [links, eventById]);
  const ordered = useMemo(() => [...activities].sort((a, b) => a.sort_order - b.sort_order || a.planned_start.localeCompare(b.planned_start)), [activities]);
  const forecast = useMemo(() => forecastSchedule(activities, deps, impacts), [activities, deps, impacts]);
  const setbackIds = useMemo(() => [...new Set(impacts.map(i => i.event_id))].sort((a, b) =>
    (datePart(eventById.get(a)?.start_at) || "").localeCompare(datePart(eventById.get(b)?.start_at) || "")), [impacts, eventById]);
  const focus = focusEventId && setbackIds.includes(focusEventId) ? focusEventId : null;
  const effect = useMemo(() => focus ? setbackEffect(focus, activities, deps, impacts, forecast) : null, [focus, activities, deps, impacts, forecast]);

  if (state === "loading") return <section className={"panel " + styles.root}><p className={styles.muted}>Loading phase schedule…</p></section>;
  if (state === "missing") return <section className={"panel " + styles.root}>
    <Heading canEdit={false} onAdd={() => {}} onLink={() => {}} />
    <div className={styles.notice}>Phase tracking needs a one-time database update before it can be used on this project.</div>
  </section>;
  if (state === "error") return <section className={"panel " + styles.root}><div role="alert" className="form-message">{error}</div></section>;

  // ---- Axis ---------------------------------------------------------------
  const days: number[] = [];
  for (const a of activities) { const f = forecast.get(a.id)!; days.push(toDay(a.planned_start), toDay(a.planned_finish) + 1, f.start, f.finish + 1); }
  if (project.baseline_start) days.push(toDay(project.baseline_start));
  if (project.target_finish) days.push(toDay(project.target_finish));
  const today = todayDay(); days.push(today);
  const lo = days.length ? Math.min(...days) : today - 60, hi = days.length ? Math.max(...days) : today + 60;
  const pad = Math.max(5, Math.round((hi - lo) * 0.02));
  const a0 = lo - pad, a1 = hi + pad, span = Math.max(1, a1 - a0);
  const x = (d: number) => ((d - a0) / span) * width;
  const months: { d: number; label: string; year: boolean }[] = [];
  { const f = new Date(fromDay(a0) + "T12:00:00Z"); let y = f.getUTCFullYear(), m = f.getUTCMonth(); const step = span / 30.4 > 20 ? 3 : span / 30.4 > 12 ? 2 : 1;
    for (let i = 0; i < 240; i++) { const iso = y + "-" + String(m + 1).padStart(2, "0") + "-01"; const d = toDay(iso); if (d > a1) break;
      if (d >= a0 && m % step === 0) months.push({ d, year: m === 0 || !months.length, label: new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }) + (m === 0 || !months.length ? " " + y : "") });
      m++; if (m > 11) { m = 0; y++; } } }
  const rowIndex = new Map(ordered.map((a, i) => [a.id, i]));
  const rowMid = (id: string) => AXIS_H + (rowIndex.get(id) ?? 0) * ROW_H + ROW_H / 2;
  const plotH = AXIS_H + ordered.length * ROW_H + 8;
  const finish = project.target_finish ? toDay(project.target_finish) : null;
  const lastForecast = activities.length ? Math.max(...activities.map(a => forecast.get(a.id)!.finish)) : null;
  const projectSlip = finish !== null && lastForecast !== null ? lastForecast - finish : null;

  const outcomeOf = (id: string): Outcome | null => effect ? effect.outcome.get(id) || "unaffected" : null;
  const focusEvent = focus ? eventById.get(focus) : null;
  const focusStart = focusEvent ? datePart(focusEvent.start_at) || datePart(focusEvent.end_at) : null;
  const focusEnd = focusEvent ? datePart(focusEvent.end_at) || focusStart : null;

  // ---- Mutations ------------------------------------------------------------
  async function addPhase(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (saving) return;
    const f = new FormData(e.currentTarget);
    const ps = String(f.get("planned_start") || ""), pf = String(f.get("planned_finish") || "");
    if (!String(f.get("name") || "").trim() || !ps || !pf || pf < ps) { setError("Name, planned start and a planned finish on or after the start are required."); return; }
    setSaving(true); setError("");
    const sb = createClient();
    const ins = await sb.from("project_activities").insert({
      project_id: project.id, name: String(f.get("name")).trim(), trade: String(f.get("trade") || "").trim() || null,
      planned_start: ps, planned_finish: pf, percent_complete: Number(f.get("percent") || 0),
      sort_order: (Math.max(0, ...activities.map(a => a.sort_order)) + 10),
    }).select("id").single();
    if (ins.error) { setSaving(false); setError(ins.error.message); return; }
    const preds = f.getAll("preds").map(String).filter(Boolean);
    if (preds.length) {
      const r = await sb.from("activity_dependencies").insert(preds.map(p => ({ project_id: project.id, predecessor_id: p, successor_id: ins.data.id, dependency_type: "FS", lag_days: 0 })));
      if (r.error) setError(r.error.message);
    }
    setSaving(false); setPanel(null); load();
  }
  async function savePhase(e: FormEvent<HTMLFormElement>, a: Activity) {
    e.preventDefault(); if (saving) return;
    const f = new FormData(e.currentTarget);
    const ps = String(f.get("planned_start") || ""), pf = String(f.get("planned_finish") || "");
    const as = String(f.get("actual_start") || "") || null, af = String(f.get("actual_finish") || "") || null;
    if (!ps || !pf || pf < ps || (as && af && af < as)) { setError("Check the dates: finishes must be on or after starts."); return; }
    setSaving(true); setError("");
    const sb = createClient();
    const pct = af ? 100 : Number(f.get("percent") || 0);
    const up = await sb.from("project_activities").update({ name: String(f.get("name") || a.name).trim(), trade: String(f.get("trade") || "").trim() || null,
      planned_start: ps, planned_finish: pf, actual_start: as, actual_finish: af, percent_complete: pct, updated_at: new Date().toISOString() })
      .eq("id", a.id).eq("project_id", project.id);
    if (up.error) { setSaving(false); setError(up.error.message); return; }
    const want = new Set(f.getAll("preds").map(String));
    const have = deps.filter(d => d.successor_id === a.id);
    const remove = have.filter(d => !want.has(d.predecessor_id)).map(d => d.id!).filter(Boolean);
    const add = [...want].filter(p => !have.some(d => d.predecessor_id === p));
    if (remove.length) await sb.from("activity_dependencies").delete().in("id", remove);
    if (add.length) { const r = await sb.from("activity_dependencies").insert(add.map(p => ({ project_id: project.id, predecessor_id: p, successor_id: a.id, dependency_type: "FS", lag_days: 0 }))); if (r.error) setError(r.error.message); }
    setSaving(false); setPanel(null); load();
  }
  async function linkSetback(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (saving) return;
    const f = new FormData(e.currentTarget);
    const ev = String(f.get("event") || ""), act = String(f.get("activity") || "");
    if (!ev || !act) { setError("Choose a setback and the phase it hit."); return; }
    setSaving(true); setError("");
    const r = await createClient().from("relationships").insert({ project_id: project.id, from_type: "project_event", from_id: ev, relationship_type: "impacts", to_type: "project_activity", to_id: act, confidence: 1, is_user_confirmed: true });
    setSaving(false);
    if (r.error && !/duplicate/i.test(r.error.message)) { setError(r.error.message); return; }
    setPanel(null); onFocusEvent(ev); load();
  }
  async function unlink(linkId: string) {
    if (saving) return; setSaving(true);
    const r = await createClient().from("relationships").delete().eq("id", linkId).eq("project_id", project.id);
    setSaving(false); if (r.error) { setError(r.error.message); return; }
    load();
  }

  const linkable = events.filter(e => Number(e.schedule_impact_days) > 0 || /delay|setback|weather|rework|issue|risk|change|rfi/i.test(e.event_type + " " + e.title));
  const editing = panel && typeof panel === "object" ? activities.find(a => a.id === panel.edit) || null : null;

  // ---- Summary text for the focused setback ---------------------------------
  const summary = (() => {
    if (!effect || !focusEvent) return null;
    const name = (id: string) => activities.find(a => a.id === id)?.name || "phase";
    const direct = effect.directIds.map(name);
    const pushed = ordered.filter(a => effect.outcome.get(a.id) === "pushed").map(a => ({ name: a.name, d: effect.delta.get(a.id)! }));
    const absorbedList = ordered.filter(a => effect.outcome.get(a.id) === "absorbed").map(a => a.name);
    const clear = ordered.filter(a => effect.outcome.get(a.id) === "unaffected").map(a => a.name);
    const directDone = effect.directIds.every(id => forecast.get(id)?.complete);
    return { direct, pushed, absorbedList, clear, directDone };
  })();

  return <section className={"panel " + styles.root} aria-label="Phase schedule and dependencies">
    <Heading canEdit={canEdit} onAdd={() => { setPanel(panel === "add" ? null : "add"); setError(""); }} onLink={() => { setPanel(panel === "link" ? null : "link"); setError(""); }} />

    <div className={styles.kpis}>
      <div><span>Phases</span><strong>{activities.filter(a => forecast.get(a.id)?.complete).length} / {activities.length} complete</strong></div>
      <div><span>Forecast late</span><strong>{activities.filter(a => !forecast.get(a.id)?.complete && (forecast.get(a.id)?.slip || 0) > 0).length} of {activities.filter(a => !forecast.get(a.id)?.complete).length} open phases</strong><small>finishing after their planned date</small></div>
      <div data-tone={projectSlip && projectSlip > 0 ? "late" : "ok"}><span>Forecast finish</span><strong>{lastForecast !== null ? fmt(lastForecast, true) : "—"}</strong>
        <small>{projectSlip === null ? "Set a target finish to compare" : projectSlip > 0 ? plural(projectSlip, "day") + " past target" : projectSlip < 0 ? plural(-projectSlip, "day") + " ahead of target" : "On target"}</small></div>
    </div>

    {setbackIds.length > 0 && <div className={styles.setbacks} role="group" aria-label="Select a setback to see its ripple effect">
      <span className={styles.setbacksLabel}>Trace a setback</span>
      <button type="button" className={styles.sbChip} aria-pressed={!focus} onClick={() => onFocusEvent(null)}>All combined</button>
      {setbackIds.map(id => { const e = eventById.get(id)!; const d = Number(e.schedule_impact_days) || 0;
        return <button type="button" key={id} className={styles.sbChip} aria-pressed={focus === id} onClick={() => onFocusEvent(focus === id ? null : id)} title={e.title}>
          {e.title.length > 34 ? e.title.slice(0, 33) + "…" : e.title}{d > 0 && <b>+{d}d</b>}
        </button>; })}
    </div>}

    {summary && focusEvent && <div className={styles.summary}>
      <strong>{focusEvent.title}</strong>
      <p>
        Hit <b>{summary.direct.join(", ")}</b>{summary.directDone ? " (already finished — the delay is in its actual dates)" : ""}.{" "}
        {summary.pushed.length
          ? <>Pushes {summary.pushed.map((p, i) => <span key={p.name}>{i ? ", " : ""}<b className={styles.pushTxt}>{p.name} +{p.d}d</b></span>)}.</>
          : <>Doesn't push any later phase.</>}{" "}
        {summary.absorbedList.length > 0 && <>Absorbed by slack in <b>{summary.absorbedList.join(", ")}</b>. </>}
        {summary.clear.length > 0 && <>No effect on {summary.clear.join(", ")}.</>}
      </p>
      {canEdit && <div className={styles.unlinks}>{links.filter(l => l.from_id === focus).map(l => <button type="button" key={l.id} className={styles.unlink} onClick={() => unlink(l.id)} disabled={saving}>Unlink from {activities.find(a => a.id === l.to_id)?.name || "phase"}</button>)}</div>}
    </div>}

    {error && <div role="alert" className="form-message">{error}</div>}

    {canEdit && panel === "add" && <form className={styles.editor} onSubmit={addPhase}>
      <label>Phase name <input name="name" required placeholder="e.g. Interior framing" /></label>
      <label>Trade / sub <input name="trade" placeholder="e.g. Lone Star Framing" /></label>
      <label>Planned start <input type="date" name="planned_start" required /></label>
      <label>Planned finish <input type="date" name="planned_finish" required /></label>
      <label>% complete <input type="number" name="percent" min={0} max={100} defaultValue={0} /></label>
      <fieldset className={styles.full}><legend>Can't start until these finish</legend><div className={styles.predGrid}>
        {ordered.map(a => <label key={a.id} className={styles.check}><input type="checkbox" name="preds" value={a.id} />{a.name}</label>)}
      </div></fieldset>
      <div className={styles.actions}><button className="primary-action" disabled={saving}>{saving ? "Saving…" : "Add phase"}</button><button type="button" className="secondary-action" onClick={() => setPanel(null)}>Cancel</button></div>
    </form>}

    {canEdit && panel === "link" && <form className={styles.editor} onSubmit={linkSetback}>
      <label>Setback / event <select name="event" required defaultValue="">
        <option value="" disabled>Choose an event…</option>
        {linkable.map(e => <option key={e.id} value={e.id}>{(datePart(e.start_at) || "undated") + " · " + e.title + (Number(e.schedule_impact_days) > 0 ? " (+" + e.schedule_impact_days + "d)" : "")}</option>)}
      </select></label>
      <label>Phase it hit <select name="activity" required defaultValue="">
        <option value="" disabled>Choose a phase…</option>
        {ordered.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select></label>
      <p className={styles.full + " " + styles.muted}>The event's reported impact days are applied to that phase and carried through its dependencies.</p>
      <div className={styles.actions}><button className="primary-action" disabled={saving}>{saving ? "Saving…" : "Link setback"}</button><button type="button" className="secondary-action" onClick={() => setPanel(null)}>Cancel</button></div>
    </form>}

    {canEdit && editing && <form key={editing.id} className={styles.editor} onSubmit={e => savePhase(e, editing)}>
      <label>Phase name <input name="name" defaultValue={editing.name} required /></label>
      <label>Trade / sub <input name="trade" defaultValue={editing.trade || ""} /></label>
      <label>Planned start <input type="date" name="planned_start" defaultValue={editing.planned_start} required /></label>
      <label>Planned finish <input type="date" name="planned_finish" defaultValue={editing.planned_finish} required /></label>
      <label>Actual start <input type="date" name="actual_start" defaultValue={editing.actual_start || ""} /></label>
      <label>Actual finish <input type="date" name="actual_finish" defaultValue={editing.actual_finish || ""} /></label>
      <label>% complete <input type="number" name="percent" min={0} max={100} defaultValue={editing.percent_complete} /></label>
      <fieldset className={styles.full}><legend>Can't start until these finish</legend><div className={styles.predGrid}>
        {ordered.filter(a => a.id !== editing.id).map(a => <label key={a.id} className={styles.check}><input type="checkbox" name="preds" value={a.id} defaultChecked={deps.some(d => d.successor_id === editing.id && d.predecessor_id === a.id)} />{a.name}</label>)}
      </div></fieldset>
      <div className={styles.actions}><button className="primary-action" disabled={saving}>{saving ? "Saving…" : "Save phase"}</button><button type="button" className="secondary-action" onClick={() => setPanel(null)}>Cancel</button></div>
    </form>}

    {activities.length === 0 ? <div className={styles.notice}>No phases yet. {canEdit ? "Add the major phases of work (sitework, foundations, framing…) and what each one waits on." : "Phases will appear here once they're added."}</div> :
    <div className={styles.chart} data-focus={Boolean(effect)}>
      <div className={styles.labels} style={{ width: LABEL_W, paddingTop: AXIS_H }}>
        {ordered.map(a => { const f = forecast.get(a.id)!; const o = outcomeOf(a.id); const d = effect?.delta.get(a.id) || 0;
          return <button type="button" key={a.id} className={styles.label} data-outcome={o || undefined} style={{ height: ROW_H }}
            onClick={() => canEdit && setPanel(panel && typeof panel === "object" && panel.edit === a.id ? null : { edit: a.id })}
            onMouseEnter={() => setHover(a.id)} onMouseLeave={() => setHover(null)} title={canEdit ? "Edit phase" : a.name}>
            <span className={styles.name}>{a.name}</span>
            <span className={styles.meta}>{f.complete ? "Done" : a.percent_complete + "%"}{a.trade ? " · " + a.trade : ""}</span>
            {o === "direct" && <em className={styles.tag} data-k="direct">hit{f.complete ? " · done" : ""}</em>}
            {o === "pushed" && <em className={styles.tag} data-k="pushed">+{d}d</em>}
            {o === "absorbed" && <em className={styles.tag} data-k="absorbed">absorbed</em>}
            {!o && !f.complete && f.slip > 0 && <em className={styles.tag} data-k="late">+{f.slip}d</em>}
          </button>; })}
      </div>
      <div className={styles.plotWrap}>
        <div className={styles.plot} ref={plotRef} style={{ height: plotH }}>
          {months.map(m => <div key={m.d} className={styles.month} data-year={m.year} style={{ left: x(m.d), height: plotH }}><span>{m.label}</span></div>)}
          {ordered.map((a, i) => <div key={a.id} className={styles.rowBg} data-odd={i % 2 === 1} data-hover={hover === a.id} style={{ top: AXIS_H + i * ROW_H, height: ROW_H }} />)}
          {finish !== null && <div className={styles.finishLine} data-flip={x(finish + 1) > width - 90} style={{ left: x(finish + 1), height: plotH }}><b>Target finish</b></div>}
          {today >= a0 && today <= a1 && <div className={styles.today} style={{ left: x(today), height: plotH }}><b>Today</b></div>}
          {focusStart && <div className={styles.eventBand} style={{ left: x(toDay(focusStart)), width: Math.max(6, x(toDay(focusEnd!) + 1) - x(toDay(focusStart))), height: plotH }}>
            <b>{focusEvent!.title.length > 28 ? focusEvent!.title.slice(0, 27) + "…" : focusEvent!.title}</b></div>}

          <svg className={styles.arrows} width={width} height={plotH} aria-hidden="true">
            <defs>
              <marker id="ps-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#9aa3a8" /></marker>
              <marker id="ps-arrow-hot" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#e0622a" /></marker>
            </defs>
            {deps.map(d => {
              const p = forecast.get(d.predecessor_id), s = forecast.get(d.successor_id);
              if (!p || !s || !rowIndex.has(d.predecessor_id) || !rowIndex.has(d.successor_id)) return null;
              const x1 = d.dependency_type === "SS" ? x(p.start) : x(p.finish + 1), y1 = rowMid(d.predecessor_id) + (d.dependency_type === "SS" ? -BAR_H / 2 : 0);
              const x2 = x(s.start), y2 = rowMid(d.successor_id) + (y1 < rowMid(d.successor_id) ? -BAR_H / 2 - 1 : BAR_H / 2 + 1);
              const po = outcomeOf(d.predecessor_id), so = outcomeOf(d.successor_id);
              const hot = Boolean(effect) && (po === "direct" || po === "pushed") && so === "pushed";
              const soaked = Boolean(effect) && (po === "direct" || po === "pushed") && so === "absorbed";
              const dim = Boolean(effect) && !hot && !soaked;
              const bend = Math.max(14, Math.min(40, Math.abs(x2 - x1) / 2));
              const path = "M" + x1 + "," + y1 + " C" + (x1 + bend) + "," + y1 + " " + (x2 - bend) + "," + y2 + " " + x2 + "," + y2;
              return <path key={d.predecessor_id + d.successor_id} d={path} className={styles.dep} data-hot={hot} data-soaked={soaked} data-dim={dim}
                markerEnd={hot ? "url(#ps-arrow-hot)" : "url(#ps-arrow)"} />;
            })}
          </svg>

          {ordered.map((a, i) => {
            const f = forecast.get(a.id)!; const o = outcomeOf(a.id);
            const ps = toDay(a.planned_start), pf = toDay(a.planned_finish);
            const top = AXIS_H + i * ROW_H + (ROW_H - BAR_H) / 2;
            const status = f.complete ? "done" : f.slip > 0 ? "late" : f.started ? "active" : "planned";
            const left = x(f.start), w = Math.max(6, x(f.finish + 1) - x(f.start));
            const slipFrom = Math.max(f.start, pf + 1);
            const d = effect?.delta.get(a.id) || 0;
            return <div key={a.id} className={styles.barGroup} data-outcome={o || undefined}>
              <div className={styles.planned} style={{ left: x(ps), width: Math.max(4, x(pf + 1) - x(ps)), top: top - 3, height: BAR_H + 6 }} title={"Planned " + fmt(ps) + " – " + fmt(pf)} />
              <div className={styles.bar} data-status={status} style={{ left, width: w, top, height: BAR_H }}
                title={a.name + " · forecast " + fmt(f.start) + " – " + fmt(f.finish) + (f.slip > 0 ? " · " + plural(f.slip, "day") + " past plan" : "")}
                onMouseEnter={() => setHover(a.id)} onMouseLeave={() => setHover(null)}>
                <i className={styles.progress} style={{ width: (f.complete ? 100 : a.percent_complete) + "%" }} />
                {!f.complete && f.slip > 0 && slipFrom <= f.finish && <i className={styles.slip} style={{ left: x(slipFrom) - left, width: x(f.finish + 1) - x(slipFrom) }} />}
                {o === "pushed" && d > 0 && <i className={styles.push} style={{ left: Math.max(0, w - (x(f.finish + 1) - x(f.finish + 1 - d))), width: x(f.finish + 1) - x(f.finish + 1 - d) }} />}
              </div>
            </div>;
          })}
        </div>
      </div>
    </div>}

    <div className={styles.key}>
      <span><i data-k="planned" />Planned dates</span><span><i data-k="done" />Complete</span><span><i data-k="active" />In progress</span>
      <span><i data-k="late" />Running late</span><span><i data-k="slip" />Slip past plan</span>
      {effect && <><span><i data-k="push" />Pushed by this setback</span><span><i data-k="absorbed" />Absorbed by slack</span></>}
      <span className={styles.keyNote}>Arrows show what each phase waits on. Forecasts carry recorded impact days through those dependencies (calendar days).</span>
    </div>
  </section>;
}

function Heading({ canEdit, onAdd, onLink }: { canEdit: boolean; onAdd: () => void; onLink: () => void }) {
  return <div className={styles.heading}>
    <div><p className="eyebrow">PHASES & DEPENDENCIES</p><h3>Where each phase stands — and what a setback touches</h3>
      <p className={styles.sub}>Pick a setback to see which phases it pushes, which have slack to absorb it, and which it doesn't touch.</p></div>
    {canEdit && <div className={styles.headActions}><button type="button" className="secondary-action" onClick={onLink}>Link a setback</button><button type="button" className="primary-action" onClick={onAdd}>＋ Add phase</button></div>}
  </div>;
}

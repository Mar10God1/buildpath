"use client";

import { type CSSProperties, FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./project-schedule-timeline.module.css";

type Project = { id: string; baseline_start: string | null; target_finish: string | null; status: string };
type Event = {
  id: string; event_type: string; title: string; description: string | null;
  start_at: string | null; end_at: string | null; status: string | null;
  schedule_impact_days: number | null; cost_impact?: number | null;
};
type Milestone = Event & { planned: string | null; actual: string | null; complete: boolean };
type Tone = "done" | "late" | "next" | "planned" | "unknown";
type EventCategory = "milestone" | "weather" | "injury" | "setback" | "change" | "decision" | "field" | "meeting" | "general";

function categoryForEvent(e: Event): EventCategory {
  const type = e.event_type.toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  const label = e.title.toLowerCase();
  if (type === "milestone") return "milestone";
  if (/(injury|injur|accident|safety)/.test(type) || /\b(work(er|place)? injury|injured worker|jobsite accident|workplace accident|lost.time incident|near miss)\b/.test(label)) return "injury";
  if (/(weather|storm|rain|snow|flood)/.test(type) || /\b(weather delay|storm delay|heavy rain|snow storm|flooding)\b/.test(label)) return "weather";
  if (Number(e.schedule_impact_days) > 0 || /(delay|setback|disruption|blocker|risk|issue)/.test(type) || /\b(delayed|delay|behind schedule|schedule slip|setback|rework|blocked)\b/.test(label)) return "setback";
  if (/(change|rfi)/.test(type)) return "change";
  if (/(decision|approval)/.test(type)) return "decision";
  if (/(field|inspection|work)/.test(type)) return "field";
  if (/(meeting|call)/.test(type)) return "meeting";
  return "general";
}
const categoryName: Record<EventCategory, string> = {
  milestone: "Milestone", weather: "Weather", injury: "Safety / injury",
  setback: "Schedule setback", change: "Change", decision: "Decision",
  field: "Field work", meeting: "Meeting", general: "Project event",
};
const categoryGlyph: Record<EventCategory, string> = {
  milestone: "◆", weather: "☁", injury: "✚", setback: "!", change: "⇄",
  decision: "✓", field: "▤", meeting: "◉", general: "•",
};
function isDisruption(e: Event, kind: EventCategory) {
  if (kind === "injury" || kind === "setback") return true;
  // Weather alone isn't a schedule delay: flag only recorded disruptions.
  return kind === "weather" && (Number(e.schedule_impact_days) > 0 || /delay|disruption|setback/.test(e.event_type.toLowerCase() + " " + e.title.toLowerCase()));
}


const datePart = (s: string | null | undefined) => {
  const result = s?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
  return result && Number.isFinite(Date.parse(result + "T12:00:00Z")) ? result : null;
};
const day = (s: string) => Date.parse(s + "T12:00:00Z") / 86400000;
const dateFromDay = (n: number) => new Date((n * 86400000)).toISOString().slice(0, 10);
const labelDate = (s: string | null) => s ? new Date(s + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "Not recorded";
const shortDate = (s: string) => new Date(s + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
const localToday = () => { const d = new Date(); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-"); };
const isCompleted = (e: Event) => Boolean(datePart(e.end_at)) || ["complete", "completed", "done", "achieved"].includes((e.status || "").toLowerCase());
const toneOf = (m: Milestone, today: string): Tone => {
  if (!m.planned) return "unknown";
  if (m.complete) return !m.actual ? "unknown" : m.actual > m.planned ? "late" : "done";
  if (today && m.planned < today) return "late";
  if (today && day(m.planned) - day(today) <= 14 && m.planned >= today) return "next";
  return "planned";
};
const toneLabel = (m: Milestone, today: string) => {
  const tone = toneOf(m, today);
  if (m.complete && !m.actual) return "Completed · date unverified";
  if (tone === "late") return m.complete ? "Completed late" : "Overdue";
  if (tone === "done") return "Completed";
  if (tone === "next") return "Due soon";
  if (tone === "unknown") return "Needs planned date";
  return "Upcoming";
};

export function ProjectScheduleTimeline({ project, events, refresh }: { project: Project; events: Event[]; refresh: () => void }) {
  const [today, setToday] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingBaseline, setEditingBaseline] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { setToday(localToday()); }, []);
  useEffect(() => { setAdding(false); setEditingBaseline(false); setEditing(null); setSelected(null); setError(""); }, [project.id]);

  const milestones: Milestone[] = events.filter(e => e.event_type.toLowerCase() === "milestone").map(e => ({
    ...e, planned: datePart(e.start_at), actual: datePart(e.end_at), complete: isCompleted(e),
  })).sort((a, b) => (a.planned || "9999").localeCompare(b.planned || "9999"));
  // All canonical project events are plotted, regardless of type. Milestones retain
  // their separate planned-versus-actual schedule semantics.
  const timelineItems = events.map(e => ({
    event: e,
    date: datePart(e.start_at) || datePart(e.end_at),
    milestone: milestones.find(m => m.id === e.id) || null,
    category: categoryForEvent(e),
  })).sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999") || a.event.title.localeCompare(b.event.title));
  const plottedEvents = timelineItems.filter((item): item is typeof item & {date: string} => item.date !== null);
  const undatedEvents = timelineItems.filter(item => !item.date);
  const disruptions = plottedEvents.filter(item => isDisruption(item.event, item.category));
  const weatherCount = events.filter(e => categoryForEvent(e) === "weather").length;
  const safetyCount = events.filter(e => categoryForEvent(e) === "injury").length;
  const setbackCount = events.filter(e => categoryForEvent(e) === "setback").length;
  const dated = milestones.filter(m => m.planned !== null);
  const completed = milestones.filter(m => m.complete).length;
  const overdue = milestones.filter(m => !m.complete && m.planned && today && m.planned < today);
  const lateDone = milestones.filter(m => m.complete && m.planned && m.actual && m.actual > m.planned);
  const unverified = milestones.filter(m => m.complete && !m.actual).length;
  const reportedImpacts = events.filter(e => e.event_type.toLowerCase() !== "milestone" && Number(e.schedule_impact_days) > 0);
  const impactDays = reportedImpacts.reduce((s, e) => s + Number(e.schedule_impact_days || 0), 0);
  const baselineStart = datePart(project.baseline_start);
  const baselineFinish = datePart(project.target_finish);
  const projectComplete = ["completed", "complete", "closed"].includes(project.status.toLowerCase());
  const finishOverdue = Boolean(today && baselineFinish && today > baselineFinish && !projectComplete);
  const hasBaseline = Boolean(baselineStart && baselineFinish && baselineStart < baselineFinish);
  const isNotStarted = Boolean(today && baselineStart && today < baselineStart);

  let headline = "Schedule needs data";
  let summary = "Add a baseline start, target finish, and dated milestones to verify schedule health.";
  let health: "late" | "risk" | "good" | "neutral" = "neutral";
  if (overdue.length || finishOverdue) {
    headline = "Behind schedule"; health = "late";
    summary = overdue.length ? overdue.length + " open milestone" + (overdue.length === 1 ? " is" : "s are") + " past the planned date." : "The target finish has passed without project completion being recorded.";
  } else if (lateDone.length > 0) {
    headline = "Milestone slippage recorded"; health = "risk";
    summary = lateDone.length + " milestone" + (lateDone.length === 1 ? " was" : "s were") + " completed after the planned date. Review whether the project has recovered.";
  } else if (impactDays > 0) {
    headline = "Schedule at risk"; health = "risk";
    summary = "There are " + reportedImpacts.length + " recorded schedule-impact events (" + impactDays + " reported days). These are not a critical-path forecast.";
  } else if (isNotStarted && hasBaseline) {
    headline = "Not started"; summary = "The baseline begins " + labelDate(baselineStart) + ".";
  } else if (hasBaseline && milestones.length && completed > 0 && !unverified && dated.length === milestones.length) {
    headline = "On track · recorded milestones"; health = "good";
    summary = "No overdue milestones or positive schedule impacts are currently recorded. This is not a verified critical-path forecast.";
  } else if (hasBaseline && milestones.length) {
    headline = "Schedule needs verification";
    summary = "Some milestone dates are missing or unverified. Add actual completion dates to assess progress.";
  } else if (hasBaseline) {
    headline = "Milestones needed";
    summary = "Your project baseline exists, but no milestones are available to assess schedule adherence.";
  }

  const allDates = [baselineStart, baselineFinish, today || null, ...plottedEvents.flatMap(item => [item.date, item.milestone ? null : datePart(item.event.end_at)])].filter((x): x is string => !!x).map(day);
  const fallbackToday = today ? day(today) : day(localToday());
  const rangeStart = allDates.length ? Math.min(...allDates) : fallbackToday - 30;
  const rangeEnd = allDates.length ? Math.max(...allDates) : fallbackToday + 30;
  const start = rangeStart === rangeEnd ? rangeStart - 15 : rangeStart;
  const end = rangeStart === rangeEnd ? rangeEnd + 15 : rangeEnd;
  const axisSpan = Math.max(1, end - start);
  const x = (d: string) => Math.max(10, Math.min(90, 10 + ((day(d) - start) / axisSpan) * 80));
  const todayPos = today ? x(today) : null;
  const elapsed = today && hasBaseline ? Math.max(0, Math.min(100, Math.round((day(today) - day(baselineStart!)) / (day(baselineFinish!) - day(baselineStart!)) * 100))) : null;
  // Long timelines can scroll within the chart. Multiple events on the same day
  // use separate lanes instead of hiding, clipping, or arbitrarily moving them.
  const canvasWidth = Math.max(820, Math.min(5600, 700 + plottedEvents.length * 95));
  const laneLast: number[] = [];
  const markers = plottedEvents.map(item => {
    const position = x(item.date);
    const pixel = position / 100 * canvasWidth;
    let lane = laneLast.findIndex(last => pixel - last > 158);
    if (lane < 0) { lane = laneLast.length; laneLast.push(pixel); }
    else laneLast[lane] = pixel;
    return { ...item, position, lane };
  });
  const plotHeight = 157 + Math.max(1, laneLast.length) * 65;
  const selectedEvent = events.find(e => e.id === selected) || null;
  const selectedMilestone = milestones.find(m => m.id === selected) || null;

  async function saveMilestone(e: FormEvent<HTMLFormElement>, existing?: Milestone) {
    e.preventDefault();
    if (saving) return;
    const f = new FormData(e.currentTarget);
    const title = String(f.get("title") || "").trim();
    const planned = String(f.get("planned") || "");
    const actual = String(f.get("actual") || "");
    const state = String(f.get("state") || "planned");
    if (!title || !datePart(planned)) { setError("A title and planned date are required."); return; }
    if (actual && !datePart(actual)) { setError("Enter a valid completion date."); return; }
    setSaving(true); setError("");
    const data = {
      title, description: String(f.get("description") || "").trim() || null,
      start_at: planned + "T12:00:00", end_at: state === "completed" && actual ? actual + "T12:00:00" : null,
      status: state === "completed" ? "completed" : "planned", date_precision: "day",
    };
    const sb = createClient();
    const result = existing
      ? await sb.from("project_events").update(data).eq("id", existing.id).eq("project_id", project.id)
      : await sb.from("project_events").insert({ ...data, project_id: project.id, event_type: "milestone" });
    setSaving(false);
    if (result.error) { setError(result.error.message); return; }
    setAdding(false); setEditing(null); setSelected(null); refresh();
  }

  async function markCompleted(m: Milestone) {
    if (saving || m.complete) return;
    setSaving(true); setError("");
    const result = await createClient().from("project_events").update({ status: "completed", end_at: localToday() + "T12:00:00" }).eq("id", m.id).eq("project_id", project.id);
    setSaving(false);
    if (result.error) { setError(result.error.message); return; }
    refresh();
  }

  async function saveBaseline(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    const f = new FormData(e.currentTarget);
    const plannedStart = String(f.get("baselineStart") || "");
    const plannedFinish = String(f.get("baselineFinish") || "");
    if (!datePart(plannedStart) || !datePart(plannedFinish) || plannedStart >= plannedFinish) {
      setError("Set a valid baseline start and a target finish after that date."); return;
    }
    setSaving(true); setError("");
    const result = await createClient().from("projects").update({
      baseline_start: plannedStart, target_finish: plannedFinish, updated_at: new Date().toISOString(),
    }).eq("id", project.id);
    setSaving(false);
    if (result.error) { setError(result.error.message); return; }
    window.location.reload();
  }

  async function saveHistoryEvent(e: FormEvent<HTMLFormElement>, existing: Event) {
    e.preventDefault();
    if (saving) return;
    const f = new FormData(e.currentTarget);
    const title = String(f.get("title") || "").trim();
    const recordedDate = String(f.get("date") || "");
    const impact = String(f.get("impact") || "").trim();
    const endingDate = String(f.get("endingDate") || "");
    const eventType = String(f.get("eventType") || "").trim();
    if (!title || (recordedDate && !datePart(recordedDate))) {
      setError("Enter an event title and a valid date, or leave the date blank if unknown.");
      return;
    }
    if (!eventType || (endingDate && (!datePart(endingDate) || !recordedDate || endingDate < recordedDate))) {
      setError("Select an event type and make sure the end date is on or after its start."); return;
    }
    if (impact && !Number.isFinite(Number(impact))) { setError("Enter a valid schedule impact."); return; }
    setSaving(true); setError("");
    const result = await createClient().from("project_events").update({
      title,
      event_type: eventType,
      description: String(f.get("description") || "").trim() || null,
      start_at: recordedDate ? recordedDate + "T12:00:00" : null,
      end_at: endingDate ? endingDate + "T12:00:00" : null,
      date_precision: recordedDate ? "day" : "unknown",
      schedule_impact_days: impact ? Number(impact) : null,
    }).eq("id", existing.id).eq("project_id", project.id);
    setSaving(false);
    if (result.error) { setError(result.error.message); return; }
    setEditing(null); refresh();
  }

  function historyEventForm(existing: Event) {
    return <form className={styles.editor} onSubmit={e => saveHistoryEvent(e, existing)}>
      <label>Event title <input name="title" defaultValue={existing.title} required /></label>
      <label>Event type <input name="eventType" list="buildpath-event-types" required defaultValue={existing.event_type} />
        <datalist id="buildpath-event-types"><option value="weather"/><option value="weather_delay"/><option value="work_injury"/><option value="safety_incident"/><option value="delay"/><option value="change"/><option value="decision"/><option value="field"/><option value="meeting"/><option value="schedule"/></datalist>
      </label>
      <label>Event start date <input name="date" type="date" defaultValue={datePart(existing.start_at) || datePart(existing.end_at) || ""} /></label>
      <label>End date (if known) <input name="endingDate" type="date" defaultValue={datePart(existing.end_at) || ""} /></label>
      <label>Schedule impact (days) <input name="impact" type="number" defaultValue={existing.schedule_impact_days ?? ""} /></label>
      <label className={styles.full}>Notes <textarea name="description" rows={3} defaultValue={existing.description || ""}/></label>
      <div className={styles.formActions}><button className="primary-action" disabled={saving} type="submit">{saving ? "Saving..." : "Save event"}</button><button className="secondary-action" type="button" onClick={() => { setEditing(null); setError(""); }}>Cancel</button></div>
    </form>;
  }

  function form(m?: Milestone) {
    return <form className={styles.editor} onSubmit={e => saveMilestone(e, m)}>
      <label>Milestone <input name="title" required defaultValue={m?.title || ""} placeholder="e.g. Foundation inspection" /></label>
      <label>Planned date <input name="planned" type="date" required defaultValue={m?.planned || ""} /></label>
      <label>Status <select name="state" defaultValue={m?.complete ? "completed" : "planned"}><option value="planned">Planned / in progress</option><option value="completed">Completed</option></select></label>
      <label>Actual completion date <input name="actual" type="date" defaultValue={m?.actual || ""} /></label>
      <label className={styles.full}>Notes <textarea name="description" rows={2} defaultValue={m?.description || ""} placeholder="Deliverable, dependency, or evidence..." /></label>
      <div className={styles.formActions}><button type="submit" disabled={saving} className="primary-action">{saving ? "Saving..." : m ? "Save changes" : "Add milestone"}</button><button type="button" className="secondary-action" onClick={() => { setAdding(false); setEditing(null); setError(""); }}>Cancel</button></div>
    </form>;
  }

  return <section className={"panel " + styles.root} aria-label="Project schedule timeline">
    <div className={styles.heading}>
      <div><p className="eyebrow">BASELINE VS. ACTUAL</p><h3>Project schedule & event timeline</h3><p className={styles.subhead}>All recorded project events ({events.length}), milestones, today's position, and schedule status. Select any marker for details.</p></div>
      <div className={styles.headingActions}><button className="secondary-action" onClick={() => { setEditingBaseline(!editingBaseline); setAdding(false); setError(""); }}>{editingBaseline ? "Close baseline" : "Edit baseline"}</button><button className="primary-action" onClick={() => { setAdding(!adding); setEditingBaseline(false); setEditing(null); setError(""); }}>{adding ? "Cancel" : "＋ Add milestone"}</button></div>
    </div>

    <div className={styles.metrics}>
      <div className={styles.health} data-health={health}><span>Schedule health</span><strong>{headline}</strong><small>{summary}</small></div>
      <div><span>Baseline</span><strong>{baselineStart ? shortDate(baselineStart) : "Not set"} → {baselineFinish ? shortDate(baselineFinish) : "Not set"}</strong><small>{elapsed !== null ? elapsed + "% of baseline time elapsed" : "Use Edit baseline to set both dates"}</small></div>
      <div><span>Milestones</span><strong>{completed} / {milestones.length} completed</strong><small>{overdue.length} overdue · {lateDone.length} completed late</small></div>
    </div>
    {(disruptions.length > 0 || weatherCount || safetyCount || setbackCount) && <div className={styles.disruptionOverview} aria-label="Weather, safety, and schedule events">
      <strong><span aria-hidden="true">⚑</span> Disruptions & incidents</strong>
      <span><b>{weatherCount}</b> weather events</span>
      <span><b>{safetyCount}</b> safety / injury reports</span>
      <span><b>{setbackCount}</b> other setbacks</span>
      <small>Flags show disruptions and incidents. Bands span only dates explicitly recorded; weather events without reported disruption are not treated as delays.</small>
    </div>}

    {editingBaseline && <form className={styles.editor} onSubmit={saveBaseline}>
      <label>Baseline start <input type="date" name="baselineStart" required defaultValue={baselineStart || ""} /></label>
      <label>Target finish <input type="date" name="baselineFinish" required defaultValue={baselineFinish || ""} /></label>
      <div className={styles.formActions}><button disabled={saving} className="primary-action">{saving ? "Saving..." : "Save baseline dates"}</button><button type="button" className="secondary-action" onClick={() => setEditingBaseline(false)}>Cancel</button></div>
    </form>}
    {adding && form()}
    {error && <div role="alert" className="form-message">{error}</div>}

    <div className={styles.legend}><span><i className={styles.legendWeather} />☁ Weather</span><span><i className={styles.legendInjury} />✚ Safety / injury</span><span><i className={styles.legendImpact} />! Setback</span><span><i className={styles.legendChange} />Change</span><span><i className={styles.legendHistory} />Other events</span><span><i className={styles.legendToday} />Today</span><span><i className={styles.legendDone} />Completed</span><span><i className={styles.legendLate} />Behind</span><span><i className={styles.legendNext} />Due soon</span><span><i className={styles.legendPlanned} />Upcoming</span></div>
    <div className={styles.scroller} tabIndex={0} aria-label="Scrollable project timeline showing every dated project event and milestone">
      <div className={styles.canvas} style={{ width: canvasWidth, height: plotHeight }}>
        {Array.from({ length: 7 }, (_, i) => {
          const pct = 10 + i * 80 / 6;
          const date = dateFromDay(Math.round(start + (end - start) * i / 6));
          return <div className={styles.tick} key={i} style={{ left: pct + "%" }}><span>{shortDate(date)}</span><i /></div>;
        })}
        <div className={styles.rail}><span className={styles.railPast} style={{ width: (todayPos !== null ? Math.max(0, Math.min(100, (todayPos - 10) / 80 * 100)) : 0) + "%" }} /></div>
        {disruptions.map(({event, date, category}) => {
          const endDate = datePart(event.end_at);
          const isRange = Boolean(endDate && endDate > date && event.event_type.toLowerCase() !== "milestone");
          const startPos = x(date);
          const endPos = isRange ? x(endDate!) : startPos;
          return <div key={"setback-" + event.id}
            className={styles.disruptionWindow} data-category={category} data-selected={selected === event.id}
            style={{left: startPos + "%", width: isRange ? Math.max(0.3, endPos - startPos) + "%" : "12px", height: plotHeight - 82}}
            title={categoryName[category] + ": " + event.title + " (" + labelDate(date) + (isRange ? " – " + labelDate(endDate) : "") + ")"} aria-hidden="true"/>;
        })}
        {today && <div className={styles.today} style={{ left: todayPos + "%" }}><b>Today</b><i /></div>}
        {markers.map(({ event, date, milestone, category, position, lane }) => {
          const tone = milestone ? toneOf(milestone, today) : Number(event.schedule_impact_days) > 0 ? "impact" : "event";
          const dateLabel = milestone ? "Planned: " + labelDate(date) : labelDate(date);
          const endDate = !milestone ? datePart(event.end_at) : null;
          const dateSpan = endDate && endDate > date ? " – " + labelDate(endDate) : "";
          return <button type="button" key={event.id} className={styles.marker}
            data-kind={milestone ? "milestone" : "event"} data-category={category} data-tone={tone} aria-pressed={selected === event.id}
            style={{ left: position + "%", top: 118 + lane * 65, "--lead": (37 + lane * 65) + "px" } as CSSProperties}
            onClick={() => { setSelected(selected === event.id ? null : event.id); setEditing(null); }}
            title={categoryName[category] + ": " + event.title + " — " + dateLabel + dateSpan + (Number(event.schedule_impact_days) > 0 ? " · Reported impact: " + event.schedule_impact_days + " days" : "")}>
            <i />
            <span className={styles.markerType}><b className={styles.markerGlyph} aria-hidden="true">{categoryGlyph[category]}</b>{categoryName[category]}</span>
            <strong>{event.title}</strong>
            <small>{dateLabel}{dateSpan}</small>
            {Number(event.schedule_impact_days) > 0 && <span className={styles.impactFlag}>+{event.schedule_impact_days}d reported impact</span>}
          </button>;
        })}
        
      </div>
    </div>

    {undatedEvents.length > 0 && <div className={styles.undated}>
      <strong>Needs a date ({undatedEvents.length})</strong>
      <p>These records are part of the project history, but cannot be positioned on a calendar until a date is known.</p>
      <div className={styles.undatedChips}>{undatedEvents.map(({event}) =>
        <button type="button" key={event.id} aria-pressed={selected === event.id} onClick={() => { setSelected(selected === event.id ? null : event.id); setEditing(null); }}>
          <small>{event.event_type.replaceAll("_", " ")}</small>{event.title}
        </button>
      )}</div>
    </div>}

    {selectedEvent && !selectedMilestone && <div className={styles.detail} data-category={categoryForEvent(selectedEvent)}>
      <span className={styles.detailCategory}><b aria-hidden="true">{categoryGlyph[categoryForEvent(selectedEvent)]}</b> {categoryName[categoryForEvent(selectedEvent)]}</span>
      <div>
        <strong>{selectedEvent.title}</strong>
        <p>{selectedEvent.description || "No description recorded."}</p>
        <small>{selectedEvent.event_type.replaceAll("_", " ")} · {labelDate(datePart(selectedEvent.start_at) || datePart(selectedEvent.end_at))}{datePart(selectedEvent.end_at) && datePart(selectedEvent.start_at) && datePart(selectedEvent.end_at)! > datePart(selectedEvent.start_at)! ? " – " + labelDate(datePart(selectedEvent.end_at)) : ""}{selectedEvent.status ? " · " + selectedEvent.status : ""}
          {selectedEvent.schedule_impact_days != null ? " · Schedule impact: " + selectedEvent.schedule_impact_days + " days" : ""}
          {selectedEvent.cost_impact != null ? " · Cost impact: $" + Number(selectedEvent.cost_impact).toLocaleString("en-US") : ""}
        </small>
      </div>
      <div className={styles.detailActions}>
        <button className="secondary-action" type="button" onClick={() => { setEditing(editing === selectedEvent.id ? null : selectedEvent.id); setError(""); }}>{editing === selectedEvent.id ? "Close editor" : "Edit event"}</button>
      </div>
      {editing === selectedEvent.id && historyEventForm(selectedEvent)}
    </div>}

    {selectedMilestone && <div className={styles.detail}>
      <div><strong>{selectedMilestone.title}</strong><p>{selectedMilestone.description || "No milestone details recorded."}</p><small>Planned: {labelDate(selectedMilestone.planned)} · Actual: {selectedMilestone.complete ? labelDate(selectedMilestone.actual) : "Pending"} · {toneLabel(selectedMilestone, today)}</small></div>
      <div className={styles.detailActions}><button type="button" className="secondary-action" onClick={() => setEditing(editing === selectedMilestone.id ? null : selectedMilestone.id)}>{editing === selectedMilestone.id ? "Close editor" : "Edit milestone"}</button>{!selectedMilestone.complete && <button type="button" disabled={saving} className="secondary-action" onClick={() => markCompleted(selectedMilestone)}>Mark completed today</button>}</div>
      {editing === selectedMilestone.id && form(selectedMilestone)}
    </div>}

    {milestones.length > 0 ? <details className={styles.milestoneList}>
      <summary className={styles.listHeading}>
        <strong>Milestone register</strong>
        <span>{milestones.length} recorded <span aria-hidden="true" className={styles.registerChevron}>⌄</span></span>
      </summary>
      <div className={styles.listContent}>
      {milestones.map(m => {
        const tone = toneOf(m, today);
        return <button type="button" key={m.id} className={styles.listRow} aria-pressed={selected === m.id} onClick={() => { setSelected(selected === m.id ? null : m.id); setEditing(null); }}>
          <span className={styles.rowSymbol} data-tone={tone}>◆</span><strong>{m.title}</strong><span>{labelDate(m.planned)}</span><span className={styles.rowTone} data-tone={tone}>{toneLabel(m, today)}</span>
        </button>;
      })}
      </div>
    </details> : <p className={styles.empty}>There are no project milestones yet. Add your first milestone to make the schedule trackable.</p>}
    {!hasBaseline && <p className={styles.footnote}>A complete baseline is missing. Use Edit baseline to set the project's start and finish dates to measure overall schedule progress.</p>}
    {impactDays > 0 && <p className={styles.footnote}>Schedule exposure: {impactDays} days reported across {reportedImpacts.length} impact events. These are individual records, not necessarily additive or a forecast of project delay.</p>}
  </section>;
}

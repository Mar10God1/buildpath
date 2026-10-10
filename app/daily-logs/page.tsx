"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { JobPageShell, callApi, useJob } from "@/components/job-page";

type DailyLog = {
  id: string; log_date: string; summary: string | null; work_completed: string | null; deliveries: string | null;
  issues: string | null; safety: string | null; weather: string | null; open_items: string | null;
  status: "draft" | "final"; ai_generated: boolean; source_submission_ids: string[]; updated_at: string;
};

const SECTIONS: [keyof DailyLog, string][] = [
  ["summary", "Summary"], ["work_completed", "Work completed"], ["deliveries", "Deliveries & purchases"],
  ["issues", "Issues & client requests"], ["safety", "Safety"], ["weather", "Weather"], ["open_items", "Follow-ups"],
];

function localDate(d = new Date()) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function dayBounds(date: string) {
  const start = new Date(date + "T00:00:00");
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return { dayStart: start.toISOString(), dayEnd: end.toISOString() };
}
function pretty(date: string) {
  return new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

export default function DailyLogsPage() {
  const { job, heroImage } = useJob();
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [date, setDate] = useState(localDate());
  const [captureCount, setCaptureCount] = useState<number | null>(null);
  const [open, setOpen] = useState<DailyLog | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function loadLogs(selectDate?: string) {
    if (!job) return;
    const r = await createClient().from("daily_logs").select("*").eq("project_id", job.id).order("log_date", { ascending: false }).limit(60);
    if (r.error) { setMsg(r.error.message.includes("daily_logs") ? "Daily logs need the new database update before they can be saved. See the pull request notes." : r.error.message); return; }
    const list = (r.data || []) as DailyLog[];
    setLogs(list);
    const want = selectDate || date;
    setOpen(list.find((l) => l.log_date === want) || null);
  }
  async function countCaptures(d: string) {
    if (!job) return;
    const { dayStart, dayEnd } = dayBounds(d);
    const r = await createClient().from("field_submissions").select("id", { count: "exact", head: true }).eq("project_id", job.id).gte("created_at", dayStart).lt("created_at", dayEnd);
    setCaptureCount(r.count ?? 0);
  }
  useEffect(() => { void loadLogs(); }, [job]);
  useEffect(() => { void countCaptures(date); setOpen(logs.find((l) => l.log_date === date) || null); }, [job, date]);

  async function generate() {
    if (!job) return;
    setBusy(true); setMsg("");
    const { ok, data } = await callApi<{ log: DailyLog; captureCount: number; photoCount: number }>("/api/daily-log", { projectId: job.id, logDate: date, ...dayBounds(date) });
    setBusy(false);
    if (!ok) { setMsg(data.error || "Could not write the daily log."); return; }
    setMsg(`Drafted from ${data.captureCount} field capture${data.captureCount === 1 ? "" : "s"}${data.photoCount ? ` and ${data.photoCount} photo${data.photoCount === 1 ? "" : "s"}` : ""}. Review and edit, then mark it final.`);
    await loadLogs(date);
  }

  async function save(next: Partial<DailyLog>) {
    if (!open) return;
    const r = await createClient().from("daily_logs").update({ ...next, updated_at: new Date().toISOString() }).eq("id", open.id).select("*").single();
    if (r.error) { setMsg(r.error.message); return; }
    setOpen(r.data as DailyLog);
    setLogs((l) => l.map((x) => (x.id === open.id ? (r.data as DailyLog) : x)));
    setMsg(next.status === "final" ? "Log finalized." : next.status === "draft" ? "Reopened as a draft." : "Saved.");
  }

  if (!job) return <main className="setup-shell"><section className="setup-card">Loading…</section></main>;
  const final = open?.status === "final";

  return (
    <JobPageShell job={job} heroImage={heroImage} active="Daily Logs" title="Daily Logs" subtitle="Snap photos and talk through the day in Field Capture. BuildPath writes the log.">
      {msg && <div className="form-message">{msg}</div>}
      <div className="builder-two-col">
        <section className="panel page-panel">
          <div className="panel-title">
            <div><p className="eyebrow">DAY</p><h3>{pretty(date)}</h3></div>
            <input type="date" value={date} max={localDate()} onChange={(e) => setDate(e.target.value)} className="date-input" />
          </div>
          <p className="panel-copy">
            {captureCount == null ? "Checking field captures…" : captureCount === 0
              ? <>No field captures for this day yet. <a href={"/field?project=" + job.id}>Open Field Capture →</a></>
              : `${captureCount} field capture${captureCount === 1 ? "" : "s"} recorded for this day.`}
          </p>
          {!final && (
            <button className="primary-action" disabled={busy || !captureCount} onClick={generate}>
              {busy ? "Writing the log…" : open ? "✦ Rewrite from captures" : "✦ Write this day's log"}
            </button>
          )}

          {open ? (
            <div className="log-editor">
              <div className="log-status">
                <span className={"status-chip " + (final ? "green-dot" : "")}>{final ? "Final" : "Draft"}</span>
                {open.ai_generated && <small>Written by BuildPath from {open.source_submission_ids.length} capture{open.source_submission_ids.length === 1 ? "" : "s"}. Check it before finalizing.</small>}
              </div>
              {SECTIONS.map(([key, label]) => (
                <label key={key} className="log-section">
                  <span>{label}</span>
                  <textarea
                    defaultValue={(open[key] as string) || ""}
                    key={open.id + key + open.updated_at}
                    readOnly={final}
                    rows={key === "summary" ? 3 : 4}
                    onBlur={(e) => { if (!final && e.target.value !== (open[key] || "")) void save({ [key]: e.target.value } as Partial<DailyLog>); }}
                  />
                </label>
              ))}
              <div className="setup-actions">
                {final
                  ? <button className="secondary-action" onClick={() => save({ status: "draft" })}>Reopen as draft</button>
                  : <button className="primary-action" onClick={() => save({ status: "final" })}>Mark final</button>}
                <button className="secondary-action" onClick={() => window.print()}>Print / save PDF</button>
              </div>
            </div>
          ) : (
            <div className="empty-state"><span>☷</span><p>No log for this day yet.</p></div>
          )}
        </section>

        <section className="panel page-panel">
          <div className="panel-title"><div><p className="eyebrow">HISTORY</p><h3>Recent logs</h3></div></div>
          {logs.length ? (
            <div className="compact-list">
              {logs.map((l) => (
                <button key={l.id} className={"log-row" + (l.log_date === date ? " selected" : "")} onClick={() => setDate(l.log_date)}>
                  <span className="list-icon">{l.status === "final" ? "✓" : "✎"}</span>
                  <p><strong>{pretty(l.log_date)}</strong><small>{(l.summary || "").slice(0, 110)}{(l.summary || "").length > 110 ? "…" : ""}</small></p>
                </button>
              ))}
            </div>
          ) : <p className="empty-inline">Logs you create will show up here.</p>}
        </section>
      </div>
    </JobPageShell>
  );
}

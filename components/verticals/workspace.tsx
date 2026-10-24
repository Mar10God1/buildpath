"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useProject } from "@/lib/verticals/store";
import { isTeam } from "@/lib/verticals/core/sharing";
import type { ProductKey } from "@/lib/verticals/core/types";
import { Timeline } from "./timeline";
import { Capture } from "./capture";
import { Requests } from "./requests";
import { Sharing } from "./sharing";
import { DailyLogs } from "./daily-log";
import { ClaimPacket, DryingLog, EquipmentLog, RestoreOverview } from "./products/restore";
import { Deposit, Inspections, LeaseOverview } from "./products/lease";
import { Budget, EventOverview, RunOfShow } from "./products/event";

type Go = (tab: string) => void;
const OVERVIEW: Record<ProductKey, (p: { projectId: string; go: Go }) => React.ReactNode> = {
  restore: RestoreOverview, lease: LeaseOverview, event: EventOverview,
};
const MODULES: Record<string, (p: { projectId: string }) => React.ReactNode> = {
  drying: DryingLog, equipment: EquipmentLog, packet: ClaimPacket,
  inspections: Inspections, deposit: Deposit,
  budget: Budget, runofshow: RunOfShow,
};

export function Workspace({ projectId }: { projectId: string }) {
  const { cfg, project, people, viewer, setViewerId, ready, allEvidence, allRequests, reset } = useProject(projectId);
  const [tab, setTab] = useState("overview");
  const [seed, setSeed] = useState<{ text: string; evidenceIds: string[] } | null>(null);

  useEffect(() => { const h = location.hash.slice(1); if (h) setTab(h); }, []);
  const go = useCallback((t: string) => { setTab(t); history.replaceState(null, "", `#${t}`); window.scrollTo({ top: 0 }); }, []);
  const clearSeed = useCallback(() => setSeed(null), []);

  if (!ready) return null;
  if (!project) return <div className="landing"><p>That {cfg.projectNoun.toLowerCase()} isn't in this browser's demo data. <Link href={cfg.basePath}>Back</Link></p></div>;

  const team = isTeam(cfg, viewer);
  const pending = allEvidence.filter((e) => e.status === "candidate").length;
  const drafts = allRequests.filter((r) => r.status === "draft").length;
  const tabs = [
    { key: "overview", label: "Overview", icon: "◉" },
    ...(team ? [{ key: "capture", label: "Capture", icon: "＋", count: pending }] : []),
    { key: "timeline", label: "Timeline", icon: "☰" },
    ...cfg.modules,
    { key: "requests", label: cfg.requestPlural, icon: "✎", count: team ? drafts : 0 },
    ...(cfg.dailyLog.enabled ? [{ key: "logs", label: "Daily logs", icon: "▦" }] : []),
    ...(team ? [{ key: "sharing", label: "Sharing", icon: "⇄" }] : []),
  ] as { key: string; label: string; icon: string; count?: number }[];
  const current = tabs.some((t) => t.key === tab) ? tab : "overview";
  const outside = people.filter((p) => !isTeam(cfg, p));
  const Overview = OVERVIEW[cfg.key];
  const Module = MODULES[current];

  return (
    <div className="vp-shell" style={{ ["--accent" as string]: cfg.accent, ["--accent-dark" as string]: cfg.accentDark }}>
      <aside className="vp-sidebar">
        <Link href={cfg.basePath} className="brand"><span className="brand-mark">{cfg.name[0]}</span><span className="brand-word">{cfg.name.replace("Path", "")}<b>Path</b></span></Link>
        <Link href={cfg.basePath} className="side-project"><strong>{project.name}</strong><small>{project.status} · all {cfg.projectPlural.toLowerCase()} ▾</small></Link>
        {tabs.map((t) => (
          <button key={t.key} className={`vp-side-link${current === t.key ? " vp-active" : ""}`} onClick={() => go(t.key)}>
            <span className="ico">{t.icon}</span>{t.label}{t.count ? <span className="count">{t.count}</span> : null}
          </button>
        ))}
        <div className="side-foot">
          <span>Demo mode · data stays in this browser</span>
          <button onClick={() => { if (confirm("Reset this product's demo data?")) reset(); }}>Reset demo data</button>
          <Link href="/paths" style={{ color: "#c9cdcf" }}>← All products</Link>
        </div>
      </aside>
      <main className="vp-main">
        <div className="vp-topbar">
          <div>
            <h1>{project.name}</h1>
            <p className="muted">{project.subtitle} · {project.address}</p>
          </div>
          <label className="viewas no-print">
            Viewing as
            <select value={viewer?.id ?? ""} onChange={(e) => setViewerId(e.target.value || null)}>
              <option value="">Team (everything)</option>
              {outside.map((p) => <option key={p.id} value={p.id}>{p.name} · {cfg.roles.find((r) => r.key === p.role)?.label}</option>)}
            </select>
          </label>
        </div>
        {viewer && (
          <div className="viewing-banner no-print">
            <span>You're seeing exactly what <strong>{viewer.name}</strong> sees. Internal notes, unconfirmed records and anything outside their sharing level are hidden.</span>
            <button className="btn sm" onClick={() => setViewerId(null)}>Back to team view</button>
          </div>
        )}
        {current === "overview" && <Overview projectId={projectId} go={go} />}
        {current === "capture" && <Capture projectId={projectId} onDraftRequest={(text, ids) => { setSeed({ text, evidenceIds: ids }); go("requests"); }} />}
        {current === "timeline" && <Timeline projectId={projectId} />}
        {current === "requests" && <Requests projectId={projectId} seed={seed} onSeedUsed={clearSeed} />}
        {current === "logs" && <DailyLogs projectId={projectId} />}
        {current === "sharing" && <Sharing projectId={projectId} onViewAs={(id) => { setViewerId(id); go("overview"); }} />}
        {Module && <Module projectId={projectId} />}
      </main>
    </div>
  );
}

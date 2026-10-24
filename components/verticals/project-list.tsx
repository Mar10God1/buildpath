"use client";

import Link from "next/link";
import { useStore } from "@/lib/verticals/store";
import { fmtDay } from "./ui";

export function ProjectList() {
  const { cfg, data, ready } = useStore();
  if (!ready) return null;
  return (
    <div className="landing" style={{ ["--accent" as string]: cfg.accent, ["--accent-dark" as string]: cfg.accentDark }}>
      <div className="spread">
        <div className="row"><span className="brand-mark">{cfg.name[0]}</span><div><h1>{cfg.name}</h1><p className="muted">{cfg.tagline}</p></div></div>
        <Link href="/paths" className="btn">← All products</Link>
      </div>
      <div className="grid2">
        {data.projects.map((p) => {
          const ev = data.evidence.filter((e) => e.projectId === p.id);
          const pending = ev.filter((e) => e.status === "candidate").length;
          const reqs = data.requests.filter((r) => r.projectId === p.id);
          return (
            <Link key={p.id} href={`${cfg.basePath}/${p.id}`} className="card product-card">
              <div className="spread"><h2>{p.name}</h2><span className="badge accent">{p.status}</span></div>
              <p className="muted small">{p.subtitle}</p>
              <p className="small">{p.address}</p>
              <div className="row small muted">
                <span>{ev.length} records</span>
                <span>{reqs.length} {cfg.requestPlural.toLowerCase()}</span>
                {pending > 0 && <span className="badge cand">{pending} to review</span>}
                <span>Since {fmtDay(p.startDate, { month: "short", day: "numeric" })}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

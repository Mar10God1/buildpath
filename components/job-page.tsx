"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AppSidebar } from "@/components/app-sidebar";
import { getProjectVisual } from "@/lib/project-visuals";

export type Job = { id: string; name: string; city: string | null; state: string | null; project_type: string | null; hero_image_url: string | null; client_id?: string | null };

/** Loads the signed-in user's selected job (?project=…), redirecting to login/setup when needed. */
export function useJob() {
  const [job, setJob] = useState<Job | null>(null);
  const [heroImage, setHeroImage] = useState("");
  useEffect(() => {
    (async () => {
      const s = createClient();
      const auth = await s.auth.getUser();
      if (!auth.data.user) { window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname + window.location.search); return; }
      const wanted = new URLSearchParams(window.location.search).get("project");
      const pr = await s.from("projects").select("id,name,city,state,project_type,hero_image_url").order("created_at", { ascending: false });
      const list = (pr.data || []) as Job[];
      const p = list.find((x) => x.id === wanted) || list[0];
      if (!p) { window.location.href = "/setup"; return; }
      setJob(p);
      if (p.hero_image_url) {
        const signed = await s.storage.from("project-assets").createSignedUrl(p.hero_image_url, 3600);
        setHeroImage(signed.data?.signedUrl || getProjectVisual(p.project_type).image);
      } else setHeroImage(getProjectVisual(p.project_type).image);
    })();
  }, []);
  return { job, heroImage };
}

/** Calls one of BuildPath's API routes as the signed-in user. */
export async function callApi<T>(path: string, body: unknown): Promise<{ ok: boolean; data: T & { error?: string } }> {
  const session = await createClient().auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) return { ok: false, data: { error: "Your session expired. Please log in again." } as T & { error?: string } };
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify(body) });
  let data: any = {};
  try { data = await res.json(); } catch { data = { error: "Unexpected response from BuildPath." }; }
  return { ok: res.ok, data };
}

export function JobPageShell({ job, heroImage, active, title, subtitle, children }: { job: Job; heroImage: string; active: string; title: string; subtitle: string; children: React.ReactNode }) {
  const visual = getProjectVisual(job.project_type);
  return (
    <div className="shell">
      <AppSidebar projectId={job.id} active={active} />
      <main className="main standalone-page">
        <header className="topbar compact-project-hero" style={{ backgroundImage: "linear-gradient(90deg,rgba(10,11,12,.88),rgba(10,11,12,.54) 55%,rgba(10,11,12,.35)),url(" + JSON.stringify(heroImage || visual.image) + ")" }}>
          <div><p className="eyebrow">{job.name.toUpperCase()}</p><h1>{title}</h1><p>{subtitle}</p></div>
          <a className="secondary-action" href={"/?project=" + job.id}>Job overview →</a>
        </header>
        {children}
      </main>
    </div>
  );
}

export function money(v: number | null | undefined) {
  if (v == null) return "Price TBD";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(v);
}

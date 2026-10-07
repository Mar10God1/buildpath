import { createClient } from "@/lib/supabase/client";

export type Workstream = { key: string; label: string };

/**
 * Starting workstreams for a new engagement. Deliberately platform-neutral so they fit
 * Salesforce, NetSuite, HubSpot, ServiceNow, custom builds, and most other implementation work.
 * Consultants can rename, remove, or add their own per engagement.
 */
export const DEFAULT_WORKSTREAMS: Workstream[] = [
  { key: "discovery_design", label: "Discovery & design" },
  { key: "configuration_build", label: "Configuration & build" },
  { key: "data_integrations", label: "Data migration & integrations" },
  { key: "reporting_analytics", label: "Reporting & analytics" },
  { key: "testing", label: "Testing & UAT" },
  { key: "training_golive", label: "Training & go-live" },
];

export const SCOPE_PREFIX = "cp_scope_";

export function workstreamKey(label: string) {
  const k = label.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48);
  return k || "workstream_" + Math.random().toString(36).slice(2, 8);
}

export function labelFromKey(key: string) {
  const s = key.replace(/_/g, " ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : "General";
}

/**
 * The engagement's workstreams, in this order of precedence:
 * 1. Workstreams saved on the engagement (project_requirements rows prefixed cp_scope_), including "not in scope" ones
 * 2. Any workstream that already has milestones but isn't in the saved list (so no data is ever hidden)
 * 3. The platform-neutral defaults when nothing has been saved yet
 */
export async function loadWorkstreams(projectId: string): Promise<Workstream[]> {
  const s = createClient();
  const [req, ms] = await Promise.all([
    s.from("project_requirements").select("requirement_key,label,created_at").eq("project_id", projectId).like("requirement_key", SCOPE_PREFIX + "%").order("created_at"),
    s.from("consultation_workstream_milestones").select("workstream_key").eq("project_id", projectId),
  ]);
  const list: Workstream[] = [];
  const seen = new Set<string>();
  for (const r of req.data || []) {
    const key = String(r.requirement_key).slice(SCOPE_PREFIX.length);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    list.push({ key, label: r.label || labelFromKey(key) });
  }
  if (!list.length) for (const w of DEFAULT_WORKSTREAMS) { seen.add(w.key); list.push(w); }
  for (const m of ms.data || []) {
    const key = String(m.workstream_key || "");
    if (key && !seen.has(key)) { seen.add(key); list.push({ key, label: labelFromKey(key) }); }
  }
  return list;
}

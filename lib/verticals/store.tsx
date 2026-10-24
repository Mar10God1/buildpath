"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ChangeRequest, DailyLog, Evidence, Person, ProductData, ProductKey, Project } from "./core/types";
import type { ProductConfig } from "./core/product";
import { PRODUCTS } from "./products";
import { seedFor } from "./seed";
import { projectEvidence, projectRequests } from "./core/sharing";

// Demo-mode store. Same shapes as the Supabase tables in supabase/schema.sql; swapping this for
// Supabase calls is the production step. Browser storage is a convenience and may be unavailable.

const KEY = (p: ProductKey) => `paths:v1:${p}`;

function load(product: ProductKey): ProductData {
  try {
    const raw = localStorage.getItem(KEY(product));
    if (raw) return JSON.parse(raw) as ProductData;
  } catch {}
  return seedFor(product);
}

type Store = {
  cfg: ProductConfig;
  data: ProductData;
  ready: boolean;
  viewerId: string | null;
  setViewerId: (id: string | null) => void;
  viewer: Person | null;
  reset: () => void;
  addEvidence: (list: Evidence[]) => void;
  updateEvidence: (id: string, patch: Partial<Evidence>) => void;
  removeEvidence: (id: string) => void;
  saveRequest: (r: ChangeRequest) => void;
  saveLog: (l: DailyLog) => void;
  updateProject: (id: string, fn: (p: Project) => Project) => void;
  updatePerson: (id: string, patch: Partial<Person>) => void;
  addPerson: (p: Person) => void;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ product, children }: { product: ProductKey; children: React.ReactNode }) {
  const cfg = PRODUCTS[product];
  const [data, setData] = useState<ProductData>(() => seedFor(product));
  const [ready, setReady] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);

  useEffect(() => { setData(load(product)); setReady(true); }, [product]);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY(product), JSON.stringify(data)); } catch {}
  }, [data, ready, product]);

  const mut = useCallback((fn: (d: ProductData) => ProductData) => setData((d) => fn(d)), []);

  const store = useMemo<Store>(() => ({
    cfg, data, ready, viewerId, setViewerId,
    viewer: data.people.find((p) => p.id === viewerId) ?? null,
    reset: () => { try { localStorage.removeItem(KEY(product)); } catch {} setData(seedFor(product)); setViewerId(null); },
    addEvidence: (list) => mut((d) => ({ ...d, evidence: [...d.evidence, ...list] })),
    updateEvidence: (id, patch) => mut((d) => ({ ...d, evidence: d.evidence.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),
    removeEvidence: (id) => mut((d) => ({ ...d, evidence: d.evidence.filter((e) => e.id !== id) })),
    saveRequest: (r) => mut((d) => ({ ...d, requests: d.requests.some((x) => x.id === r.id) ? d.requests.map((x) => (x.id === r.id ? r : x)) : [...d.requests, r] })),
    saveLog: (l) => mut((d) => ({ ...d, logs: [...d.logs.filter((x) => !(x.projectId === l.projectId && x.date === l.date)), l] })),
    updateProject: (id, fn) => mut((d) => ({ ...d, projects: d.projects.map((p) => (p.id === id ? fn(p) : p)) })),
    updatePerson: (id, patch) => mut((d) => ({ ...d, people: d.people.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
    addPerson: (p) => mut((d) => ({ ...d, people: [...d.people, p] })),
  }), [cfg, data, ready, viewerId, mut, product]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}

/** Everything for one project, already projected for whoever is viewing. */
export function useProject(projectId: string) {
  const s = useStore();
  const project = s.data.projects.find((p) => p.id === projectId) ?? null;
  const people = s.data.people.filter((p) => p.projectId === projectId || p.projectId === null);
  const allEvidence = s.data.evidence.filter((e) => e.projectId === projectId).sort((a, b) => a.at.localeCompare(b.at));
  const allRequests = s.data.requests.filter((r) => r.projectId === projectId).sort((a, b) => a.number - b.number);
  return {
    ...s,
    project,
    people,
    allEvidence,
    allRequests,
    evidence: projectEvidence(s.cfg, s.viewer, allEvidence),
    requests: projectRequests(s.cfg, s.viewer, allRequests),
    logs: s.data.logs.filter((l) => l.projectId === projectId && (!s.viewer || l.status === "final")).sort((a, b) => b.date.localeCompare(a.date)),
  };
}

import type { CategoryAccess, ProductKey, SharingLevel } from "./types";

/**
 * A vertical is configuration over the shared engine, not a separate app
 * (LifePath rule 10: "Do not build silos").
 */
export type ProductConfig = {
  key: ProductKey;
  name: string;
  /** Route prefix inside the BuildPath app, alongside /consultationpath. */
  basePath: string;
  tagline: string;
  pitch: string[];
  accent: string;
  accentDark: string;
  projectNoun: string;
  projectPlural: string;
  requestNoun: string;
  requestPlural: string;
  /** Who a request goes to for approval ("Carrier", "Owner", "Client"). */
  approver: string;
  /** Outside roles who can approve or decline a request from their own view (the client portal). */
  approverRoles: string[];
  lanes: { key: string; label: string; color: string }[];
  categories: { key: string; label: string; hint: string }[];
  neverShared: string[];
  moneyCategory: string;
  requestCategory: string;
  roles: { key: string; label: string; team: boolean; defaultLevel: SharingLevel }[];
  levels: Record<Exclude<SharingLevel, "custom">, { label: string; hint: string; categories: Record<string, CategoryAccess> }>;
  /** Product-specific tabs, rendered by components/products/<key>. */
  modules: { key: string; label: string; icon: string }[];
  dailyLog: { enabled: boolean; sections: { key: string; label: string; hint: string }[] };
  capturePrompt: string;
  captureExamples: string[];
  requestExamples: string[];
  ai: { system: string; requestRules: string; codeLabel: string | null };
};

"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type FormState = {
  name: string;
  address: string;
  city: string;
  state: string;
  projectType: string;
  owner: string;
  generalContractor: string;
  startDate: string;
  targetFinish: string;
  budget: string;
  userRole: string;
  projectStage: string;
  constructionMode: string;
  fundingType: string;
};

const initial: FormState = {
  name: "",
  address: "",
  city: "Austin",
  state: "TX",
  projectType: "Commercial",
  owner: "",
  generalContractor: "",
  startDate: "",
  targetFinish: "",
  budget: "",
  userRole: "owner_developer",
  projectStage: "planning",
  constructionMode: "new_construction",
  fundingType: "private",
};

function dollarsToNumber(value: string) {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  return cleaned ? Number(cleaned) : null;
}

export function ProjectSetup() {
  const [form, setForm] = useState(initial);
  const [step, setStep] = useState(1);
  const [saved, setSaved] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const progress = useMemo(() => Math.round((step / 4) * 100), [step]);
  const update = (key: keyof FormState, value: string) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        window.location.href = "/login";
        return;
      }
      setCheckingAuth(false);
    });
  }, []);

  async function finish() {
    setBusy(true);
    setError("");

    const supabase = createClient();
    const { data: userResult, error: userError } = await supabase.auth.getUser();
    const user = userResult.user;

    if (userError || !user) {
      window.location.href = "/login";
      return;
    }

    const organizationId = crypto.randomUUID();
    const newProjectId = crypto.randomUUID();

    const { error: orgError } = await supabase.from("organizations").insert({
      id: organizationId,
      name: form.name ? `${form.name} Team` : "My BuildPath Team",
      created_by: user.id,
    });

    if (orgError) {
      setBusy(false);
      setError(orgError.message);
      return;
    }

    const { error: memberError } = await supabase.from("organization_members").insert({
      organization_id: organizationId,
      user_id: user.id,
      role: "owner",
    });

    if (memberError) {
      setBusy(false);
      setError(memberError.message);
      return;
    }

    const { error: projectError } = await supabase.from("projects").insert({
      id: newProjectId,
      organization_id: organizationId,
      name: form.name || "Untitled Project",
      address: form.address || null,
      city: form.city || null,
      state: form.state || null,
      project_type: form.projectType || null,
      baseline_start: form.startDate || null,
      target_finish: form.targetFinish || null,
      original_budget: dollarsToNumber(form.budget),
      user_role: form.userRole,
      project_stage: form.projectStage,
      construction_mode: form.constructionMode,
      funding_type: form.fundingType,
      created_by: user.id,
    });

    if (projectError) {
      setBusy(false);
      setError(projectError.message);
      return;
    }

    const companies: Array<{
      organization_id: string;
      name: string;
      company_type: string;
    }> = [];

    if (form.owner) {
      companies.push({ organization_id: organizationId, name: form.owner, company_type: "owner" });
    }

    if (form.generalContractor) {
      companies.push({ organization_id: organizationId, name: form.generalContractor, company_type: "general_contractor" });
    }

    if (companies.length > 0) {
      const { error: companyError } = await supabase.from("companies").insert(companies);
      if (companyError) {
        setBusy(false);
        setError(companyError.message);
        return;
      }
    }

    setProjectId(newProjectId);
    setSaved(true);
    setBusy(false);
  }

  if (checkingAuth) {
    return <main className="setup-shell"><section className="setup-card"><p>Checking your BuildPath session…</p></section></main>;
  }

  if (saved) {
    return (
      <main className="setup-shell">
        <section className="setup-card setup-complete">
          <span className="setup-kicker">PROJECT CREATED</span>
          <h1>{form.name || "Your project"} now has a project memory.</h1>
          <p>Its baseline, organization and initial companies are stored in the separate BuildPath database. Next we can ingest schedules, documents, meetings and field evidence into this project.</p>
          <a className="primary-action" href={`/?project=${projectId}`}>Open project overview</a>
        </section>
      </main>
    );
  }

  return (
    <main className="setup-shell">
      <section className="setup-card">
        <div className="setup-header">
          <div>
            <span className="setup-kicker">NEW PROJECT</span>
            <h1>Give BuildPath the project baseline.</h1>
            <p>Start with what you know. Missing information can be filled in later from project evidence.</p>
          </div>
          <div className="setup-progress"><strong>{progress}%</strong><span>Step {step} of 4</span></div>
        </div>

        <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>

        {step === 1 && (
          <div className="form-grid">
            <label className="wide">Project name<input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Riverside Medical Office" /></label>
            <label className="wide">Project address<input value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="1200 Riverside Dr" /></label>
            <label>City<input value={form.city} onChange={(e) => update("city", e.target.value)} /></label>
            <label>State<input value={form.state} onChange={(e) => update("state", e.target.value)} /></label>
            <label className="wide">Project type
              <select value={form.projectType} onChange={(e) => update("projectType", e.target.value)}>
                <option>Residential</option><option>Multifamily</option><option>Commercial</option><option>Industrial</option><option>Healthcare</option><option>Education</option><option>Hospitality</option><option>Civic / Public</option><option>Infrastructure</option><option>Other</option>
              </select>
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="form-grid">
            <label className="wide">Your role on this project<select value={form.userRole} onChange={(e)=>update("userRole",e.target.value)}><option value="owner_developer">Owner / Developer</option><option value="general_contractor">General Contractor</option><option value="construction_manager">Construction Manager</option><option value="project_manager">Project Manager</option><option value="superintendent">Superintendent / Field</option><option value="finance_controller">Finance / Controller</option><option value="architect_engineer">Architect / Engineer</option><option value="subcontractor">Subcontractor / Vendor</option><option value="other">Other</option></select></label>
            <label className="wide">Owner / Developer<input value={form.owner} onChange={(e) => update("owner", e.target.value)} placeholder="Owner organization" /></label>
            <label className="wide">General contractor<input value={form.generalContractor} onChange={(e) => update("generalContractor", e.target.value)} placeholder="General contractor" /></label>
            <div className="setup-note wide"><span>CONNECTED MODEL</span><p>Companies and people become reusable records. Later, emails, RFIs, change orders and meetings can all connect back to the same company or person instead of creating duplicate data.</p></div>
          </div>
        )}

        {step === 3 && (
          <div className="form-grid">
            <label>Project stage<select value={form.projectStage} onChange={(e)=>update("projectStage",e.target.value)}><option value="planning">Planning</option><option value="design">Design</option><option value="preconstruction">Preconstruction</option><option value="procurement">Procurement</option><option value="construction">Construction</option><option value="commissioning">Commissioning</option><option value="closeout">Closeout</option></select></label>
            <label>Type of work<select value={form.constructionMode} onChange={(e)=>update("constructionMode",e.target.value)}><option value="new_construction">New construction</option><option value="renovation">Renovation</option><option value="tenant_improvement">Tenant improvement</option><option value="addition">Addition</option><option value="remediation">Remediation</option><option value="capital_improvement">Capital improvement / maintenance</option></select></label>
            <label className="wide">Funding / ownership<select value={form.fundingType} onChange={(e)=>update("fundingType",e.target.value)}><option value="private">Private</option><option value="public">Public / government</option><option value="mixed">Mixed / public-private</option></select></label>
            <label>Baseline start<input type="date" value={form.startDate} onChange={(e) => update("startDate", e.target.value)} /></label>
            <label>Target completion<input type="date" value={form.targetFinish} onChange={(e) => update("targetFinish", e.target.value)} /></label>
            <label className="wide">Original budget<input value={form.budget} onChange={(e) => update("budget", e.target.value)} placeholder="$12,400,000" /></label>
            <div className="setup-note wide"><span>DON&apos;T KNOW EVERYTHING?</span><p>That is expected. BuildPath is designed to reconstruct missing project history from evidence and preserve uncertainty rather than forcing made-up precision.</p></div>
          </div>
        )}

        {step === 4 && (<div className="form-grid"><label>Baseline start<input type="date" value={form.startDate} onChange={(e) => update("startDate", e.target.value)} /></label><label>Target completion<input type="date" value={form.targetFinish} onChange={(e) => update("targetFinish", e.target.value)} /></label><label className="wide">Original budget<input value={form.budget} onChange={(e) => update("budget", e.target.value)} placeholder="$12,400,000" /></label><div className="setup-note wide"><span>ADAPTIVE WORKSPACE</span><p>BuildPath will start with only the modules that fit this project and your role. You can change any recommendation later.</p></div></div>)}

        {error && <div className="form-message">{error}</div>}

        <div className="setup-actions">
          <button className="secondary-action" onClick={() => step === 1 ? window.location.assign("/") : setStep((s) => Math.max(1, s - 1))}>{step === 1 ? "Cancel" : "Back"}</button>
          {step < 4
            ? <button className="primary-action" onClick={() => setStep((s) => Math.min(4, s + 1))}>Continue</button>
            : <button className="primary-action" onClick={finish} disabled={busy}>{busy ? "Creating…" : "Create project"}</button>}
        </div>
      </section>
    </main>
  );
}

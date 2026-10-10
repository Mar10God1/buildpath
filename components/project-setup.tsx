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
  projectType: "Residential - Custom home",
  owner: "",
  generalContractor: "",
  startDate: "",
  targetFinish: "",
  budget: "",
  userRole: "builder",
  projectStage: "construction",
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

    const { error: preferenceError } = await supabase.from("project_user_preferences").upsert({
      project_id: newProjectId,
      user_id: user.id,
      user_role: form.userRole,
      field_capture_default: ["superintendent","field_lead","builder","subcontractor"].includes(form.userRole),
      updated_at: new Date().toISOString(),
    }, { onConflict: "project_id,user_id" });

    if (preferenceError) {
      setBusy(false);
      setError(preferenceError.message);
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

    if (form.owner) {
      // Best effort: the clients table arrives with the small-builder migration.
      const client = await supabase.from("clients").insert({ organization_id: organizationId, name: form.owner, created_by: user.id }).select("id").single();
      if (!client.error && client.data) {
        await supabase.from("projects").update({ client_id: client.data.id }).eq("id", newProjectId);
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
          <span className="setup-kicker">JOB CREATED</span>
          <h1>{form.name || "Your job"} is ready.</h1>
          <p>Start capturing from the site: photos, voice notes, receipts and deliveries. BuildPath turns them into daily logs and drafts change orders when the client asks for something new.</p>
          <div className="setup-actions">
            <a className="primary-action" href={`/field?project=${projectId}`}>Start capturing on site</a>
            <a className="secondary-action" href={`/?project=${projectId}`}>Open the job</a>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="setup-shell">
      <section className="setup-card">
        <div className="setup-header">
          <div>
            <span className="setup-kicker">NEW JOB</span>
            <h1>Set up a job in about a minute.</h1>
            <p>Start with what you know. Everything else can be filled in later, or picked up from your photos, notes and documents.</p>
          </div>
          <div className="setup-progress"><strong>{progress}%</strong><span>Step {step} of 4</span></div>
        </div>

        <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>

        {step === 1 && (
          <div className="form-grid">
            <label className="wide">Job name<input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Martinez kitchen remodel" /></label>
            <label className="wide">Job address<input value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="4512 Oak Hollow Dr" /></label>
            <label>City<input value={form.city} onChange={(e) => update("city", e.target.value)} /></label>
            <label>State<input value={form.state} onChange={(e) => update("state", e.target.value)} /></label>
            <label className="wide">Type of job
              <select value={form.projectType} onChange={(e) => update("projectType", e.target.value)}>
                <optgroup label="Most common">
                  <option value="Residential - Custom home">Custom home</option>
                  <option value="Residential - Remodel">Remodel / renovation</option>
                  <option value="Residential - Addition">Addition</option>
                  <option value="Commercial - Light / tenant finish">Light commercial / tenant finish-out</option>
                  <option value="Specialty trade">Specialty trade work</option>
                </optgroup>
                <optgroup label="Larger projects">
                  <option>Multifamily</option><option>Commercial</option><option>Industrial</option><option>Healthcare</option><option>Education</option><option>Hospitality</option><option>Civic / Public</option><option>Infrastructure</option>
                </optgroup>
                <option>Other</option>
              </select>
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="form-grid">
            <label className="wide">Your role on this job<select value={form.userRole} onChange={(e)=>update("userRole",e.target.value)}><option value="builder">Builder / company owner</option><option value="office_manager">Office manager / admin</option><option value="field_lead">Field lead / site super</option><option value="owner_developer">Owner / Developer</option><option value="general_contractor">General Contractor</option><option value="construction_manager">Construction Manager</option><option value="project_manager">Project Manager</option><option value="superintendent">Superintendent / Field</option><option value="finance_controller">Finance / Controller</option><option value="architect_engineer">Architect / Engineer</option><option value="subcontractor">Subcontractor / Vendor</option><option value="other">Other</option></select></label>
            <label className="wide">Client<input value={form.owner} onChange={(e) => update("owner", e.target.value)} placeholder="Homeowner or owner, e.g. Sarah Martinez" /></label>
            <label className="wide">Your company<input value={form.generalContractor} onChange={(e) => update("generalContractor", e.target.value)} placeholder="Your building company" /></label>
            <div className="setup-note wide"><span>ONE RECORD PER CLIENT</span><p>Change orders, approvals, texts and emails all connect back to the same client, so you always know who asked for what and when.</p></div>
          </div>
        )}

        {step === 3 && (
          <div className="form-grid">
            <label>Project stage<select value={form.projectStage} onChange={(e)=>update("projectStage",e.target.value)}><option value="planning">Bidding / planning</option><option value="design">Design / selections</option><option value="preconstruction">Permitting / preconstruction</option><option value="construction">Under construction</option><option value="closeout">Punch list / closeout</option><option value="procurement">Procurement</option><option value="commissioning">Commissioning</option></select></label>
            <label>Type of work<select value={form.constructionMode} onChange={(e)=>update("constructionMode",e.target.value)}><option value="new_construction">New construction</option><option value="renovation">Renovation</option><option value="tenant_improvement">Tenant improvement</option><option value="addition">Addition</option><option value="remediation">Remediation</option><option value="capital_improvement">Capital improvement / maintenance</option></select></label>
            <label className="wide">Who's paying<select value={form.fundingType} onChange={(e)=>update("fundingType",e.target.value)}><option value="private">Private client</option><option value="public">Public / government</option><option value="mixed">Mixed / public-private</option></select></label>
            <div className="setup-note wide"><span>KEEP IT RELEVANT</span><p>This keeps BuildPath simple: you only see the tools this job needs. You can add more later if the job changes.</p></div>
          </div>
        )}

        {step === 4 && (<div className="form-grid"><label>Start date<input type="date" value={form.startDate} onChange={(e) => update("startDate", e.target.value)} /></label><label>Target completion<input type="date" value={form.targetFinish} onChange={(e) => update("targetFinish", e.target.value)} /></label><label className="wide">Contract amount<input value={form.budget} onChange={(e) => update("budget", e.target.value)} placeholder="$485,000" /></label><div className="setup-note wide"><span>CHANGE ORDERS ROLL UP</span><p>Approved change orders are added on top of the contract amount automatically, so you always know where the job stands.</p></div></div>)}

        {error && <div className="form-message">{error}</div>}

        <div className="setup-actions">
          <button className="secondary-action" onClick={() => step === 1 ? window.location.assign("/") : setStep((s) => Math.max(1, s - 1))}>{step === 1 ? "Cancel" : "Back"}</button>
          {step < 4
            ? <button className="primary-action" onClick={() => setStep((s) => Math.min(4, s + 1))}>Continue</button>
            : <button className="primary-action" onClick={finish} disabled={busy}>{busy ? "Creating…" : "Create job"}</button>}
        </div>
      </section>
    </main>
  );
}

"use client";

import { useMemo, useState } from "react";

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
};

export function ProjectSetup() {
  const [form, setForm] = useState(initial);
  const [step, setStep] = useState(1);
  const [saved, setSaved] = useState(false);

  const progress = useMemo(() => Math.round((step / 3) * 100), [step]);
  const update = (key: keyof FormState, value: string) => setForm((f) => ({ ...f, [key]: value }));

  function next() {
    setStep((s) => Math.min(3, s + 1));
  }

  function back() {
    setStep((s) => Math.max(1, s - 1));
  }

  function finish() {
    setSaved(true);
  }

  if (saved) {
    return (
      <main className="setup-shell">
        <section className="setup-card setup-complete">
          <span className="setup-kicker">PROJECT CREATED</span>
          <h1>{form.name || "Your project"} is ready for its memory.</h1>
          <p>
            The next layer will connect schedules, people, companies, documents,
            decisions, cost events and field evidence into one project graph.
          </p>
          <a className="primary-action" href="/">Open project overview</a>
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
          <div className="setup-progress"><strong>{progress}%</strong><span>Step {step} of 3</span></div>
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
                <option>Commercial</option><option>Multifamily</option><option>Healthcare</option><option>Industrial</option><option>Residential</option><option>Infrastructure</option><option>Other</option>
              </select>
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="form-grid">
            <label className="wide">Owner / Developer<input value={form.owner} onChange={(e) => update("owner", e.target.value)} placeholder="Owner organization" /></label>
            <label className="wide">General contractor<input value={form.generalContractor} onChange={(e) => update("generalContractor", e.target.value)} placeholder="General contractor" /></label>
            <div className="setup-note wide">
              <span>CONNECTED MODEL</span>
              <p>Companies and people become reusable records. Later, emails, RFIs, change orders and meetings can all connect back to the same company or person instead of creating duplicate data.</p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="form-grid">
            <label>Baseline start<input type="date" value={form.startDate} onChange={(e) => update("startDate", e.target.value)} /></label>
            <label>Target completion<input type="date" value={form.targetFinish} onChange={(e) => update("targetFinish", e.target.value)} /></label>
            <label className="wide">Original budget<input value={form.budget} onChange={(e) => update("budget", e.target.value)} placeholder="$12,400,000" /></label>
            <div className="setup-note wide">
              <span>DON&apos;T KNOW EVERYTHING?</span>
              <p>That is expected. BuildPath is designed to reconstruct missing project history from evidence and preserve uncertainty rather than forcing made-up precision.</p>
            </div>
          </div>
        )}

        <div className="setup-actions">
          <button className="secondary-action" onClick={step === 1 ? () => history.back() : back}>{step === 1 ? "Cancel" : "Back"}</button>
          {step < 3 ? <button className="primary-action" onClick={next}>Continue</button> : <button className="primary-action" onClick={finish}>Create project</button>}
        </div>
      </section>
    </main>
  );
}

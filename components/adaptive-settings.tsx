"use client";

import { FormEvent, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { inferComplexity, requirementOptions, type ModuleDecision, type ProjectRequirement } from "@/lib/adaptive-workspace";

type ProjectLike={
 id:string;project_type:string|null;project_stage:string|null;construction_mode:string|null;funding_type:string|null;
 original_budget:number|null;complexity_override:string|null
};

export function AdaptiveSettings({
 project,requirements,modules,companyCount,documentCount,refresh
}:{
 project:ProjectLike;
 requirements:ProjectRequirement[];
 modules:ModuleDecision[];
 companyCount:number;
 documentCount:number;
 refresh:()=>void;
}){
 const[msg,setMsg]=useState("");
 const[busy,setBusy]=useState(false);
 const complexity=inferComplexity(project,companyCount,documentCount);
 const visible=modules.filter(m=>m.visibility==="visible");
 const available=modules.filter(m=>m.visibility==="available");
 const hidden=modules.filter(m=>m.visibility==="hidden");

 const suggestions=useMemo(()=>{
  const list:string[]=[];
  if(available.some(m=>m.key==="field_capture"))list.push("Enable Field Capture for anyone regularly reporting from the jobsite.");
  if(available.some(m=>m.key==="compliance"))list.push("Add Compliance only if contracts, funding, or the owner require it.");
  if(visible.some(m=>m.key==="selections"))list.push("Use Selections to keep residential finish and owner decisions from becoming schedule surprises.");
  if(visible.some(m=>m.key==="procurement"))list.push("Track long-lead procurement because it is material to this project profile.");
  if(visible.some(m=>m.key==="commissioning"))list.push("Keep commissioning visible through turnover and closeout.");
  return list.slice(0,3);
 },[available,visible]);

 async function saveProject(e:FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setMsg("");
  const f=new FormData(e.currentTarget);
  const r=await createClient().from("projects").update({
   project_stage:String(f.get("stage")||"")||null,
   construction_mode:String(f.get("mode")||"")||null,
   funding_type:String(f.get("funding")||"")||null,
   complexity_override:String(f.get("complexity")||"")||null,
  }).eq("id",project.id);
  setBusy(false);if(r.error){setMsg(r.error.message);return}setMsg("Project fit updated.");refresh();
 }

 async function saveMyRole(e:React.ChangeEvent<HTMLSelectElement>){
  const s=createClient();const auth=await s.auth.getUser();if(!auth.data.user)return;
  const r=await s.from("project_user_preferences").upsert({
   project_id:project.id,user_id:auth.data.user.id,user_role:e.target.value||null,updated_at:new Date().toISOString()
  },{onConflict:"project_id,user_id"});
  if(r.error){setMsg(r.error.message);return}setMsg("Your workspace role was updated.");refresh();
 }

 async function toggleRequirement(key:string,label:string,enabled:boolean){
  const r=await createClient().from("project_requirements").upsert({
   project_id:project.id,requirement_key:key,label,enabled,source:"user",updated_at:new Date().toISOString()
  },{onConflict:"project_id,requirement_key"});
  if(r.error){setMsg(r.error.message);return}refresh();
 }

 async function overrideModule(key:string,value:string){
  const s=createClient();const auth=await s.auth.getUser();if(!auth.data.user)return;
  const existing=await s.from("project_user_preferences").select("module_overrides,user_role").eq("project_id",project.id).eq("user_id",auth.data.user.id).maybeSingle();
  if(existing.error){setMsg(existing.error.message);return}
  const overrides={...((existing.data?.module_overrides as Record<string,string>|null)||{})};
  if(value==="auto")delete overrides[key]; else overrides[key]=value;
  const r=await s.from("project_user_preferences").upsert({
   project_id:project.id,user_id:auth.data.user.id,user_role:existing.data?.user_role||null,module_overrides:overrides,updated_at:new Date().toISOString()
  },{onConflict:"project_id,user_id"});
  if(r.error){setMsg(r.error.message);return}refresh();
 }

 return <div className="adaptive-settings-stack">
  <section className="panel page-panel">
   <div className="panel-title"><div><p className="eyebrow">ADAPTIVE WORKSPACE</p><h3>Fit BuildPath to this job</h3></div><span className="status-chip">{complexity} complexity</span></div>
   <p className="panel-copy">BuildPath starts simple and reveals workflows only when the project or your role makes them useful.</p>
   <div className="adaptive-profile">
    <label>Your role<select defaultValue="" onChange={saveMyRole}><option value="">Choose / keep current role</option><option value="owner_developer">Owner / Developer</option><option value="general_contractor">General Contractor</option><option value="construction_manager">Construction Manager</option><option value="project_manager">Project Manager</option><option value="superintendent">Superintendent / Field</option><option value="finance_controller">Finance / Controller</option><option value="architect_engineer">Architect / Engineer</option><option value="subcontractor">Subcontractor / Vendor</option></select></label>
   </div>
   <form className="adaptive-profile" onSubmit={saveProject}>
    <label>Project stage<select name="stage" defaultValue={project.project_stage||"planning"}><option value="planning">Planning</option><option value="design">Design</option><option value="preconstruction">Preconstruction</option><option value="procurement">Procurement</option><option value="construction">Construction</option><option value="commissioning">Commissioning</option><option value="closeout">Closeout</option></select></label>
    <label>Type of work<select name="mode" defaultValue={project.construction_mode||"new_construction"}><option value="new_construction">New construction</option><option value="renovation">Renovation</option><option value="tenant_improvement">Tenant improvement</option><option value="addition">Addition</option><option value="remediation">Remediation</option><option value="capital_improvement">Capital improvement</option></select></label>
    <label>Funding<select name="funding" defaultValue={project.funding_type||"private"}><option value="private">Private</option><option value="public">Public / government</option><option value="mixed">Mixed / public-private</option></select></label>
    <label>Complexity<select name="complexity" defaultValue={project.complexity_override||""}><option value="">Automatic</option><option value="simple">Simple</option><option value="standard">Standard</option><option value="complex">Complex</option></select></label>
    <button className="primary-action" disabled={busy}>{busy?"Saving…":"Update project fit"}</button>
   </form>
   {msg&&<div className="form-message">{msg}</div>}
  </section>

  <section className="panel page-panel">
   <div className="panel-title"><div><p className="eyebrow">WHAT THIS JOB REQUIRES</p><h3>Project requirements</h3></div></div>
   <p className="panel-copy">Only turn on requirements that actually apply. BuildPath can also propose these when it finds requirements in contracts or uploaded documents.</p>
   <div className="requirement-toggle-grid">{requirementOptions.map(([key,label])=>{const row=requirements.find(r=>r.requirement_key===key);return <label key={key}><input type="checkbox" checked={!!row?.enabled} onChange={e=>toggleRequirement(key,label,e.target.checked)}/><span><strong>{label}</strong><small>{row?.source==="document"?"Detected from project evidence":row?.enabled?"Enabled for this job":"Not required"}</small></span></label>})}</div>
  </section>

  <section className="panel page-panel">
   <div className="panel-title"><div><p className="eyebrow">YOUR WORKSPACE</p><h3>What BuildPath shows you</h3></div><span className="panel-copy">{visible.length} shown · {available.length} available · {hidden.length} hidden</span></div>
   <div className="module-control-list">{modules.map(m=><div key={m.key}><span><strong>{m.label}</strong><small>{m.reason}</small></span><select defaultValue="auto" onChange={e=>overrideModule(m.key,e.target.value)}><option value="auto">Automatic · {m.visibility}</option><option value="visible">Show me this</option><option value="available">Keep available</option><option value="hidden">Hide it</option></select></div>)}</div>
  </section>

  {suggestions.length>0&&<section className="panel page-panel"><p className="eyebrow">SUGGESTED NEXT ACTIONS</p><h3>Based on this job</h3><div className="adaptive-suggestions">{suggestions.map((s,i)=><p key={i}><span>→</span>{s}</p>)}</div></section>}
 </div>;
}

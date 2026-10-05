"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Project={id:string;organization_id:string;name:string;address:string|null;city:string|null;state:string|null;project_type:string|null;baseline_start:string|null;target_finish:string|null;original_budget:number|null;status:string};
type Company={id:string;name:string;company_type:string|null;organization_id:string};
type Person={id:string;first_name:string|null;last_name:string|null;title:string|null;email:string|null;company_id:string|null};
type Evidence={id:string;title:string|null;evidence_type:string;source_system:string|null;source_url:string|null;occurred_at:string|null;raw_text:string|null;created_at:string};
type EventRow={id:string;event_type:string;title:string;description:string|null;start_at:string|null;end_at:string|null;date_precision:string;cost_impact:number|null;schedule_impact_days:number|null};

const nav=["Overview","Timeline","Ask BuildPath","People & Companies","Vendors & Subs","Documents","Costs","Schedule","Project Data"];

function money(v:number|null|undefined){if(v==null)return"Not set";return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(v)}
function fmtDate(v:string|null|undefined){if(!v)return"Not set";const d=new Date(v.includes("T")?v:v+"T12:00:00");return d.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
function days(a:string|null,b:string|null){if(!a||!b)return null;return Math.max(0,Math.round((new Date(b).getTime()-new Date(a).getTime())/86400000))}

export function Workspace(){
 const[projects,setProjects]=useState<Project[]>([]);const[project,setProject]=useState<Project|null>(null);const[companies,setCompanies]=useState<Company[]>([]);const[people,setPeople]=useState<Person[]>([]);const[evidence,setEvidence]=useState<Evidence[]>([]);const[events,setEvents]=useState<EventRow[]>([]);const[section,setSection]=useState("Overview");const[loading,setLoading]=useState(true);const[error,setError]=useState("");const[switcher,setSwitcher]=useState(false);

 async function load(next:Project){
  const supabase=createClient();setProject(next);setLoading(true);setError("");
  const results=await Promise.all([
   supabase.from("companies").select("id,name,company_type,organization_id").eq("organization_id",next.organization_id).order("name"),
   supabase.from("people").select("id,first_name,last_name,title,email,company_id").eq("organization_id",next.organization_id).order("last_name"),
   supabase.from("evidence").select("id,title,evidence_type,source_system,source_url,occurred_at,raw_text,created_at").eq("project_id",next.id).order("created_at",{ascending:false}),
   supabase.from("project_events").select("id,event_type,title,description,start_at,end_at,date_precision,cost_impact,schedule_impact_days").eq("project_id",next.id).order("start_at",{ascending:true})
  ]);
  const first=results.find(r=>r.error);if(first&&first.error)setError(first.error.message);
  setCompanies((results[0].data||[]) as Company[]);setPeople((results[1].data||[]) as Person[]);setEvidence((results[2].data||[]) as Evidence[]);setEvents((results[3].data||[]) as EventRow[]);setLoading(false);
  const u=new URL(window.location.href);u.searchParams.set("project",next.id);window.history.replaceState({},"",u);
 }

 useEffect(()=>{(async()=>{const s=createClient();const auth=await s.auth.getUser();if(!auth.data.user){window.location.href="/login";return}const r=await s.from("projects").select("id,organization_id,name,address,city,state,project_type,baseline_start,target_finish,original_budget,status").order("created_at",{ascending:false});if(r.error){setError(r.error.message);setLoading(false);return}const list=(r.data||[]) as Project[];setProjects(list);if(!list.length){window.location.href="/setup";return}const wanted=new URLSearchParams(window.location.search).get("project");await load(list.find(p=>p.id===wanted)||list[0])})()},[]);

 async function logout(){await createClient().auth.signOut();window.location.href="/login"}
 if(loading&&!project)return <main className="setup-shell"><section className="setup-card"><p>Loading your BuildPath project…</p></section></main>;
 if(!project)return null;
 const location=[project.city,project.state].filter(Boolean).join(", ");
 return <div className="shell">
  <aside className="sidebar">
   <div className="brand"><span className="brand-mark">⬡</span><span>BuildPath</span></div>
   <div className="switcher-wrap">
    <button className="project-switcher" onClick={()=>setSwitcher(!switcher)}><span><strong>{project.name}</strong><small>{location||project.project_type||"Project"}</small></span><span>⌄</span></button>
    {switcher&&<div className="switcher-menu">{projects.map(p=><button key={p.id} className={p.id===project.id?"selected":""} onClick={()=>{setSwitcher(false);load(p)}}>{p.name}<small>{[p.city,p.state].filter(Boolean).join(", ")}</small></button>)}<a href="/setup">＋ Add project</a></div>}
   </div>
   <nav>{nav.map(n=><button key={n} className={n===section?"nav-active":""} onClick={()=>{if(n==="Vendors & Subs"){window.location.href="/vendors?project="+project.id}else setSection(n)}}>{n}</button>)}</nav>
   <div className="sidebar-bottom"><span className="sidebar-icon">▦</span><span><strong>Project memory</strong><small>{evidence.length} evidence · {events.length} events</small></span><button className="logout-mini" onClick={logout}>Log out</button></div>
  </aside>
  <main className="main">
   <header className="topbar"><div><p className="eyebrow">{section.toUpperCase()}</p><h1>{project.name}</h1><p>{project.address?(project.address+" · "):""}{location}</p></div><button className="ask" onClick={()=>setSection("Ask BuildPath")}><span>✦</span> Ask BuildPath</button></header>
   {error&&<div className="form-message">{error}</div>}
   {section==="Overview"&&<Overview project={project} companies={companies} people={people} evidence={evidence} events={events} go={setSection}/>}
   {section==="Timeline"&&<Timeline project={project} events={events} refresh={()=>load(project)}/>}
   {section==="Ask BuildPath"&&<Ask project={project} companies={companies} evidence={evidence} events={events}/>}
   {section==="People & Companies"&&<PeopleCompanies project={project} companies={companies} people={people} refresh={()=>load(project)}/>}
   {section==="Documents"&&<Documents project={project} evidence={evidence} refresh={()=>load(project)}/>}
   {section==="Costs"&&<Costs project={project} events={events}/>}
   {section==="Schedule"&&<Schedule project={project} events={events}/>}
   {section==="Project Data"&&<ProjectData project={project} companies={companies}/>}
  </main>
 </div>
}

function Overview({project,companies,people,evidence,events,go}:{project:Project;companies:Company[];people:Person[];evidence:Evidence[];events:EventRow[];go:(s:string)=>void}){
 const span=days(project.baseline_start,project.target_finish);const cost=events.reduce((s,e)=>s+(Number(e.cost_impact)||0),0);const ready=Math.min(100,20+Math.min(evidence.length*8,40)+Math.min(events.length*8,24)+Math.min((companies.length+people.length)*4,16));
 return <>
  <section className="hero-card"><div className="hero-copy"><p className="eyebrow">PROJECT MEMORY STATUS</p><h2>{evidence.length===0?"Your baseline is in. Now give BuildPath the evidence.":"BuildPath is starting to connect this project’s story."}</h2><p>{evidence.length===0?"Add schedules, meeting notes, emails, change orders, field observations and other records. BuildPath will connect them to people, companies, dates, costs and schedule effects.":String(evidence.length)+" evidence items and "+String(events.length)+" timeline events are connected to this project."}</p><button className="text-button" onClick={()=>go("Documents")}>Add project evidence <span>↗</span></button></div><div className="risk-score"><span>MEMORY READY</span><strong>{ready}</strong><small>{ready<50?"Getting started":ready<80?"Building context":"Connected"}</small></div></section>
  <section className="metrics"><article><span className="metric-icon">◷</span><span>Schedule</span><strong>{span==null?"Not set":String(span)+" days"}</strong><small>{fmtDate(project.baseline_start)} → {fmtDate(project.target_finish)}</small></article><article><span className="metric-icon">$</span><span>Budget</span><strong>{money(project.original_budget)}</strong><small>{cost?money(cost)+" linked impact":"No cost impacts linked yet"}</small></article><article><span className="metric-icon">◎</span><span>Network</span><strong>{companies.length} companies</strong><small>{people.length} people connected</small></article><article><span className="metric-icon">▤</span><span>Evidence</span><strong>{evidence.length} items</strong><small>{events.length} timeline events</small></article></section>
  <div className="two-col"><section className="panel"><p className="eyebrow">WHAT BUILDPATH KNOWS</p><h3>Project baseline</h3><div className="fact-list"><div><span>Type</span><strong>{project.project_type||"Not set"}</strong></div><div><span>Status</span><strong>{project.status}</strong></div><div><span>Start</span><strong>{fmtDate(project.baseline_start)}</strong></div><div><span>Finish</span><strong>{fmtDate(project.target_finish)}</strong></div></div></section><section className="panel ask-panel"><p className="eyebrow">NEXT BEST STEP</p><h3>{evidence.length?"Connect more project history":"Add the first source record"}</h3><p className="panel-copy">The more source evidence you add, the better BuildPath can reconstruct decisions, costs and delays.</p><button className="primary-action" onClick={()=>go("Documents")}>Open Documents</button></section></div>
  <section className="panel timeline-panel"><div className="panel-title"><div><p className="eyebrow">CONNECTED TIMELINE</p><h3>{events.length?"Current project events":"No project events yet"}</h3></div><button className="text-button" onClick={()=>go("Timeline")}>Open full timeline ↗</button></div>{events.length?<div className="timeline">{events.slice(0,8).map(e=><article key={e.id}><div className="dot"/><time>{fmtDate(e.start_at)}</time><span className="type">{e.event_type}</span><strong>{e.title}</strong><p>{e.description||"No description"}</p></article>)}</div>:<Empty text="Add an event or dated evidence to begin reconstructing the project timeline."/>}</section>
 </>;
}

function Timeline({project,events,refresh}:{project:Project;events:EventRow[];refresh:()=>void}){
 const[open,setOpen]=useState(false);const[err,setErr]=useState("");
 async function add(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);const r=await createClient().from("project_events").insert({project_id:project.id,event_type:String(f.get("type")||"project"),title:String(f.get("title")||""),description:String(f.get("description")||"")||null,start_at:f.get("date")?String(f.get("date"))+"T12:00:00":null,date_precision:"day",cost_impact:f.get("cost")?Number(f.get("cost")):null,schedule_impact_days:f.get("days")?Number(f.get("days")):null});if(r.error){setErr(r.error.message);return}setOpen(false);refresh()}
 return <section className="panel page-panel"><div className="panel-title"><div><p className="eyebrow">PROJECT HISTORY</p><h3>Connected timeline</h3></div><button className="primary-action" onClick={()=>setOpen(!open)}>＋ Add event</button></div>{open&&<form className="inline-form" onSubmit={add}><input name="title" required placeholder="Event title"/><select name="type"><option>project</option><option>schedule</option><option>change</option><option>meeting</option><option>field</option><option>weather</option><option>decision</option></select><input name="date" type="date"/><input name="days" type="number" placeholder="Schedule impact days"/><input name="cost" type="number" placeholder="Cost impact"/><textarea name="description" placeholder="What happened?"/><button className="primary-action">Save event</button>{err&&<div className="form-message">{err}</div>}</form>}{events.length?<div className="event-list">{events.map(e=><article key={e.id}><time>{fmtDate(e.start_at)}</time><div><span className="type">{e.event_type}</span><h4>{e.title}</h4><p>{e.description||"No description"}</p></div><div className="impact-stack">{e.schedule_impact_days!=null&&<span>{e.schedule_impact_days} days</span>}{e.cost_impact!=null&&<span>{money(e.cost_impact)}</span>}</div></article>)}</div>:<Empty text="No events yet. Add the first known milestone, decision, delay or field event."/>}</section>
}

function PeopleCompanies({project,companies,people,refresh}:{project:Project;companies:Company[];people:Person[];refresh:()=>void}){
 const[mode,setMode]=useState<"company"|"person"|null>(null);const[err,setErr]=useState("");
 async function company(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);const r=await createClient().from("companies").insert({organization_id:project.organization_id,name:String(f.get("name")),company_type:String(f.get("type")||"other")});if(r.error){setErr(r.error.message);return}setMode(null);refresh()}
 async function person(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);const r=await createClient().from("people").insert({organization_id:project.organization_id,first_name:String(f.get("first")||"")||null,last_name:String(f.get("last")||"")||null,title:String(f.get("title")||"")||null,email:String(f.get("email")||"")||null,company_id:String(f.get("company")||"")||null});if(r.error){setErr(r.error.message);return}setMode(null);refresh()}
 return <><section className="panel page-panel"><div className="panel-title"><div><p className="eyebrow">PROJECT NETWORK</p><h3>Companies</h3></div><button className="primary-action" onClick={()=>setMode(mode==="company"?null:"company")}>＋ Add company</button></div>{mode==="company"&&<form className="inline-form compact-form" onSubmit={company}><input name="name" required placeholder="Company name"/><select name="type"><option value="owner">Owner / Developer</option><option value="general_contractor">General Contractor</option><option value="subcontractor">Subcontractor</option><option value="architect">Architect</option><option value="engineer">Engineer</option><option value="vendor">Vendor</option><option value="other">Other</option></select><button className="primary-action">Save company</button></form>}<div className="card-grid">{companies.map(c=><article className="entity-card" key={c.id}><span className="entity-avatar">{c.name.slice(0,2).toUpperCase()}</span><div><h4>{c.name}</h4><p>{(c.company_type||"company").replaceAll("_"," ")}</p></div></article>)}</div></section>
 <section className="panel page-panel"><div className="panel-title"><div><p className="eyebrow">PEOPLE</p><h3>People on this project</h3></div><button className="primary-action" onClick={()=>setMode(mode==="person"?null:"person")}>＋ Add person</button></div>{mode==="person"&&<form className="inline-form compact-form" onSubmit={person}><input name="first" placeholder="First name"/><input name="last" placeholder="Last name"/><input name="title" placeholder="Title / role"/><input name="email" type="email" placeholder="Email"/><select name="company"><option value="">No company</option>{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><button className="primary-action">Save person</button></form>}{err&&<div className="form-message">{err}</div>}{people.length?<div className="card-grid">{people.map(p=><article className="entity-card" key={p.id}><span className="entity-avatar">{((p.first_name||"")+(p.last_name||"")).slice(0,2).toUpperCase()||"?"}</span><div><h4>{[p.first_name,p.last_name].filter(Boolean).join(" ")||"Unnamed person"}</h4><p>{p.title||"Role not set"}{p.email?" · "+p.email:""}</p></div></article>)}</div>:<Empty text="No individual people have been added yet."/>}</section></>
}

function Documents({project,evidence,refresh}:{project:Project;evidence:Evidence[];refresh:()=>void}){
 const[open,setOpen]=useState(false);const[err,setErr]=useState("");const[uploading,setUploading]=useState(false);const[candidates,setCandidates]=useState<any[]>([]);
 async function loadCandidates(){const r=await createClient().from("extraction_candidates").select("id,candidate_type,candidate_key,proposed_value,confidence,status").eq("project_id",project.id).eq("status","pending").order("created_at",{ascending:false}).limit(50);if(!r.error)setCandidates(r.data||[])}
 useEffect(()=>{loadCandidates()},[project.id]);
 async function uploadFile(e:any){
  const file=e.target.files?.[0];if(!file)return;setUploading(true);setErr("");
  const s=createClient();const path=project.id+"/"+crypto.randomUUID()+"-"+file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
  const up=await s.storage.from("project-evidence").upload(path,file,{contentType:file.type||undefined,upsert:false});
  if(up.error){setErr(up.error.message);setUploading(false);return}
  const sess=await s.auth.getSession();const token=sess.data.session?.access_token;
  if(!token){setErr("Your session expired. Please sign in again.");setUploading(false);return}
  const r=await fetch("/api/extract",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify({projectId:project.id,storagePath:path,fileName:file.name,mimeType:file.type})});
  const data=await r.json();if(!r.ok){setErr(data.error||"Extraction failed");setUploading(false);return}
  setUploading(false);refresh();loadCandidates();e.target.value="";
 }
 async function review(id:string,status:"accepted"|"rejected",candidate:any){
  const s=createClient();
  if(status==="accepted"&&candidate.candidate_type==="event"){
   const v=candidate.proposed_value||{};
   await s.from("project_events").insert({project_id:project.id,event_type:v.event_type||"document",title:v.title||"Extracted event",description:v.description||null,start_at:v.date?new Date(v.date).toISOString():null,date_precision:"day"});
  }
  await s.from("extraction_candidates").update({status,reviewed_at:new Date().toISOString()}).eq("id",id);
  loadCandidates();refresh();
 }
 async function add(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);const r=await createClient().from("evidence").insert({project_id:project.id,evidence_type:String(f.get("type")||"document"),title:String(f.get("title")||"")||null,source_system:String(f.get("source")||"manual"),source_url:String(f.get("url")||"")||null,occurred_at:f.get("date")?String(f.get("date"))+"T12:00:00":null,raw_text:String(f.get("notes")||"")||null});if(r.error){setErr(r.error.message);return}setOpen(false);refresh()}
 return <><section className="panel page-panel"><div className="panel-title"><div><p className="eyebrow">EVIDENCE LIBRARY</p><h3>Documents & source evidence</h3></div><button className="primary-action" onClick={()=>setOpen(!open)}>＋ Manual entry</button></div><p className="panel-copy">Upload a PDF, TXT, CSV, JSON or EML and BuildPath will store it privately, extract text, and create proposed facts for review. Other supported files are stored and queued for review.</p><label className="upload-zone"><input type="file" onChange={uploadFile} disabled={uploading}/><span>{uploading?"Uploading & extracting…":"Drop or choose a project file"}</span><small>PDF, schedules, meeting notes, RFIs, change orders, email exports, CSV/JSON and more</small></label>{open&&<form className="inline-form" onSubmit={add}><input name="title" required placeholder="Document / evidence title"/><select name="type"><option value="document">Document</option><option value="email">Email</option><option value="meeting_note">Meeting note</option><option value="change_order">Change order</option><option value="rfi">RFI</option><option value="invoice">Invoice</option><option value="photo">Photo / field observation</option><option value="schedule">Schedule</option></select><input name="source" placeholder="Source system"/><input name="date" type="date"/><input name="url" type="url" placeholder="Source URL (optional)"/><textarea name="notes" placeholder="Paste notes, summary or source text"/><button className="primary-action">Save evidence</button></form>}{err&&<div className="form-message">{err}</div>}{evidence.length?<div className="evidence-list">{evidence.map(e=><article key={e.id}><span className="doc-icon">▤</span><div><span className="type">{e.evidence_type.replaceAll("_"," ")}</span><h4>{e.title||"Untitled evidence"}</h4><p>{e.source_system||"manual"} · {fmtDate(e.occurred_at||e.created_at)}</p>{e.raw_text&&<small>{e.raw_text.slice(0,180)}{e.raw_text.length>180?"…":""}</small>}</div>{e.source_url&&<a href={e.source_url} target="_blank" rel="noreferrer">Open ↗</a>}</article>)}</div>:<Empty text="No evidence has been added yet."/>}</section>
 <section className="panel page-panel"><div className="panel-title"><div><p className="eyebrow">EXTRACTION REVIEW</p><h3>Proposed project facts</h3></div><span className="review-count">{candidates.length} pending</span></div>{candidates.length?<div className="candidate-list">{candidates.map(x=><article key={x.id}><div><span className="type">{x.candidate_type}</span><h4>{x.proposed_value?.title||x.candidate_key||"Extracted fact"}</h4><p>{x.proposed_value?.summary||x.proposed_value?.description||x.proposed_value?.email||x.proposed_value?.amount_text||x.proposed_value?.date||JSON.stringify(x.proposed_value)}</p><small>{x.confidence?Math.round(x.confidence*100)+"% confidence":""}</small></div><div className="review-actions"><button onClick={()=>review(x.id,"accepted",x)}>Accept</button><button onClick={()=>review(x.id,"rejected",x)}>Reject</button></div></article>)}</div>:<Empty text="No extracted facts are waiting for review."/>}</section></>
}

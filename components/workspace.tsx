"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BuildPathLogo } from "@/components/buildpath-logo";
import { AdaptiveSettings } from "@/components/adaptive-settings";
import { getProjectVisual } from "@/lib/project-visuals";
import { ProjectScheduleTimeline } from "@/components/project-schedule-timeline";
import { buildWorkspace, type ProjectRequirement, type ModulePreference, type ModuleKey } from "@/lib/adaptive-workspace";

type Project={id:string;organization_id:string;name:string;address:string|null;city:string|null;state:string|null;project_type:string|null;baseline_start:string|null;target_finish:string|null;original_budget:number|null;status:string;hero_image_url:string|null;project_stage:string|null;user_role:string|null;construction_mode:string|null;funding_type:string|null;complexity_override:string|null};
type Company={id:string;name:string;company_type:string|null;organization_id:string};
type Person={id:string;first_name:string|null;last_name:string|null;title:string|null;email:string|null;company_id:string|null};
type Evidence={id:string;title:string|null;evidence_type:string;source_system:string|null;source_url:string|null;occurred_at:string|null;raw_text:string|null;created_at:string};
type EventRow={id:string;event_type:string;title:string;description:string|null;start_at:string|null;end_at:string|null;date_precision:string;status:string|null;cost_impact:number|null;schedule_impact_days:number|null};
type VendorSummary={id:string;legal_name:string|null;compliance_status:string;payment_enrollment_status:string;contact_name:string|null;contact_email:string|null};

function moduleSection(key:ModuleKey){
 if(key==="home")return"Overview";
 if(key==="timeline")return"Timeline";
 if(key==="documents")return"Documents";
 if(key==="ask")return"Ask BuildPath";
 if(key==="schedule")return"Schedule";
 if(key==="cost")return"Costs";
 if(key==="people")return"People & Companies";
 if(key==="project_data")return"Project Data";
 return "Adaptive:"+key;
}

function money(v:number|null|undefined){if(v==null)return"Not set";return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(v)}
function fmtDate(v:string|null|undefined){if(!v)return"Not set";const d=new Date(v.includes("T")?v:v+"T12:00:00");return d.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
function days(a:string|null,b:string|null){if(!a||!b)return null;return Math.max(0,Math.round((new Date(b).getTime()-new Date(a).getTime())/86400000))}

export function Workspace(){
 const[projects,setProjects]=useState<Project[]>([]);const[project,setProject]=useState<Project|null>(null);const[heroImage,setHeroImage]=useState("");const[companies,setCompanies]=useState<Company[]>([]);const[people,setPeople]=useState<Person[]>([]);const[evidence,setEvidence]=useState<Evidence[]>([]);const[events,setEvents]=useState<EventRow[]>([]);const[vendors,setVendors]=useState<VendorSummary[]>([]);const[requirements,setRequirements]=useState<ProjectRequirement[]>([]);const[modulePrefs,setModulePrefs]=useState<ModulePreference[]>([]);const[userModulePrefs,setUserModulePrefs]=useState<ModulePreference[]>([]);const[userRole,setUserRole]=useState<string|null>(null);const[section,setSection]=useState("Overview");const[loading,setLoading]=useState(true);const[error,setError]=useState("");const[switcher,setSwitcher]=useState(false);

 async function load(next:Project){
  const supabase=createClient();setProject(next);setLoading(true);setError("");
  const auth=await supabase.auth.getUser();const uid=auth.data.user?.id;
  if(next.hero_image_url){const signed=await supabase.storage.from("project-assets").createSignedUrl(next.hero_image_url,3600);setHeroImage(signed.data?.signedUrl||getProjectVisual(next.project_type).image)}else{setHeroImage(getProjectVisual(next.project_type).image)}
  const results=await Promise.all([
   supabase.from("companies").select("id,name,company_type,organization_id").eq("organization_id",next.organization_id).order("name"),
   supabase.from("people").select("id,first_name,last_name,title,email,company_id").eq("organization_id",next.organization_id).order("last_name"),
   supabase.from("evidence").select("id,title,evidence_type,source_system,source_url,occurred_at,raw_text,created_at").eq("project_id",next.id).order("created_at",{ascending:false}),
   supabase.from("project_events").select("id,event_type,title,description,start_at,end_at,date_precision,status,cost_impact,schedule_impact_days").eq("project_id",next.id).order("start_at",{ascending:true}),
   supabase.from("vendor_profiles").select("id,legal_name,compliance_status,payment_enrollment_status,contact_name,contact_email").eq("organization_id",next.organization_id).order("created_at",{ascending:false}),
   supabase.from("project_requirements").select("requirement_key,label,enabled,source").eq("project_id",next.id),
   supabase.from("project_module_preferences").select("module_key,visibility").eq("project_id",next.id),
   uid?supabase.from("project_user_preferences").select("user_role,module_overrides").eq("project_id",next.id).eq("user_id",uid).maybeSingle():Promise.resolve({data:null,error:null})
  ]);
  const first=results.find(r=>r.error);if(first&&first.error)setError(first.error.message);
  setCompanies((results[0].data||[]) as Company[]);setPeople((results[1].data||[]) as Person[]);setEvidence((results[2].data||[]) as Evidence[]);setEvents((results[3].data||[]) as EventRow[]);setVendors((results[4].data||[]) as VendorSummary[]);setRequirements((results[5].data||[]) as ProjectRequirement[]);setModulePrefs((results[6].data||[]) as ModulePreference[]);
  const pref=(results[7].data as {user_role?:string|null;module_overrides?:Record<string,string>}|null);
  setUserRole(pref?.user_role||next.user_role||null);
  setUserModulePrefs(Object.entries(pref?.module_overrides||{}).filter(([,v])=>["visible","available","hidden"].includes(String(v))).map(([module_key,visibility])=>({module_key,visibility:visibility as "visible"|"available"|"hidden"})));
  setLoading(false);
  const u=new URL(window.location.href);u.searchParams.set("project",next.id);window.history.replaceState({},"",u);
 }

 useEffect(()=>{(async()=>{const s=createClient();const auth=await s.auth.getUser();if(!auth.data.user){window.location.href="/login";return}const r=await s.from("projects").select("id,organization_id,name,address,city,state,project_type,baseline_start,target_finish,original_budget,status,hero_image_url,project_stage,user_role,construction_mode,funding_type,complexity_override").order("created_at",{ascending:false});if(r.error){setError(r.error.message);setLoading(false);return}const list=(r.data||[]) as Project[];setProjects(list);if(!list.length){window.location.href="/setup";return}const wanted=new URLSearchParams(window.location.search).get("project");await load(list.find(p=>p.id===wanted)||list[0])})()},[]);

 async function logout(){await createClient().auth.signOut();window.location.href="/login"}
 if(loading&&!project)return <main className="setup-shell"><section className="setup-card"><p>Loading your BuildPath project…</p></section></main>;
 if(!project)return null;
 const location=[project.city,project.state].filter(Boolean).join(", ");
 const visual=getProjectVisual(project.project_type);
 const adaptiveProject={...project,user_role:userRole||project.user_role};
 const adaptiveModules=buildWorkspace(adaptiveProject,requirements,[...modulePrefs,...userModulePrefs],companies.length,evidence.length);
 return <div className="shell">
  <aside className="sidebar">
   <BuildPathLogo/>
   <div className="switcher-wrap">
    <button className="project-switcher" onClick={()=>setSwitcher(!switcher)}><span><strong>{project.name}</strong><small>{location||project.project_type||"Project"}</small></span><span>⌄</span></button>
    {switcher&&<div className="switcher-menu">{projects.map(p=><button key={p.id} className={p.id===project.id?"selected":""} onClick={()=>{setSwitcher(false);load(p)}}>{p.name}<small>{[p.city,p.state].filter(Boolean).join(", ")}</small></button>)}<a href="/setup">＋ Add project</a></div>}
   </div>
   <nav>
 {adaptiveModules.filter(m=>m.visibility==="visible").map(m=>
  m.key==="vendors"
   ?<a key={m.key} className="side-link" href={"/vendors?project="+project.id}><span className="nav-icon">{m.icon}</span>{m.label}</a>
   :m.key==="field_capture"
    ?<a key={m.key} className="side-link field-nav" href={"/field?project="+project.id}><span className="nav-icon">{m.icon}</span>{m.label}</a>
    :<button key={m.key} className={moduleSection(m.key)===section?"nav-active":""} onClick={()=>setSection(moduleSection(m.key))}><span className="nav-icon">{m.icon}</span>{m.label}{m.key==="ask"&&<small className="beta-badge">BETA</small>}</button>
 )}
 {adaptiveModules.some(m=>m.visibility==="available")&&<><div className="nav-divider"/><button className="muted-nav" onClick={()=>setSection("Project Data")}><span className="nav-icon">＋</span>Add to Project <small>{adaptiveModules.filter(m=>m.visibility==="available").length}</small></button></>}
</nav>
   <div className="sidebar-bottom"><span className="sidebar-icon">▦</span><span><strong>Project memory</strong><small>{evidence.length} evidence · {events.length} events</small></span><button className="logout-mini" onClick={logout}>Log out</button></div>
  </aside>
  <main className="main">
   <div className="global-topbar"><div className="global-search">⌕ <span>Search projects, documents, subs, or ask anything...</span></div><div className="global-user"><span className="notify-dot">●</span><span className="user-avatar">MG</span><span><strong>BuildPath</strong><small>Project workspace</small></span></div></div>
   <header className="topbar" style={{backgroundImage:"linear-gradient(90deg,rgba(10,11,12,.88),rgba(10,11,12,.54) 55%,rgba(10,11,12,.35)),url("+JSON.stringify(heroImage||visual.image)+")"}}><div><p className="eyebrow">{visual.eyebrow}</p><h1>{visual.headline}</h1><p>{visual.subhead}</p></div></header><section className="project-ribbon"><div><small>Project</small><strong>{project.name}</strong></div><div className="project-ribbon-meta"><span>{location||"Location not set"}</span><span>{project.project_type||"Project"}</span><span>{money(project.original_budget)}</span></div><button onClick={()=>setSection("Project Data")}>View Project →</button></section>
   {error&&<div className="form-message">{error}</div>}
   {section==="Overview"&&<Overview project={project} companies={companies} people={people} evidence={evidence} events={events} vendors={vendors} visibleModules={adaptiveModules.filter(m=>m.visibility==="visible")} go={setSection}/>}
   {section==="Timeline"&&<Timeline project={project} events={events} refresh={()=>load(project)}/>}
   {section==="Ask BuildPath"&&<Ask project={project} companies={companies} evidence={evidence} events={events}/>}
   {section==="People & Companies"&&<PeopleCompanies project={project} companies={companies} people={people} refresh={()=>load(project)}/>}
   {section==="Documents"&&<Documents project={project} evidence={evidence} refresh={()=>load(project)}/>}
   {section==="Costs"&&<Costs project={project} events={events}/>}
   {section==="Schedule"&&<Schedule project={project} events={events}/>}
   {section==="Project Data"&&<><AdaptiveSettings project={adaptiveProject} requirements={requirements} modules={adaptiveModules} companyCount={companies.length} documentCount={evidence.length} refresh={()=>load(project)}/><ProjectData project={project} companies={companies} refresh={()=>load(project)}/></>}
  </main>
 </div>
}

function Overview({project,companies,people,evidence,events,vendors,visibleModules,go}:{project:Project;companies:Company[];people:Person[];evidence:Evidence[];events:EventRow[];vendors:VendorSummary[];visibleModules:{key:ModuleKey;label:string;icon:string;reason:string}[];go:(s:string)=>void}){
 const span=days(project.baseline_start,project.target_finish);
 const totalImpact=events.reduce((s,e)=>s+(Number(e.cost_impact)||0),0);
 const scheduleImpact=events.reduce((s,e)=>s+(Number(e.schedule_impact_days)||0),0);
 const forecast=(project.original_budget||0)+totalImpact;
 const completeVendors=vendors.filter(v=>["approved","submitted"].includes(v.compliance_status)).length;
 const compliance=vendors.length?Math.round((completeVendors/vendors.length)*100):0;
 const recentEvidence=evidence.slice(0,5);
 const approvals=events.filter(e=>["pending","submitted","under_review","open"].includes((e.status||"").toLowerCase())||["change","decision"].includes(e.event_type)).slice(0,5);
 const recentEvents=[...events].sort((a,b)=>new Date(b.start_at||0).getTime()-new Date(a.start_at||0).getTime()).slice(0,5);
 const show=(key:ModuleKey)=>visibleModules.some(m=>m.key===key);
 const scheduleRows=[
  ["Site Work",100],
  ["Foundations",Math.min(100,Math.max(25,100-scheduleImpact*2))],
  ["Structure",Math.min(100,Math.max(15,76-scheduleImpact))],
  ["MEP Rough-In",Math.min(100,Math.max(8,42-Math.round(scheduleImpact/2)))],
  ["Interiors",Math.min(100,Math.max(4,18-Math.round(scheduleImpact/3)))]
 ] as [string,number][];
 return <div className="dashboard-grid">
  <section className="panel dashboard-overview">
   <div className="panel-title"><div><h3>▥ &nbsp; Project Overview</h3></div><span className="status-chip green-dot">{project.status==="planning"?"On Track":project.status}</span></div>
   <div className="overview-stats">
    <div><span>% Complete</span><strong>{Math.min(95,Math.max(18,Math.round((evidence.length+events.length+companies.length)*2.2)))}%</strong><i><b style={{width:Math.min(95,Math.max(18,Math.round((evidence.length+events.length+companies.length)*2.2)))+"%"}}/></i></div>
    <div><span>Schedule Status</span><strong className={scheduleImpact>7?"warn-text":"ok-text"}>{scheduleImpact>7?"At Risk":"On Track"}</strong><small>{scheduleImpact?String(scheduleImpact)+" linked days":"Baseline active"}</small></div>
    <div><span>Budget Status</span><strong>{money(forecast)}</strong><small>of {money(project.original_budget)}</small><i><b style={{width:project.original_budget?Math.min(100,(forecast/project.original_budget)*100)+"%":"0%"}}/></i></div>
    <div><span>Target Completion</span><strong>{fmtDate(project.target_finish)}</strong><small>{span?String(span)+" baseline days":"Date not set"}</small></div>
   </div>
  </section>

  <section className="panel dashboard-ask">
   <div className="panel-title"><h3><span className="spark">✦</span> Ask BuildPath <small className="beta-inline">BETA</small></h3></div>
   <button className="question-input" onClick={()=>go("Ask BuildPath")}>Ask a question about your project, documents, schedule, or costs… <b>→</b></button>
   <div className="question-presets"><button onClick={()=>go("Ask BuildPath")}>What’s driving schedule risk?</button><button onClick={()=>go("Ask BuildPath")}>Show pending approvals</button><button onClick={()=>go("Ask BuildPath")}>Summarize project activity</button><button onClick={()=>go("Ask BuildPath")}>Which subs need attention?</button></div>
  </section>

  {show("schedule")&&<section className="panel dashboard-card schedule-card">
   <div className="panel-title"><h3>▣ &nbsp; Schedule</h3><button className="text-button" onClick={()=>go("Schedule")}>View Schedule →</button></div>
   <div className="schedule-mini">{scheduleRows.map(([label,pct])=><div key={label}><span>{label}</span><i><b style={{width:pct+"%"}}/></i><strong>{pct}%</strong></div>)}</div>
  </section>}

  {show("cost")&&<section className="panel dashboard-card cost-card">
   <div className="panel-title"><h3>◉ &nbsp; Cost</h3><button className="text-button" onClick={()=>go("Costs")}>View Cost →</button></div>
   <div className="cost-top"><div><span>Total Budget</span><strong>{money(project.original_budget)}</strong></div><div><span>Forecast</span><strong>{money(forecast)}</strong></div><div><span>Linked Impact</span><strong className={totalImpact>0?"warn-text":"ok-text"}>{money(totalImpact)}</strong></div></div>
   <div className="cost-bar"><b style={{width:project.original_budget?Math.min(100,(forecast/project.original_budget)*100)+"%":"0%"}}/></div>
   <div className="cost-bottom"><div><span>Schedule exposure</span><strong>{scheduleImpact} days</strong></div><div><span>Evidence-backed changes</span><strong>{events.filter(e=>e.cost_impact).length}</strong></div><div><span>Variance</span><strong>{money(totalImpact)}</strong></div></div>
  </section>}

  {(show("vendors")||show("compliance"))&&<section className="panel dashboard-card compliance-card">
   <div className="panel-title"><h3>♟ &nbsp; Subcontractor Compliance</h3><a className="text-button" href={"/vendors?project="+project.id}>View All →</a></div>
   <div className="compliance-layout"><div className="compliance-ring" style={{background:"conic-gradient(var(--green) 0 "+compliance+"%, #f0ad28 "+compliance+"% "+Math.min(100,compliance+12)+"%, #e6e7e4 "+Math.min(100,compliance+12)+"% 100%)"}}><strong>{compliance}%</strong><span>Compliant</span></div><div className="compliance-legend"><p><i className="legend-green"/>Complete <b>{completeVendors}</b></p><p><i className="legend-yellow"/>Pending <b>{vendors.filter(v=>["invited","in_progress","submitted"].includes(v.compliance_status)).length}</b></p><p><i className="legend-red"/>Attention <b>{vendors.filter(v=>["needs_attention","expired"].includes(v.compliance_status)).length}</b></p></div></div>
   <div className="mini-compliance"><div><span>W-9 Collection</span><strong>{completeVendors} of {vendors.length||0}</strong></div><div><span>COI Tracking</span><strong>{vendors.filter(v=>v.compliance_status==="approved").length} of {vendors.length||0}</strong></div></div>
  </section>}

  <section className="panel adaptive-summary">
   <div className="panel-title"><div><p className="eyebrow">TAILORED TO THIS JOB</p><h3>Priority workflows</h3></div><button className="text-button" onClick={()=>go("Project Data")}>Customize →</button></div>
   <div className="adaptive-tags">{visibleModules.filter(m=>!["home","timeline","documents","ask","schedule","cost","vendors","project_data"].includes(m.key)).slice(0,6).map(m=><button key={m.key} onClick={()=>go(moduleSection(m.key))}><b>{m.icon} {m.label}</b><small>{m.reason}</small></button>)}</div>
  </section>

  <section className="panel dashboard-list">
   <div className="panel-title"><h3>⌁ &nbsp; Recent Activity</h3><button className="text-button" onClick={()=>go("Timeline")}>View All →</button></div>
   <div className="compact-list">{recentEvents.length?recentEvents.map(e=><div key={e.id}><span className="list-icon">✓</span><p><strong>{e.title}</strong><small>{e.event_type} · {fmtDate(e.start_at)}</small></p><time>{e.schedule_impact_days?String(e.schedule_impact_days)+"d impact":""}</time></div>):<p className="empty-inline">No recent activity.</p>}</div>
  </section>

  <section className="panel dashboard-list">
   <div className="panel-title"><h3>▣ &nbsp; Pending Approvals</h3><button className="text-button" onClick={()=>go("Timeline")}>View All ({approvals.length}) →</button></div>
   <div className="compact-list">{approvals.length?approvals.map((e,i)=><div key={e.id}><span className={"approval-code code-"+(i%3)}>{e.event_type.slice(0,3).toUpperCase()}</span><p><strong>{e.title}</strong><small>{e.description||"Project review item"}</small></p><time>{e.status||"Review"}</time></div>):<p className="empty-inline">No pending approvals detected.</p>}</div>
  </section>

  <section className="panel dashboard-list">
   <div className="panel-title"><h3>▤ &nbsp; Project Documents</h3><button className="text-button" onClick={()=>go("Documents")}>View All →</button></div>
   <div className="compact-list">{recentEvidence.length?recentEvidence.map(e=><div key={e.id}><span className="file-badge">PDF</span><p><strong>{e.title||"Untitled evidence"}</strong><small>{e.source_system||"BuildPath"} · {fmtDate(e.occurred_at||e.created_at)}</small></p><time>•••</time></div>):<p className="empty-inline">No documents uploaded yet.</p>}</div>
  </section>
 </div>;
}
function Timeline({project,events,refresh}:{project:Project;events:EventRow[];refresh:()=>void}){
 const[open,setOpen]=useState(false);const[err,setErr]=useState("");
 async function add(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  const f=new FormData(e.currentTarget);
  const startDate=String(f.get("date")||"");
  const endDate=String(f.get("end_date")||"");
  if(endDate && (!startDate || endDate<startDate)){setErr("The end date must be on or after the event start date.");return}
  const r=await createClient().from("project_events").insert({
   project_id:project.id,event_type:String(f.get("type")||"project"),
   title:String(f.get("title")||""),description:String(f.get("description")||"")||null,
   start_at:startDate?startDate+"T12:00:00":null,end_at:endDate?endDate+"T12:00:00":null,
   date_precision:startDate?"day":"unknown",
   cost_impact:f.get("cost")?Number(f.get("cost")):null,
   schedule_impact_days:f.get("days")?Number(f.get("days")):null
  });
  if(r.error){setErr(r.error.message);return}setErr("");setOpen(false);refresh();
 }

 return <><ProjectScheduleTimeline project={project} events={events} refresh={refresh}/><section className="panel page-panel"><div className="panel-title"><div><p className="eyebrow">PROJECT HISTORY</p><h3>Connected event history</h3></div><button className="primary-action" onClick={()=>setOpen(!open)}>＋ Add event</button></div>{open&&<form className="inline-form" onSubmit={add}><input name="title" required placeholder="Event title"/><select name="type"><option value="project">Project event</option><option value="schedule">Schedule</option><option value="delay">Setback / delay</option><option value="weather">Weather event</option><option value="weather_delay">Weather delay</option><option value="work_injury">Work injury</option><option value="safety_incident">Safety incident</option><option value="change">Change</option><option value="meeting">Meeting</option><option value="field">Field update</option><option value="decision">Decision</option></select><input name="date" type="date" aria-label="Event start date"/><input name="end_date" type="date" aria-label="Event end date (optional)" title="End date, if recorded"/><input name="days" type="number" placeholder="Reported schedule impact days"/><input name="cost" type="number" placeholder="Cost impact"/><textarea name="description" placeholder="What happened?"/><button className="primary-action">Save event</button>{err&&<div className="form-message">{err}</div>}</form>}{events.length?<div className="event-list">{events.map(e=><article key={e.id}><time>{fmtDate(e.start_at)}</time><div><span className="type">{e.event_type}</span><h4>{e.title}</h4><p>{e.description||"No description"}</p></div><div className="impact-stack">{e.schedule_impact_days!=null&&<span>{e.schedule_impact_days} days</span>}{e.cost_impact!=null&&<span>{money(e.cost_impact)}</span>}</div></article>)}</div>:<Empty text="No events yet. Add a decision, delay or field event."/>}</section></>
}

function PeopleCompanies({project,companies,people,refresh}:{project:Project;companies:Company[];people:Person[];refresh:()=>void}){
 const[mode,setMode]=useState<"company"|"person"|null>(null);const[err,setErr]=useState("");
 async function company(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);const r=await createClient().from("companies").insert({organization_id:project.organization_id,name:String(f.get("name")),company_type:String(f.get("type")||"other")});if(r.error){setErr(r.error.message);return}setMode(null);refresh()}
 async function person(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);const r=await createClient().from("people").insert({organization_id:project.organization_id,first_name:String(f.get("first")||"")||null,last_name:String(f.get("last")||"")||null,title:String(f.get("title")||"")||null,email:String(f.get("email")||"")||null,company_id:String(f.get("company")||"")||null});if(r.error){setErr(r.error.message);return}setMode(null);refresh()}
 return <><section className="panel page-panel"><div className="panel-title"><div><p className="eyebrow">PROJECT NETWORK</p><h3>Companies</h3></div><button className="primary-action" onClick={()=>setMode(mode==="company"?null:"company")}>＋ Add company</button></div>{mode==="company"&&<form className="inline-form compact-form" onSubmit={company}><input name="name" required placeholder="Company name"/><select name="type"><option value="owner">Owner / Developer</option><option value="general_contractor">General Contractor</option><option value="subcontractor">Subcontractor</option><option value="architect">Architect</option><option value="engineer">Engineer</option><option value="vendor">Vendor</option><option value="other">Other</option></select><button className="primary-action">Save company</button></form>}<div className="card-grid">{companies.map(c=><article className="entity-card" key={c.id}><span className="entity-avatar">{c.name.slice(0,2).toUpperCase()}</span><div><h4>{c.name}</h4><p>{(c.company_type||"company").replaceAll("_"," ")}</p></div></article>)}</div></section>
 <section className="panel page-panel"><div className="panel-title"><div><p className="eyebrow">PEOPLE</p><h3>People on this project</h3></div><button className="primary-action" onClick={()=>setMode(mode==="person"?null:"person")}>＋ Add person</button></div>{mode==="person"&&<form className="inline-form compact-form" onSubmit={person}><input name="first" placeholder="First name"/><input name="last" placeholder="Last name"/><input name="title" placeholder="Title / role"/><input name="email" type="email" placeholder="Email"/><select name="company"><option value="">No company</option>{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><button className="primary-action">Save person</button></form>}{err&&<div className="form-message">{err}</div>}{people.length?<div className="card-grid">{people.map(p=><article className="entity-card" key={p.id}><span className="entity-avatar">{((p.first_name||"")+(p.last_name||"")).slice(0,2).toUpperCase()||"?"}</span><div><h4>{[p.first_name,p.last_name].filter(Boolean).join(" ")||"Unnamed person"}</h4><p>{p.title||"Role not set"}{p.email?" · "+p.email:""}</p></div></article>)}</div>:<Empty text="No individual people have been added yet."/>}</section></>
}

function Documents({project,evidence,refresh}:{project:Project;evidence:Evidence[];refresh:()=>void}){
 const[open,setOpen]=useState(false);const[err,setErr]=useState("");
 async function add(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);const r=await createClient().from("evidence").insert({project_id:project.id,evidence_type:String(f.get("type")||"document"),title:String(f.get("title")||"")||null,source_system:String(f.get("source")||"manual"),source_url:String(f.get("url")||"")||null,occurred_at:f.get("date")?String(f.get("date"))+"T12:00:00":null,raw_text:String(f.get("notes")||"")||null});if(r.error){setErr(r.error.message);return}setOpen(false);refresh()}
 return <section className="panel page-panel"><div className="panel-title"><div><p className="eyebrow">EVIDENCE LIBRARY</p><h3>Documents & source evidence</h3></div><button className="primary-action" onClick={()=>setOpen(!open)}>＋ Add evidence</button></div><p className="panel-copy">Add source records, links and notes here. File upload and automated extraction are the next ingestion layer.</p>{open&&<form className="inline-form" onSubmit={add}><input name="title" required placeholder="Document / evidence title"/><select name="type"><option value="document">Document</option><option value="email">Email</option><option value="meeting_note">Meeting note</option><option value="change_order">Change order</option><option value="rfi">RFI</option><option value="invoice">Invoice</option><option value="photo">Photo / field observation</option><option value="schedule">Schedule</option></select><input name="source" placeholder="Source system"/><input name="date" type="date"/><input name="url" type="url" placeholder="Source URL (optional)"/><textarea name="notes" placeholder="Paste notes, summary or source text"/><button className="primary-action">Save evidence</button>{err&&<div className="form-message">{err}</div>}</form>}{evidence.length?<div className="evidence-list">{evidence.map(e=><article key={e.id}><span className="doc-icon">▤</span><div><span className="type">{e.evidence_type.replaceAll("_"," ")}</span><h4>{e.title||"Untitled evidence"}</h4><p>{e.source_system||"manual"} · {fmtDate(e.occurred_at||e.created_at)}</p>{e.raw_text&&<small>{e.raw_text.slice(0,180)}{e.raw_text.length>180?"…":""}</small>}</div>{e.source_url&&<a href={e.source_url} target="_blank" rel="noreferrer">Open ↗</a>}</article>)}</div>:<Empty text="No evidence has been added yet."/>}</section>
}

function Ask({project,companies,evidence,events}:{project:Project;companies:Company[];evidence:Evidence[];events:EventRow[]}){
 const[q,setQ]=useState("");const[a,setA]=useState("");
 function ask(){const x=q.toLowerCase();if(!q.trim())return;if(!evidence.length&&!events.length){setA("BuildPath does not have enough project evidence yet to answer that reliably. Add source documents or timeline events first.");return}if(x.includes("cost")||x.includes("budget")){const v=events.reduce((s,e)=>s+(Number(e.cost_impact)||0),0);setA("The original budget is "+money(project.original_budget)+". Linked events currently show "+money(v)+" in recorded cost impact. This is only based on evidence entered so far.");return}if(x.includes("who")||x.includes("company")){setA("I currently have "+companies.length+" companies connected: "+(companies.map(c=>c.name).join(", ")||"none yet")+".");return}setA("I found "+evidence.length+" evidence items and "+events.length+" project events. Full causal answers will come from the next AI evidence-analysis layer; for now BuildPath is preserving the source record rather than inventing missing history.")}
 return <section className="panel page-panel ask-large"><p className="eyebrow">ASK BUILDPATH</p><h2>Ask the project, not another report.</h2><p className="panel-copy">Answers are limited to evidence currently connected to {project.name}.</p><div className="ask-input"><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")ask()}} placeholder="Why is the project behind? What changed? Who made this decision?"/><button className="primary-action" onClick={ask}>Ask</button></div>{a&&<div className="answer-card"><span>✦</span><p>{a}</p></div>}</section>
}

function Costs({project,events}:{project:Project;events:EventRow[]}){const impacted=events.filter(e=>e.cost_impact!=null);const total=impacted.reduce((s,e)=>s+Number(e.cost_impact||0),0);return <section className="panel page-panel"><p className="eyebrow">COST INTELLIGENCE</p><h3>Budget & linked impacts</h3><div className="big-stat"><strong>{money(project.original_budget)}</strong><span>Original budget</span></div>{impacted.length?<div className="event-list">{impacted.map(e=><article key={e.id}><time>{fmtDate(e.start_at)}</time><div><h4>{e.title}</h4><p>{e.description}</p></div><div className="impact-stack"><span>{money(e.cost_impact)}</span></div></article>)}</div>:<Empty text="No cost impacts are linked to project events yet."/>}<div className="total-row"><span>Linked cost impact</span><strong>{money(total)}</strong></div></section>}
function Schedule({project,events}:{project:Project;events:EventRow[]}){const impacted=events.filter(e=>e.schedule_impact_days!=null);return <section className="panel page-panel"><p className="eyebrow">SCHEDULE</p><h3>Baseline and schedule impacts</h3><div className="schedule-baseline"><div><span>Baseline start</span><strong>{fmtDate(project.baseline_start)}</strong></div><div className="baseline-line"/><div><span>Target finish</span><strong>{fmtDate(project.target_finish)}</strong></div></div>{impacted.length?<div className="event-list">{impacted.map(e=><article key={e.id}><time>{fmtDate(e.start_at)}</time><div><h4>{e.title}</h4><p>{e.description}</p></div><div className="impact-stack"><span>{e.schedule_impact_days} days</span></div></article>)}</div>:<Empty text="No schedule impacts have been linked yet."/>}</section>}
function ProjectData({project,companies,refresh}:{project:Project;companies:Company[];refresh:()=>void}){
 const[msg,setMsg]=useState("");
 const[busy,setBusy]=useState(false);
 async function uploadHero(e:React.ChangeEvent<HTMLInputElement>){
  const file=e.target.files?.[0];if(!file)return;setBusy(true);setMsg("");
  const s=createClient();
  const ext=file.name.split(".").pop()||"jpg";
  const path=project.id+"/hero-"+crypto.randomUUID()+"."+ext.replace(/[^a-zA-Z0-9]/g,"");
  const up=await s.storage.from("project-assets").upload(path,file,{contentType:file.type||undefined,upsert:false});
  if(up.error){setMsg(up.error.message);setBusy(false);return}
  const save=await s.from("projects").update({hero_image_url:path,updated_at:new Date().toISOString()}).eq("id",project.id);
  if(save.error){setMsg(save.error.message);setBusy(false);return}
  setMsg("Custom project header image saved.");setBusy(false);refresh();e.target.value="";
 }
 async function clearHero(){
  const r=await createClient().from("projects").update({hero_image_url:null,updated_at:new Date().toISOString()}).eq("id",project.id);
  if(r.error){setMsg(r.error.message);return}setMsg("Using the automatic "+(project.project_type||"construction")+" header image.");refresh();
 }
 return <><section className="panel page-panel"><div className="panel-title"><div><p className="eyebrow">PROJECT APPEARANCE</p><h3>Header image</h3></div></div><p className="panel-copy">BuildPath automatically chooses imagery and messaging based on the project type. Upload a project-specific image here to override the automatic image.</p><div className="hero-control"><label className="secondary-action"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadHero} disabled={busy}/>{busy?"Uploading…":"Upload custom header"}</label>{project.hero_image_url&&<button className="text-button" onClick={clearHero}>Use automatic image instead</button>}</div>{msg&&<div className="form-message">{msg}</div>}</section><section className="panel page-panel"><p className="eyebrow">CANONICAL PROJECT RECORD</p><h3>Project data</h3><div className="data-table"><div><span>Name</span><strong>{project.name}</strong></div><div><span>Address</span><strong>{project.address||"Not set"}</strong></div><div><span>City / State</span><strong>{[project.city,project.state].filter(Boolean).join(", ")||"Not set"}</strong></div><div><span>Project type</span><strong>{project.project_type||"Not set"}</strong></div><div><span>Baseline start</span><strong>{fmtDate(project.baseline_start)}</strong></div><div><span>Target finish</span><strong>{fmtDate(project.target_finish)}</strong></div><div><span>Original budget</span><strong>{money(project.original_budget)}</strong></div><div><span>Status</span><strong>{project.status}</strong></div><div><span>Connected companies</span><strong>{companies.map(c=>c.name).join(", ")||"None"}</strong></div></div></section></>
}
function AdaptivePlaceholder({moduleKey,project,events,evidence}:{moduleKey:ModuleKey;project:Project;events:EventRow[];evidence:Evidence[]}){
 const item=buildWorkspace(project,[],[],0,evidence.length).find(m=>m.key===moduleKey);
 const label=item?.label||moduleKey.replaceAll("_"," ");
 const needle=moduleKey.replace("_orders","").replace("_reports","").replace("rfis","rfi");
 const matches=events.filter(e=>e.event_type.toLowerCase().includes(needle)||e.title.toLowerCase().includes(label.toLowerCase().replace(/s$/,""))).slice(0,20);
 return <section className="panel page-panel"><div className="panel-title"><div><p className="eyebrow">PROJECT WORKFLOW</p><h3>{label}</h3></div><span className="status-chip">{project.project_stage||"project"}</span></div><p className="panel-copy">BuildPath surfaced this section because it is relevant to this project or role. Matching project evidence will collect here as the project record grows.</p>{matches.length?<div className="event-list">{matches.map(e=><article key={e.id}><time>{fmtDate(e.start_at)}</time><div><span className="type">{e.event_type}</span><h4>{e.title}</h4><p>{e.description||"No description"}</p></div></article>)}</div>:<Empty text={"No "+label.toLowerCase()+" records have been connected yet."}/>}</section>
}
function Empty({text}:{text:string}){return <div className="empty-state"><span>＋</span><p>{text}</p></div>}

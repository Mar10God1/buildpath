"use client";
import { FormEvent,useEffect,useMemo,useState } from "react";
import { createClient } from "@/lib/supabase/client";

const workstreams=[
 ["financial_model","Financial model"],
 ["workforce_planning","Workforce planning"],
 ["dimensions","Dimensions & hierarchies"],
 ["integrations","Data integrations"],
 ["reporting","Management reporting"],
 ["uat_training","UAT & training"]
] as const;

type Milestone={id:string;workstream_key:string;title:string;description:string|null;target_date:string|null;completed_date:string|null;status:string;owner:string|null;sort_order:number};

export function WorkstreamMilestones({projectId}:{projectId:string}){
 const[rows,setRows]=useState<Milestone[]>([]),[open,setOpen]=useState<string|null>("financial_model"),[adding,setAdding]=useState<string|null>(null),[message,setMessage]=useState("");
 const[form,setForm]=useState({title:"",description:"",target_date:"",owner:"",status:"not_started"});
 async function load(){const r=await createClient().from("consultation_workstream_milestones").select("*").eq("project_id",projectId).order("sort_order").order("target_date");if(r.error)setMessage(r.error.message);else setRows((r.data||[]) as Milestone[])}
 useEffect(()=>{load()},[projectId]);
 const grouped=useMemo(()=>Object.fromEntries(workstreams.map(([k])=>[k,rows.filter(r=>r.workstream_key===k)])),[rows]);

 async function add(e:FormEvent){e.preventDefault();if(!adding)return;const s=createClient(),u=await s.auth.getUser();const r=await s.from("consultation_workstream_milestones").insert({project_id:projectId,workstream_key:adding,title:form.title,description:form.description||null,target_date:form.target_date||null,owner:form.owner||null,status:form.status,sort_order:(grouped[adding]?.length||0)+1,created_by:u.data.user?.id||null});if(r.error){setMessage(r.error.message);return}setAdding(null);setForm({title:"",description:"",target_date:"",owner:"",status:"not_started"});load()}
 async function update(id:string,patch:Partial<Milestone>){const r=await createClient().from("consultation_workstream_milestones").update({...patch,updated_at:new Date().toISOString()}).eq("id",id);if(r.error)setMessage(r.error.message);else load()}
 async function remove(id:string){if(!window.confirm("Delete this milestone?"))return;const r=await createClient().from("consultation_workstream_milestones").delete().eq("id",id);if(r.error)setMessage(r.error.message);else load()}
 function niceStatus(s:string){return s.replaceAll("_"," ")}

 return <section className="cp-card"><div className="cp-card-head"><div><p className="cp-kicker">WORKSTREAM MILESTONES</p><h2>What has to happen inside each workstream</h2><p className="cp-muted">Track the actual delivery path within Financial Model, Workforce Planning, Integrations, Reporting and UAT—not just whether the workstream is in scope.</p></div></div>{message&&<div className="cp-message">{message}</div>}
 <div className="cp-workstream-list">{workstreams.map(([key,label])=>{const ms=grouped[key]||[],complete=ms.filter(x=>x.status==="complete").length,blocked=ms.filter(x=>["blocked","at_risk"].includes(x.status)).length;return <article className="cp-workstream-card" key={key}><button className="cp-workstream-head" onClick={()=>setOpen(open===key?null:key)}><div><strong>{label}</strong><span>{ms.length?complete+" of "+ms.length+" complete":"No milestones yet"}</span></div><div>{blocked?<em>{blocked} needs attention</em>:null}<b>{open===key?"−":"+"}</b></div></button>{open===key&&<div className="cp-milestones">{ms.map(m=><div className="cp-milestone" key={m.id}><div className="cp-milestone-status"><select value={m.status} onChange={e=>update(m.id,{status:e.target.value,completed_date:e.target.value==="complete"?new Date().toISOString().slice(0,10):null})}><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="at_risk">At risk</option><option value="blocked">Blocked</option><option value="complete">Complete</option></select></div><div><strong>{m.title}</strong>{m.description&&<p>{m.description}</p>}<small>{m.owner?m.owner+" · ":""}{m.target_date?"Target "+new Date(m.target_date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"}):"No target date"}</small></div><button className="cp-link danger" onClick={()=>remove(m.id)}>Delete</button></div>)}{!ms.length&&<p className="cp-empty">No milestones have been added to this workstream.</p>}<button className="cp-secondary cp-add-milestone" onClick={()=>setAdding(key)}>＋ Add milestone</button></div>}</article>})}</div>
 {adding&&<form className="cp-milestone-form" onSubmit={add}><div className="cp-entry-head"><div><p className="cp-kicker">NEW MILESTONE</p><h3>{workstreams.find(x=>x[0]===adding)?.[1]}</h3></div><button type="button" onClick={()=>setAdding(null)}>×</button></div><div className="cp-entry-grid"><label className="wide">Milestone<input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Model design approved"/></label><label className="wide">Description<textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="What needs to be true for this milestone to be complete?"/></label><label>Target date<input type="date" value={form.target_date} onChange={e=>setForm({...form,target_date:e.target.value})}/></label><label>Owner<input value={form.owner} onChange={e=>setForm({...form,owner:e.target.value})} placeholder="Priya Shah"/></label><label>Status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="at_risk">At risk</option><option value="blocked">Blocked</option><option value="complete">Complete</option></select></label></div><div className="cp-entry-actions"><button type="button" className="cp-secondary" onClick={()=>setAdding(null)}>Cancel</button><button className="cp-primary">Add milestone</button></div></form>}
 </section>
}

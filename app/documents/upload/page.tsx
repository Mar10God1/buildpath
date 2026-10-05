"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AppSidebar } from "@/components/app-sidebar";

type Project={id:string;name:string};
type Candidate={id:string;candidate_type:string;candidate_key:string|null;proposed_value:Record<string,unknown>;confidence:number|null;status:string};
type Evidence={id:string;title:string|null;evidence_type:string;created_at:string};

export default function UploadExtractPage(){
 const[project,setProject]=useState<Project|null>(null);
 const[candidates,setCandidates]=useState<Candidate[]>([]);
 const[evidence,setEvidence]=useState<Evidence[]>([]);
 const[uploading,setUploading]=useState(false);
 const[msg,setMsg]=useState("");

 async function load(){
  const s=createClient();
  const auth=await s.auth.getUser();
  if(!auth.data.user){window.location.href="/login?next="+encodeURIComponent(window.location.pathname+window.location.search);return}
  const wanted=new URLSearchParams(window.location.search).get("project");
  const pr=await s.from("projects").select("id,name").order("created_at",{ascending:false});
  const list=(pr.data||[]) as Project[];
  const p=list.find(x=>x.id===wanted)||list[0];
  if(!p){window.location.href="/setup";return}
  setProject(p);
  const [cr,er]=await Promise.all([
   s.from("extraction_candidates").select("id,candidate_type,candidate_key,proposed_value,confidence,status").eq("project_id",p.id).eq("status","pending").order("created_at",{ascending:false}).limit(50),
   s.from("evidence").select("id,title,evidence_type,created_at").eq("project_id",p.id).order("created_at",{ascending:false}).limit(30)
  ]);
  if(!cr.error)setCandidates((cr.data||[]) as Candidate[]);
  if(!er.error)setEvidence((er.data||[]) as Evidence[]);
 }

 useEffect(()=>{void load()},[]);

 async function upload(e:React.ChangeEvent<HTMLInputElement>){
  const file=e.target.files?.[0];if(!file||!project)return;
  setUploading(true);setMsg("");
  const s=createClient();
  const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
  const path=project.id+"/"+crypto.randomUUID()+"-"+safe;
  const up=await s.storage.from("project-evidence").upload(path,file,{contentType:file.type||undefined,upsert:false});
  if(up.error){setMsg(up.error.message);setUploading(false);return}
  const session=await s.auth.getSession();
  const token=session.data.session?.access_token;
  if(!token){setMsg("Your session expired.");setUploading(false);return}
  const response=await fetch("/api/extract",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({projectId:project.id,storagePath:path,fileName:file.name,mimeType:file.type})});
  const body=await response.json() as {error?:string;candidateCount?:number};
  setUploading(false);
  if(!response.ok){setMsg(body.error||"Extraction failed");return}
  setMsg("Upload complete. BuildPath found "+String(body.candidateCount||0)+" proposed facts for review.");
  e.target.value="";
  await load();
 }

 async function review(candidate:Candidate,status:"accepted"|"rejected"){
  if(!project)return;
  const s=createClient();
  if(status==="accepted"&&candidate.candidate_type==="event"){
   const v=candidate.proposed_value;
   const title=typeof v.title==="string"?v.title:"Extracted event";
   const description=typeof v.description==="string"?v.description:null;
   const eventType=typeof v.event_type==="string"?v.event_type:"document";
   const rawDate=typeof v.date==="string"?v.date:null;
   let startAt:string|null=null;
   if(rawDate){const parsed=new Date(rawDate);if(!Number.isNaN(parsed.getTime()))startAt=parsed.toISOString()}
   await s.from("project_events").insert({project_id:project.id,event_type:eventType,title,description,start_at:startAt,date_precision:"day"});
  }
  await s.from("extraction_candidates").update({status,reviewed_at:new Date().toISOString()}).eq("id",candidate.id);
  await load();
 }

 function summary(c:Candidate){
  const v=c.proposed_value;
  for(const key of ["summary","description","email","amount_text","date"]){
   const val=v[key];if(typeof val==="string")return val;
  }
  return JSON.stringify(v);
 }

 if(!project)return <main className="setup-shell"><section className="setup-card">Loading…</section></main>;
 return <div className="shell"><AppSidebar projectId={project.id} active="Upload & Extract"/><main className="main standalone-page">
  <header className="topbar"><div><p className="eyebrow">UPLOAD & EXTRACT</p><h1>{project.name}</h1><p>Turn project files into connected evidence and proposed facts.</p></div><a className="secondary-action" href={"/?project="+project.id}>← Back to project</a></header>
  {msg&&<div className="form-message">{msg}</div>}
  <section className="panel page-panel">
   <p className="eyebrow">PROJECT FILES</p><h3>Drop in the project record</h3>
   <p className="panel-copy">PDF, TXT, CSV, JSON and EML files are automatically parsed. Other supported files are securely stored and queued for review.</p>
   <label className="upload-zone"><input type="file" onChange={upload} disabled={uploading}/><span>{uploading?"Uploading & extracting…":"Choose a file to upload"}</span><small>Schedules, meeting notes, RFIs, change orders, email exports, invoices and project documents</small></label>
  </section>
  <section className="panel page-panel"><div className="panel-title"><div><p className="eyebrow">EXTRACTION REVIEW</p><h3>Proposed facts</h3></div><span className="review-count">{candidates.length} pending</span></div>
   {candidates.length?<div className="candidate-list">{candidates.map(c=><article key={c.id}><div><span className="type">{c.candidate_type}</span><h4>{typeof c.proposed_value.title==="string"?c.proposed_value.title:(c.candidate_key||"Extracted fact")}</h4><p>{summary(c)}</p><small>{c.confidence!==null?Math.round(c.confidence*100)+"% confidence":""}</small></div><div className="review-actions"><button onClick={()=>void review(c,"accepted")}>Accept</button><button onClick={()=>void review(c,"rejected")}>Reject</button></div></article>)}</div>:<div className="empty-state"><p>No extracted facts are waiting for review.</p></div>}
  </section>
  <section className="panel page-panel"><p className="eyebrow">RECENT EVIDENCE</p><h3>Uploaded project record</h3>{evidence.length?<div className="evidence-list">{evidence.map(e=><article key={e.id}><span className="doc-icon">▤</span><div><span className="type">{e.evidence_type.replaceAll("_"," ")}</span><h4>{e.title||"Untitled evidence"}</h4><p>{new Date(e.created_at).toLocaleString()}</p></div></article>)}</div>:<div className="empty-state"><p>No uploaded evidence yet.</p></div>}</section>
 </main>
}

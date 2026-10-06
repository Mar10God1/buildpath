"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AppSidebar } from "@/components/app-sidebar";
import { getProjectVisual } from "@/lib/project-visuals";

type Project={id:string;organization_id:string;name:string;project_type:string|null;hero_image_url:string|null};
type Candidate={id:string;candidate_type:string;candidate_key:string|null;proposed_value:Record<string,unknown>;confidence:number|null;status:string};
type Evidence={id:string;title:string|null;evidence_type:string;created_at:string};

export default function UploadExtractPage(){
 const[project,setProject]=useState<Project|null>(null);const[heroImage,setHeroImage]=useState("");
 const[candidates,setCandidates]=useState<Candidate[]>([]);
 const[evidence,setEvidence]=useState<Evidence[]>([]);
 const[uploading,setUploading]=useState(false);
 const[msg,setMsg]=useState("");

 async function load(){
  const s=createClient();
  const auth=await s.auth.getUser();
  if(!auth.data.user){window.location.href="/login?next="+encodeURIComponent(window.location.pathname+window.location.search);return}
  const wanted=new URLSearchParams(window.location.search).get("project");
  const pr=await s.from("projects").select("id,organization_id,name,project_type,hero_image_url").order("created_at",{ascending:false});
  const list=(pr.data||[]) as Project[];
  const p=list.find(x=>x.id===wanted)||list[0];
  if(!p){window.location.href="/setup";return}
  setProject(p);if(p.hero_image_url){const signed=await s.storage.from("project-assets").createSignedUrl(p.hero_image_url,3600);setHeroImage(signed.data?.signedUrl||getProjectVisual(p.project_type).image)}else setHeroImage(getProjectVisual(p.project_type).image);
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
   const costImpact=typeof v.cost_impact==="number"?v.cost_impact:null;
   const scheduleDays=typeof v.schedule_impact_days==="number"?Math.round(v.schedule_impact_days):null;
   let startAt:string|null=null;
   if(rawDate){const parsed=new Date(rawDate);if(!Number.isNaN(parsed.getTime()))startAt=parsed.toISOString()}
   await s.from("project_events").insert({project_id:project.id,event_type:eventType,title,description,start_at:startAt,date_precision:"day",cost_impact:costImpact,schedule_impact_days:scheduleDays,confidence:candidate.confidence});
  }
  if(status==="accepted"&&candidate.candidate_type==="commitment"){
   const v=candidate.proposed_value;
   const title=typeof v.title==="string"?v.title:"Field commitment";
   const description=typeof v.description==="string"?v.description:null;
   const rawDate=typeof v.date==="string"?v.date:null;
   let startAt:string|null=null;
   if(rawDate){const parsed=new Date(rawDate);if(!Number.isNaN(parsed.getTime()))startAt=parsed.toISOString()}
   await s.from("project_events").insert({project_id:project.id,event_type:"commitment",title,description,start_at:startAt,date_precision:"day",confidence:candidate.confidence});
  }
  if(status==="accepted"&&candidate.candidate_type==="company"){
   const v=candidate.proposed_value;
   const name=typeof v.name==="string"?v.name.trim():"";
   if(name){
    const existing=await s.from("companies").select("id").eq("organization_id",project.organization_id).ilike("name",name).limit(1);
    if(!existing.data?.length)await s.from("companies").insert({organization_id:project.organization_id,name,company_type:"vendor"});
   }
  }
  if(status==="accepted"&&candidate.candidate_type==="person"){
   const v=candidate.proposed_value;
   const email=typeof v.email==="string"?v.email.trim().toLowerCase():"";
   if(email){
    const existing=await s.from("people").select("id").eq("organization_id",project.organization_id).ilike("email",email).limit(1);
    if(!existing.data?.length)await s.from("people").insert({organization_id:project.organization_id,email});
   }
  }
  if(status==="accepted"&&candidate.candidate_type==="requirement"){
   const v=candidate.proposed_value;
   const key=typeof v.requirement_key==="string"?v.requirement_key:(candidate.candidate_key||"document_requirement");
   const label=typeof v.label==="string"?v.label:key.replaceAll("_"," ");
   await s.from("project_requirements").upsert({project_id:project.id,requirement_key:key,label,enabled:true,source:"document",notes:"Detected from uploaded project evidence",updated_at:new Date().toISOString()},{onConflict:"project_id,requirement_key"});
  }
  await s.from("extraction_candidates").update({status,reviewed_at:new Date().toISOString()}).eq("id",candidate.id);
  await load();
 }

 function summary(c:Candidate){
  const v=c.proposed_value;
  for(const key of ["summary","description","email","amount_text","vendor_name","date"]){
   const val=v[key];if(typeof val==="string")return val;
  }
  if(typeof v.amount==="number")return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(v.amount);
  return JSON.stringify(v);
 }

 if(!project)return <main className="setup-shell"><section className="setup-card">Loading…</section></main>;
 const visual=getProjectVisual(project.project_type);
 return <div className="shell"><AppSidebar projectId={project.id} active="Upload & Extract"/><main className="main standalone-page">
  <div className="global-topbar"><div className="global-search">⌕ <span>Search projects, documents, subs, or ask anything...</span></div><div className="global-user"><span className="notify-dot">●</span><span className="user-avatar">MG</span><span><strong>BuildPath</strong><small>Project workspace</small></span></div></div>
  <header className="topbar compact-project-hero" style={{backgroundImage:"linear-gradient(90deg,rgba(10,11,12,.88),rgba(10,11,12,.54) 55%,rgba(10,11,12,.35)),url("+JSON.stringify(heroImage||visual.image)+")"}}><div><p className="eyebrow">{visual.eyebrow}</p><h1>Upload & Extract</h1><p>Turn {project.name} documents into connected project intelligence.</p></div><a className="secondary-action" href={"/?project="+project.id}>View Project →</a></header>
  <div className="ingestion-steps"><div className="active"><b>1</b><span><strong>Upload</strong><small>Add project documents</small></span></div><div className={uploading?"active":""}><b>2</b><span><strong>Extract</strong><small>AI analyzes content</small></span></div><div className={candidates.length?"active":""}><b>3</b><span><strong>Review</strong><small>Verify and organize</small></span></div><div><b>4</b><span><strong>Complete</strong><small>Add to project records</small></span></div></div>
  {msg&&<div className="form-message">{msg}</div>}

  <div className="upload-main-grid">
   <section className="panel upload-main-card"><h3>⇧ &nbsp; Upload Project Documents</h3><p className="panel-copy">Drag and drop files below or click to browse. BuildPath will extract key information from your documents.</p><label className="upload-zone large-drop"><input type="file" onChange={upload} disabled={uploading}/><span className="upload-cloud">☁</span><strong>{uploading?"Uploading & extracting…":"Drag and drop your files here"}</strong><small>or click to browse files</small><p>Upload drawings, RFIs, change orders, schedules, meeting notes, emails, PDFs and more.</p><em>Choose Files</em><div className="file-kind-row"><span>PDF Drawings</span><span>RFIs</span><span>Change Orders</span><span>Schedules</span><span>Meeting Notes</span><span>Emails</span></div></label></section>
   <section className="panel supported-types"><h3>▤ &nbsp; Supported Document Types</h3><p>BuildPath can extract information from:</p><div><b className="pdf-kind">PDF</b><span><strong>PDF files</strong><small>Drawings, specs, submittals, RFIs, change orders</small></span></div><div><b className="xls-kind">X</b><span><strong>Excel files</strong><small>Schedules, cost reports, pay applications</small></span></div><div><b className="doc-kind">W</b><span><strong>Word / text documents</strong><small>Meeting notes, correspondence, reports</small></span></div><div><b className="mail-kind">✉</b><span><strong>Email files</strong><small>Project communications, directives, approvals</small></span></div><div><b className="img-kind">▧</b><span><strong>Image files</strong><small>Scanned documents and field images</small></span></div><footer>Files are stored securely and added to your project evidence.</footer></section>
  </div>

  <div className="extraction-grid">
   <section className="panel extraction-results"><div className="panel-title"><div><h3><span className="spark">✦</span> Extraction Results</h3><p className="panel-copy">Review and confirm proposed information before it becomes part of the project record.</p></div><span className="review-count">{candidates.length} pending</span></div>
    <div className="extract-tabs"><button className="active">All Items ({candidates.length})</button><button>Timeline Events ({candidates.filter(c=>c.candidate_type==="event").length})</button><button>Cost Items ({candidates.filter(c=>c.candidate_type==="cost").length})</button><button>People & Companies ({candidates.filter(c=>["person","company"].includes(c.candidate_type)).length})</button></div>
    <div className="extract-table"><div className="extract-head"><span>Type</span><span>Extracted Information</span><span>Confidence</span><span>Actions</span></div>{candidates.length?candidates.map(x=><div className="extract-row" key={x.id}><span><b className="extract-icon">{x.candidate_type.slice(0,1).toUpperCase()}</b>{x.candidate_type.replaceAll("_"," ")}</span><div><strong>{typeof x.proposed_value.title==="string"?x.proposed_value.title:(x.candidate_key||"Extracted fact")}</strong><small>{summary(x)}</small></div><span className="confidence"><i/> {x.confidence!==null?Math.round(x.confidence*100)+"%":"—"}</span><div className="review-actions"><button onClick={()=>void review(x,"accepted")}>✓ Accept</button><button onClick={()=>void review(x,"rejected")}>×</button></div></div>):<div className="empty-state"><p>No extracted facts are waiting for review.</p></div>}</div>
   </section>
   <section className="panel recent-upload-card"><div className="panel-title"><h3>◷ &nbsp; Recent Uploads & Evidence</h3><span className="text-button">View All →</span></div><div className="recent-file-list">{evidence.map(e=><div key={e.id}><span className="file-badge">PDF</span><p><strong>{e.title||"Untitled evidence"}</strong><small>{new Date(e.created_at).toLocaleString()}</small></p><span className="status-pill approved">Completed</span></div>)}</div></section>
  </div>
 </main></div>
}
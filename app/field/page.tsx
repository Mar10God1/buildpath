"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BuildPathLogo } from "@/components/buildpath-logo";

type Project={id:string;name:string;city:string|null;state:string|null};
type Capture={id:string;submission_type:string;title:string|null;notes:string|null;media_type:string|null;amount:number|null;vendor_name:string|null;processing_status:string;created_at:string};

const types=[
 {key:"progress",icon:"◫",label:"Progress Photo",hint:"Document work in place"},
 {key:"receipt",icon:"$",label:"Receipt",hint:"Capture a field purchase"},
 {key:"invoice",icon:"▤",label:"Invoice",hint:"Capture billing evidence"},
 {key:"incident",icon:"!",label:"Incident",hint:"Describe what happened"},
 {key:"safety",icon:"⚠",label:"Safety",hint:"Record an observation"},
 {key:"delivery",icon:"⇩",label:"Delivery",hint:"Document material delivery"},
 {key:"voice_note",icon:"●",label:"Voice Note",hint:"Talk instead of typing"},
 {key:"other",icon:"＋",label:"Other",hint:"Capture anything useful"}
] as const;

export default function FieldCapturePage(){
 const[project,setProject]=useState<Project|null>(null);
 const[captures,setCaptures]=useState<Capture[]>([]);
 const[type,setType]=useState<string>("progress");
 const[file,setFile]=useState<File|null>(null);
 const[notes,setNotes]=useState("");
 const[title,setTitle]=useState("");
 const[amount,setAmount]=useState("");
 const[vendor,setVendor]=useState("");
 const[msg,setMsg]=useState("");
 const[busy,setBusy]=useState(false);
 const[recording,setRecording]=useState(false);
 const recorder=useRef<MediaRecorder|null>(null);
 const chunks=useRef<Blob[]>([]);

 async function load(){
  const s=createClient();const auth=await s.auth.getUser();
  if(!auth.data.user){window.location.href="/login?next="+encodeURIComponent(window.location.pathname+window.location.search);return}
  const wanted=new URLSearchParams(window.location.search).get("project");
  const pr=await s.from("projects").select("id,name,city,state").order("created_at",{ascending:false});
  const list=(pr.data||[]) as Project[];const p=list.find(x=>x.id===wanted)||list[0];
  if(!p){window.location.href="/setup";return}setProject(p);
  const cr=await s.from("field_submissions").select("id,submission_type,title,notes,media_type,amount,vendor_name,processing_status,created_at").eq("project_id",p.id).order("created_at",{ascending:false}).limit(8);
  if(!cr.error)setCaptures((cr.data||[]) as Capture[]);
 }
 useEffect(()=>{void load()},[]);

 async function startRecording(){
  try{
   const stream=await navigator.mediaDevices.getUserMedia({audio:true});
   const mr=new MediaRecorder(stream);chunks.current=[];
   mr.ondataavailable=e=>{if(e.data.size)chunks.current.push(e.data)};
   mr.onstop=()=>{
    const blob=new Blob(chunks.current,{type:mr.mimeType||"audio/webm"});
    setFile(new File([blob],"field-voice-"+Date.now()+".webm",{type:blob.type}));
    stream.getTracks().forEach(t=>t.stop());
   };
   recorder.current=mr;mr.start();setRecording(true);setType("voice_note");setMsg("");
  }catch{setMsg("Microphone access was not available. You can still attach an audio file or type the note.");}
 }
 function stopRecording(){recorder.current?.stop();setRecording(false)}

 async function submit(){
  if(!project)return;
  if(!file&&!notes.trim()&&!title.trim()){setMsg("Add a photo, file, voice recording, or note first.");return}
  setBusy(true);setMsg("");const s=createClient();const auth=await s.auth.getUser();const user=auth.data.user;
  if(!user){window.location.href="/login";return}
  let storagePath:string|null=null;
  if(file){
   const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
   storagePath=project.id+"/"+crypto.randomUUID()+"-"+safe;
   const up=await s.storage.from("field-capture").upload(storagePath,file,{contentType:file.type||undefined});
   if(up.error){setMsg(up.error.message);setBusy(false);return}
  }
  const evidenceType=type==="invoice"||type==="receipt"?"invoice":type==="progress"||type==="safety"||type==="delivery"?"photo":type==="incident"||type==="voice_note"?"field":"document";
  const ev=await s.from("evidence").insert({
   project_id:project.id,evidence_type:evidenceType,title:title.trim()||types.find(x=>x.key===type)?.label||"Field capture",
   source_system:"field_capture",storage_path:storagePath,occurred_at:new Date().toISOString(),raw_text:notes.trim()||null,
   metadata:{capture_type:type,original_file:file?.name||null},created_by:user.id
  }).select("id").single();
  if(ev.error){setMsg(ev.error.message);setBusy(false);return}
  const needsProcessing=!!file&&(file.type.startsWith("audio/")||["receipt","invoice"].includes(type));
  const r=await s.from("field_submissions").insert({
   project_id:project.id,submitted_by:user.id,submission_type:type,title:title.trim()||null,notes:notes.trim()||null,
   media_type:file?.type||null,storage_path:storagePath,amount:amount?Number(amount.replace(/[^0-9.-]/g,"")):null,
   vendor_name:vendor.trim()||null,processing_status:needsProcessing?"queued":"complete",evidence_id:ev.data.id,
   metadata:{file_name:file?.name||null}
  });
  if(r.error){setMsg(r.error.message);setBusy(false);return}
  setTitle("");setNotes("");setAmount("");setVendor("");setFile(null);setMsg(needsProcessing?"Captured. Media is queued for extraction/transcription review.":"Captured and added to the project record.");setBusy(false);await load();
 }

 if(!project)return <main className="field-shell"><div className="field-loading">Loading field capture…</div></main>;
 const selected=types.find(x=>x.key===type)||types[0];
 return <main className="field-shell">
  <header className="field-top"><BuildPathLogo/><a href={"/?project="+project.id}>Project ↗</a></header>
  <section className="field-project"><div><small>FIELD CAPTURE</small><h1>{project.name}</h1><p>{[project.city,project.state].filter(Boolean).join(", ")||"Project site"}</p></div><span className="live-pill">● Connected</span></section>

  <section className="capture-card">
   <div className="capture-intro"><h2>What are you capturing?</h2><p>Get useful field intel into BuildPath in a few seconds.</p></div>
   <div className="capture-types">{types.map(t=><button key={t.key} className={type===t.key?"active":""} onClick={()=>{setType(t.key);setMsg("")}}><b>{t.icon}</b><span><strong>{t.label}</strong><small>{t.hint}</small></span></button>)}</div>

   <div className="capture-editor">
    <div className="capture-editor-head"><span className="capture-big-icon">{selected.icon}</span><div><h3>{selected.label}</h3><p>{selected.hint}</p></div></div>
    <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Short title (optional)"/>
    {(type==="receipt"||type==="invoice")&&<div className="capture-two"><input value={vendor} onChange={e=>setVendor(e.target.value)} placeholder="Vendor / merchant"/><input value={amount} onChange={e=>setAmount(e.target.value)} inputMode="decimal" placeholder="Amount"/></div>}
    <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder={type==="incident"?"Describe what happened, who was involved, and any immediate action taken…":"Add a quick note or description…"} />

    <div className="capture-media">
     <label className="capture-upload"><input type="file" accept={type==="voice_note"?"audio/*":type==="receipt"||type==="invoice"||type==="progress"||type==="safety"||type==="delivery"?"image/*,application/pdf":"image/*,audio/*,application/pdf"} capture={type==="voice_note"?undefined:"environment"} onChange={e=>setFile(e.target.files?.[0]||null)}/><b>＋</b><span>{file?file.name:(type==="voice_note"?"Attach audio":"Take photo or choose file")}</span></label>
     <button className={recording?"record-button recording":"record-button"} onClick={recording?stopRecording:startRecording}>{recording?"■ Stop recording":"● Record voice note"}</button>
    </div>
    {file&&<div className="file-ready"><span>✓</span><p><strong>Ready to upload</strong><small>{file.name} · {Math.max(1,Math.round(file.size/1024))} KB</small></p><button onClick={()=>setFile(null)}>×</button></div>}
    {msg&&<div className="form-message">{msg}</div>}
    <button className="field-submit" disabled={busy||recording} onClick={submit}>{busy?"Saving…":"Add to BuildPath →"}</button>
   </div>
  </section>

  <section className="recent-captures"><div className="field-section-title"><h2>Recent field intel</h2><small>Added to the same project evidence record</small></div>{captures.length?<div>{captures.map(c=><article key={c.id}><span>{types.find(x=>x.key===c.submission_type)?.icon||"＋"}</span><p><strong>{c.title||c.submission_type.replaceAll("_"," ")}</strong><small>{new Date(c.created_at).toLocaleString()} {c.vendor_name?"· "+c.vendor_name:""}</small></p><em className={"capture-status "+c.processing_status}>{c.processing_status.replaceAll("_"," ")}</em></article>)}</div>:<p className="field-empty">No field captures yet.</p>}</section>
 </main>
}

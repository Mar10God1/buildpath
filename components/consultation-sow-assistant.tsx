"use client";
import { FormEvent,useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function ConsultationSowAssistant({projectId,onDone}:{projectId:string;onDone?:()=>void}){
 const[title,setTitle]=useState("Original SOW / Statement of Work"),[text,setText]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 async function analyze(e:FormEvent){e.preventDefault();if(text.trim().length<80){setMessage("Paste enough of the SOW to identify scope and deliverables.");return}setBusy(true);setMessage("");
  const s=createClient(),auth=await s.auth.getUser();const user=auth.data.user;if(!user){setMessage("Please sign in again.");setBusy(false);return}
  const dupe=await s.from("evidence").select("id").eq("project_id",projectId).eq("evidence_type","sow").eq("raw_text",text.trim()).maybeSingle();
  if(dupe.data){setMessage("This exact SOW text is already in the engagement.");setBusy(false);return}
  const ev=await s.from("evidence").insert({project_id:projectId,evidence_type:"sow",title:title.trim()||"Original SOW",source_system:"baseline_import",raw_text:text.trim(),occurred_at:new Date().toISOString(),created_by:user.id}).select("id").single();
  if(ev.error){setMessage(ev.error.message);setBusy(false);return}
  const proc=await s.functions.invoke("consultation-ingest",{body:{evidence_id:ev.data.id,mode:"sow"}});
  setBusy(false);
  if(proc.error){setMessage("SOW saved as evidence, but analysis failed: "+proc.error.message);return}
  const n=Number(proc.data?.candidate_count||0),d=Number(proc.data?.deduplicated_count||0);
  setMessage("SOW analyzed. "+n+" suggestion"+(n===1?" is":"s are")+" waiting in Review Inbox"+(d?"; "+d+" duplicate"+(d===1?" was":"s were")+" suppressed.":"."));
  setText("");onDone?.();
 }
 return <section className="cp-card cp-sow-assistant"><div className="cp-card-head"><div><p className="cp-kicker">SOW ASSISTANT</p><h2>Turn the original agreement into a starting baseline</h2><p className="cp-muted">Paste the SOW or scope section. ConsultationPath will recommend baseline workstreams and milestones for review. Nothing is added until you confirm it.</p></div></div>
  <form onSubmit={analyze}><label>Evidence title<input value={title} onChange={e=>setTitle(e.target.value)}/></label><label>SOW / scope text<textarea required value={text} onChange={e=>setText(e.target.value)} placeholder="Paste scope, deliverables, milestones, target dates, assumptions and responsibilities here…"/></label>{message&&<div className="cp-message">{message}</div>}<div className="cp-entry-actions"><button className="cp-primary" disabled={busy}>{busy?"Analyzing…":"Analyze SOW →"}</button></div></form>
 </section>
}
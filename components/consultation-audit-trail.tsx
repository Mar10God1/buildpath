"use client";
import { useEffect,useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AuditRow={
 id:string;table_name:string;record_id:string|null;action:string;actor_user_id:string|null;
 old_data:any;new_data:any;created_at:string;
};

const LABELS:Record<string,string>={
 projects:"Engagement",
 project_events:"Change / decision",
 evidence:"Evidence",
 extraction_candidates:"Review candidate",
 consultation_email_rules:"Email rule",
 consultation_workstream_milestones:"Milestone"
};

function summary(row:AuditRow){
 const data=row.new_data||row.old_data||{};
 return data.title||data.name||data.requirement_key||data.evidence_type||row.record_id||"Record";
}

export function ConsultationAuditTrail({projectId}:{projectId:string}){
 const[rows,setRows]=useState<AuditRow[]>([]),[message,setMessage]=useState("");
 async function load(){
  const r=await createClient().from("consultation_audit_log")
   .select("id,table_name,record_id,action,actor_user_id,old_data,new_data,created_at")
   .eq("project_id",projectId).order("created_at",{ascending:false}).limit(200);
  if(r.error)setMessage(r.error.message);else setRows((r.data||[]) as AuditRow[]);
 }
 useEffect(()=>{load()},[projectId]);
 return <section className="cp-card">
  <div className="cp-card-head"><div><p className="cp-kicker">AUDIT TRAIL</p><h2>Who changed what, and when</h2><p className="cp-muted">ConsultationPath records material inserts, edits and deletions so the engagement history remains defensible.</p></div><button className="cp-secondary" onClick={load}>Refresh</button></div>
  {message&&<div className="cp-message">{message}</div>}
  <div className="cp-audit-list">
   {rows.map(r=><article key={r.id}>
    <div><span className={"cp-audit-action "+r.action}>{r.action}</span><strong>{LABELS[r.table_name]||r.table_name}: {summary(r)}</strong><small>{new Date(r.created_at).toLocaleString()} · {r.actor_user_id?"Authenticated user":"System"}</small></div>
    <details><summary>Details</summary><pre>{JSON.stringify({before:r.old_data,after:r.new_data},null,2)}</pre></details>
   </article>)}
   {!rows.length&&<p className="cp-empty">No audited changes have been recorded for this engagement yet.</p>}
  </div>
 </section>
}
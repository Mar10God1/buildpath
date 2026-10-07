"use client";
import { useEffect,useMemo,useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Counts={scope:number;milestones:number;evidence:number;meetings:number;reviewed:number;emailRules:number};

export function ConsultationActivation({projectId,onNavigate}:{projectId:string;onNavigate:(tab:string)=>void}){
 const[counts,setCounts]=useState<Counts>({scope:0,milestones:0,evidence:0,meetings:0,reviewed:0,emailRules:0});
 useEffect(()=>{(async()=>{const s=createClient();const [scope,milestones,evidence,meetings,reviewed,emailRules]=await Promise.all([
  s.from("project_requirements").select("id",{count:"exact",head:true}).eq("project_id",projectId).like("requirement_key","cp_scope_%"),
  s.from("consultation_workstream_milestones").select("id",{count:"exact",head:true}).eq("project_id",projectId),
  s.from("evidence").select("id",{count:"exact",head:true}).eq("project_id",projectId),
  s.from("evidence").select("id",{count:"exact",head:true}).eq("project_id",projectId).eq("evidence_type","meeting_transcript"),
  s.from("extraction_candidates").select("id",{count:"exact",head:true}).eq("project_id",projectId).in("status",["accepted","rejected","merged"]),
  s.from("consultation_email_rules").select("id",{count:"exact",head:true}).eq("project_id",projectId)
 ]);setCounts({scope:scope.count||0,milestones:milestones.count||0,evidence:evidence.count||0,meetings:meetings.count||0,reviewed:reviewed.count||0,emailRules:emailRules.count||0})})()},[projectId]);
 const steps=useMemo(()=>[
  {label:"Confirm original scope",done:counts.scope>0,tab:"Engagement Data",detail:"Name your workstreams and mark each as original scope, added later, or out of scope."},
  {label:"Add the first milestones",done:counts.milestones>0,tab:"Workstreams",detail:"Give each workstream concrete delivery checkpoints and target dates."},
  {label:"Add source evidence",done:counts.evidence>0,tab:"Evidence",detail:"Upload the SOW, requirements, approvals, or other project evidence."},
  {label:"Capture a client conversation",done:counts.meetings>0,tab:"Meetings",detail:"Paste, upload, or capture a meeting transcript and let ConsultationPath suggest changes."},
  {label:"Review an AI suggestion",done:counts.reviewed>0,tab:"Review Inbox",detail:"Confirm or reject a recommendation before it becomes part of the engagement history."},
  {label:"Create an email rule",done:counts.emailRules>0,tab:"Email",detail:"Define which client email should flow into this engagement when mailbox connections are enabled.",optional:true}
 ],[counts]);
 const required=steps.filter(x=>!x.optional),done=required.filter(x=>x.done).length,pct=Math.round(done/required.length*100);
 return <section className="cp-card cp-activation">
  <div className="cp-card-head"><div><p className="cp-kicker">GETTING STARTED</p><h2>Get ConsultationPath useful without a setup call</h2><p className="cp-muted">Complete these steps and the engagement will have enough context to start building an evidence-backed project memory.</p></div><div className="cp-progress"><strong>{pct}%</strong><span>{done}/{required.length} core steps</span></div></div>
  <div className="cp-progress-bar"><i style={{width:pct+"%"}}/></div>
  <div className="cp-activation-list">{steps.map((s,i)=><button key={s.label} className={s.done?"done":""} onClick={()=>onNavigate(s.tab)}><span>{s.done?"✓":i+1}</span><div><strong>{s.label}{s.optional?" (optional)":""}</strong><small>{s.detail}</small></div><b>→</b></button>)}</div>
 </section>
}
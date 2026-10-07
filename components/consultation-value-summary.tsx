"use client";
import { useEffect,useMemo,useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Event={event_type:string;cost_impact:number|null;schedule_impact_days:number|null};
export function ConsultationValueSummary({projectId,events,evidenceCount}:{projectId:string;events:Event[];evidenceCount:number}){
 const[reviewed,setReviewed]=useState(0),[addedMilestones,setAddedMilestones]=useState(0),[minutes,setMinutes]=useState(5);
 useEffect(()=>{const saved=Number(localStorage.getItem("cp_minutes_per_item")||5);if(saved>0)setMinutes(saved);const s=createClient();Promise.all([
  s.from("extraction_candidates").select("id",{count:"exact",head:true}).eq("project_id",projectId).in("status",["accepted","rejected","merged"]),
  s.from("consultation_workstream_milestones").select("id",{count:"exact",head:true}).eq("project_id",projectId).eq("scope_origin","added")
 ]).then(([r,m])=>{setReviewed(r.count||0);setAddedMilestones(m.count||0)})},[projectId]);
 const changes=events.filter(e=>e.event_type==="change"),fee=changes.reduce((n,e)=>n+(Number(e.cost_impact)||0),0),unpriced=changes.filter(e=>(Number(e.cost_impact)||0)===0).length,days=events.filter(e=>e.event_type!=="baseline").reduce((n,e)=>n+(Number(e.schedule_impact_days)||0),0);
 const estMinutes=useMemo(()=>(reviewed+evidenceCount)*minutes,[reviewed,evidenceCount,minutes]);
 const setAssumption=(v:number)=>{const n=Math.max(1,Math.min(30,v||1));setMinutes(n);localStorage.setItem("cp_minutes_per_item",String(n))};
 const money=new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(fee);
 return <section className="cp-card cp-value-summary"><div className="cp-card-head"><div><p className="cp-kicker">ENGAGEMENT VALUE</p><h2>What ConsultationPath has made visible</h2><p className="cp-muted">These are based on recorded engagement facts. Time avoided is explicitly an estimate using your assumption below.</p></div></div>
  <div className="cp-value-grid"><div><span>Added scope identified</span><strong>{changes.length}</strong></div><div><span>Tracked added fees</span><strong>{money}</strong></div><div className={unpriced?"attention":""}><span>Potential unbilled items</span><strong>{unpriced}</strong><small>Scope changes with no fee recorded</small></div><div><span>Added milestones</span><strong>{addedMilestones}</strong></div><div><span>Schedule movement explained</span><strong>{days} days</strong></div><div><span>Evidence captured</span><strong>{evidenceCount}</strong></div><div><span>Suggestions reviewed</span><strong>{reviewed}</strong></div><div><span>Est. reconstruction time avoided</span><strong>{Math.round(estMinutes/6)/10} hrs</strong><small><input type="number" min="1" max="30" value={minutes} onChange={e=>setAssumption(Number(e.target.value))}/> min per captured/reviewed item</small></div></div>
 </section>
}
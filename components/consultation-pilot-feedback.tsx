"use client";
import { FormEvent,useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function ConsultationPilotFeedback({projectId,organizationId}:{projectId:string;organizationId:string}){
 const[form,setForm]=useState({usefulness:"",ease:"",would_pay:"",price:"99",valuable:"",missing:"",comments:""}),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 const u=(k:string,v:string)=>setForm(f=>({...f,[k]:v}));
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setMessage("");const s=createClient(),auth=await s.auth.getUser();const user=auth.data.user;if(!user){setMessage("Please sign in again.");setBusy(false);return}
  const r=await s.from("consultation_pilot_feedback").insert({organization_id:organizationId,project_id:projectId,created_by:user.id,usefulness:form.usefulness?Number(form.usefulness):null,ease_of_use:form.ease?Number(form.ease):null,would_pay:form.would_pay||null,price_point:form.price?Number(form.price):null,most_valuable:form.valuable||null,missing:form.missing||null,comments:form.comments||null});
  setBusy(false);if(r.error){setMessage(r.error.message);return}setMessage("Thank you — your feedback was saved.");setForm({usefulness:"",ease:"",would_pay:"",price:"99",valuable:"",missing:"",comments:""})}
 return <section className="cp-card cp-feedback"><p className="cp-kicker">PILOT FEEDBACK</p><h2>Help shape ConsultationPath</h2><p className="cp-muted">This feedback goes directly into the product record. No meeting is required.</p>
  <form className="cp-entry-grid" onSubmit={submit}>
   <label>How useful is this?<select required value={form.usefulness} onChange={e=>u("usefulness",e.target.value)}><option value="">Choose 1–5</option>{[1,2,3,4,5].map(x=><option key={x} value={x}>{x} — {x===1?"Not useful":x===5?"Extremely useful":""}</option>)}</select></label>
   <label>How easy is it to use?<select required value={form.ease} onChange={e=>u("ease",e.target.value)}><option value="">Choose 1–5</option>{[1,2,3,4,5].map(x=><option key={x} value={x}>{x} — {x===1?"Difficult":x===5?"Very easy":""}</option>)}</select></label>
   <label>Would you pay for it?<select required value={form.would_pay} onChange={e=>u("would_pay",e.target.value)}><option value="">Choose</option><option value="yes">Yes</option><option value="maybe">Maybe</option><option value="no">No</option></select></label>
   <label>Reasonable monthly price<input type="number" min="0" step="1" value={form.price} onChange={e=>u("price",e.target.value)} placeholder="99"/></label>
   <label className="wide">Most valuable part<textarea value={form.valuable} onChange={e=>u("valuable",e.target.value)} placeholder="What would save you the most time, money, or frustration?"/></label>
   <label className="wide">What is missing?<textarea value={form.missing} onChange={e=>u("missing",e.target.value)} placeholder="What would stop you from using this on a real client engagement?"/></label>
   <label className="wide">Anything else?<textarea value={form.comments} onChange={e=>u("comments",e.target.value)} placeholder="Workflow, terminology, integrations, concerns, ideas…"/></label>
   {message&&<div className="cp-message wide">{message}</div>}<div className="wide cp-entry-actions"><button className="cp-primary" disabled={busy}>{busy?"Saving…":"Submit feedback"}</button></div>
  </form>
 </section>
}
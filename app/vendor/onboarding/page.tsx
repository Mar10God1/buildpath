"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Invite={id:string;project_id:string;vendor_id:string;template_id:string;invited_email:string;status:string};
type Vendor={id:string;legal_name:string|null;dba_name:string|null;ein:string|null;tax_classification:string|null;contact_name:string|null;contact_email:string|null;contact_phone:string|null;payment_enrollment_status:string;compliance_status:string};
type Requirement={id:string;label:string;field_key:string;requirement_type:string;help_text:string|null;is_required:boolean;document_type:string|null;expires:boolean;sort_order:number};
type ResponseRow={requirement_id:string;response_text:string|null;response_json:any};

export default function VendorOnboardingPage(){
 const[invite,setInvite]=useState<Invite|null>(null);const[vendor,setVendor]=useState<Vendor|null>(null);const[reqs,setReqs]=useState<Requirement[]>([]);const[responses,setResponses]=useState<Record<string,string>>({});const[msg,setMsg]=useState("");const[loading,setLoading]=useState(true);

 async function load(){
  const s=createClient();const id=new URLSearchParams(window.location.search).get("invite");if(!id){setMsg("This onboarding link is missing an invitation ID.");setLoading(false);return}
  const auth=await s.auth.getUser();if(!auth.data.user){window.location.href="/login?next="+encodeURIComponent(window.location.pathname+window.location.search);return}
  const ir=await s.from("vendor_invites").select("id,project_id,vendor_id,template_id,invited_email,status").eq("id",id).single();
  if(ir.error){setMsg("This invitation is not available for the signed-in email address.");setLoading(false);return}
  const i=ir.data as Invite;setInvite(i);
  await s.from("vendor_invites").update({status:i.status==="sent"?"opened":i.status,opened_at:new Date().toISOString()}).eq("id",i.id);
  const[v,r,resp]=await Promise.all([
   s.from("vendor_profiles").select("id,legal_name,dba_name,ein,tax_classification,contact_name,contact_email,contact_phone,payment_enrollment_status,compliance_status").eq("id",i.vendor_id).single(),
   s.from("vendor_requirements").select("id,label,field_key,requirement_type,help_text,is_required,document_type,expires,sort_order").eq("template_id",i.template_id).order("sort_order"),
   s.from("vendor_responses").select("requirement_id,response_text,response_json").eq("invite_id",i.id)
  ]);
  setVendor(v.data as Vendor);setReqs((r.data||[]) as Requirement[]);
  const map:Record<string,string>={};((resp.data||[]) as ResponseRow[]).forEach(x=>map[x.requirement_id]=x.response_text||"");setResponses(map);
  setLoading(false);
 }
 useEffect(()=>{load()},[]);

 async function save(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!invite||!vendor)return;const s=createClient();const f=new FormData(e.currentTarget);const auth=await s.auth.getUser();
  const rows=reqs.filter(r=>r.requirement_type!=="document"&&r.requirement_type!=="payment_enrollment").map(r=>({invite_id:invite.id,requirement_id:r.id,response_text:String(f.get(r.id)||""),answered_by:auth.data.user!.id,answered_at:new Date().toISOString()}));
  if(rows.length){const rr=await s.from("vendor_responses").upsert(rows,{onConflict:"invite_id,requirement_id"});if(rr.error){setMsg(rr.error.message);return}}
  const fieldMap:any={};
  reqs.forEach(r=>{const val=String(f.get(r.id)||"");if(["legal_name","dba_name","ein","tax_classification","contact_name","contact_email","contact_phone"].includes(r.field_key))fieldMap[r.field_key]=val||null});
  await s.from("vendor_profiles").update({...fieldMap,compliance_status:"submitted",updated_at:new Date().toISOString()}).eq("id",vendor.id);
  await s.from("vendor_invites").update({status:"submitted",submitted_at:new Date().toISOString()}).eq("id",invite.id);
  setMsg("Your onboarding information has been submitted.");load();
 }

 async function upload(req:Requirement,e:any){
  if(!invite)return;const file=e.target.files?.[0];if(!file)return;setMsg("Uploading "+file.name+"…");const s=createClient();
  const path=invite.id+"/"+req.field_key+"-"+crypto.randomUUID()+"-"+file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
  const up=await s.storage.from("vendor-compliance").upload(path,file,{contentType:file.type||undefined});
  if(up.error){setMsg(up.error.message);return}
  const r=await s.from("vendor_documents").insert({invite_id:invite.id,requirement_id:req.id,document_type:req.document_type||req.field_key,file_name:file.name,storage_path:path,status:"submitted"});
  setMsg(r.error?r.error.message:file.name+" uploaded.");
 }
 if(loading)return <main className="setup-shell"><section className="setup-card">Loading onboarding…</section></main>;
 if(!invite||!vendor)return <main className="setup-shell"><section className="setup-card"><h1>Vendor onboarding</h1><p>{msg||"Invitation not found."}</p></section></main>;

 return <main className="vendor-portal">
  <section className="vendor-portal-card">
   <div className="portal-brand"><span className="brand-mark">⬡</span> BuildPath</div>
   <p className="eyebrow">VENDOR / SUBCONTRACTOR ONBOARDING</p><h1>{vendor.legal_name||"Complete your company profile"}</h1><p className="panel-copy">Provide the information and documents requested by the project team. You can return to this link to update your submission.</p>
   {msg&&<div className="form-message">{msg}</div>}
   <form className="portal-form" onSubmit={save}>
    {reqs.map(r=><div className="portal-field" key={r.id}><label>{r.label}{r.is_required&&<span>*</span>}</label>{r.help_text&&<small>{r.help_text}</small>}
     {r.requirement_type==="document"?<input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e=>upload(r,e)}/>:
      r.requirement_type==="payment_enrollment"?<div className="secure-payment"><strong>Secure payment enrollment</strong><p>BuildPath does not place raw routing or bank account numbers in the ordinary project database. Payment enrollment will be completed through a secure/tokenized payment setup.</p><span>Status: {vendor.payment_enrollment_status.replaceAll("_"," ")}</span></div>:
      r.requirement_type==="select"?<select name={r.id} defaultValue={responses[r.id]||((vendor as any)[r.field_key]||"")} required={r.is_required}><option value="">Select…</option><option>Sole proprietor</option><option>C Corporation</option><option>S Corporation</option><option>Partnership</option><option>LLC</option><option>Other</option></select>:
      <input name={r.id} type={r.requirement_type==="email"?"email":r.requirement_type==="number"?"number":r.requirement_type==="date"?"date":"text"} defaultValue={responses[r.id]||((vendor as any)[r.field_key]||"")} required={r.is_required}/>}
    </div>)}
    <button className="primary-action" type="submit">Submit onboarding</button>
   </form>
  </section>
 </main>
}

"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AppSidebar } from "@/components/app-sidebar";

type Project={id:string;organization_id:string;name:string};
type Vendor={id:string;legal_name:string|null;dba_name:string|null;vendor_type:string;ein:string|null;tax_classification:string|null;contact_name:string|null;contact_email:string|null;contact_phone:string|null;payment_enrollment_status:string;compliance_status:string;notes:string|null};
type Template={id:string;name:string;description:string|null;is_default:boolean};
type Requirement={id:string;template_id:string;label:string;field_key:string;requirement_type:string;help_text:string|null;is_required:boolean;sort_order:number;document_type:string|null;expires:boolean};
type Invite={id:string;vendor_id:string;invited_email:string;status:string;due_date:string|null;created_at:string;template_id:string};

export default function VendorsPage(){
 const[project,setProject]=useState<Project|null>(null);const[vendors,setVendors]=useState<Vendor[]>([]);const[templates,setTemplates]=useState<Template[]>([]);const[reqs,setReqs]=useState<Requirement[]>([]);const[invites,setInvites]=useState<Invite[]>([]);const[editing,setEditing]=useState<string|null>(null);const[mode,setMode]=useState<"vendor"|"requirement"|null>(null);const[msg,setMsg]=useState("");const[inviteLink,setInviteLink]=useState("");

 async function load(){
  const s=createClient();const auth=await s.auth.getUser();if(!auth.data.user){window.location.href="/login?next="+encodeURIComponent(window.location.pathname+window.location.search);return}
  const wanted=new URLSearchParams(window.location.search).get("project");
  const pr=await s.from("projects").select("id,organization_id,name").order("created_at",{ascending:false});
  const list=(pr.data||[]) as Project[];const p=list.find(x=>x.id===wanted)||list[0];if(!p){window.location.href="/setup";return}setProject(p);
  const [v,t,i]=await Promise.all([
    s.from("vendor_profiles").select("*").eq("organization_id",p.organization_id).order("created_at",{ascending:false}),
    s.from("vendor_requirement_templates").select("*").eq("organization_id",p.organization_id).order("is_default",{ascending:false}),
    s.from("vendor_invites").select("id,vendor_id,invited_email,status,due_date,created_at,template_id").eq("project_id",p.id).order("created_at",{ascending:false})
  ]);
  setVendors((v.data||[]) as Vendor[]);setTemplates((t.data||[]) as Template[]);setInvites((i.data||[]) as Invite[]);
  const defaultTemplate=(t.data||[])[0] as Template|undefined;
  if(defaultTemplate){const r=await s.from("vendor_requirements").select("*").eq("template_id",defaultTemplate.id).order("sort_order");setReqs((r.data||[]) as Requirement[])}
 }
 useEffect(()=>{load()},[]);

 async function addVendor(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!project)return;const f=new FormData(e.currentTarget);const s=createClient();
  const companyName=String(f.get("legal_name")||"");
  const c=await s.from("companies").insert({organization_id:project.organization_id,name:companyName,company_type:String(f.get("vendor_type")||"subcontractor")}).select("id").single();
  const r=await s.from("vendor_profiles").insert({organization_id:project.organization_id,company_id:c.data?.id||null,legal_name:companyName,dba_name:String(f.get("dba_name")||"")||null,vendor_type:String(f.get("vendor_type")||"subcontractor"),ein:String(f.get("ein")||"")||null,tax_classification:String(f.get("tax_classification")||"")||null,contact_name:String(f.get("contact_name")||"")||null,contact_email:String(f.get("contact_email")||"")||null,contact_phone:String(f.get("contact_phone")||"")||null,notes:String(f.get("notes")||"")||null}).select("id").single();
  if(r.error){setMsg(r.error.message);return}
  await s.from("vendor_project_assignments").insert({project_id:project.id,vendor_id:r.data.id,trade:String(f.get("trade")||"")||null,scope:String(f.get("scope")||"")||null,status:"prospective"});
  setMode(null);setMsg("Vendor added.");load();
 }

 async function saveVendor(e:FormEvent<HTMLFormElement>,id:string){
  e.preventDefault();const f=new FormData(e.currentTarget);const r=await createClient().from("vendor_profiles").update({
   legal_name:String(f.get("legal_name")||""),dba_name:String(f.get("dba_name")||"")||null,ein:String(f.get("ein")||"")||null,tax_classification:String(f.get("tax_classification")||"")||null,contact_name:String(f.get("contact_name")||"")||null,contact_email:String(f.get("contact_email")||"")||null,contact_phone:String(f.get("contact_phone")||"")||null,payment_enrollment_status:String(f.get("payment_enrollment_status")||"not_started"),compliance_status:String(f.get("compliance_status")||"not_invited"),notes:String(f.get("notes")||"")||null,updated_at:new Date().toISOString()
  }).eq("id",id);
  if(r.error){setMsg(r.error.message);return}setEditing(null);setMsg("Vendor updated.");load();
 }

 async function createInvite(v:Vendor){
  if(!project||!templates[0]||!v.contact_email){setMsg("Vendor needs a contact email before inviting.");return}
  const s=createClient();const auth=await s.auth.getUser();const r=await s.from("vendor_invites").insert({project_id:project.id,vendor_id:v.id,template_id:templates[0].id,invited_email:v.contact_email,invited_by:auth.data.user!.id,status:"sent",sent_at:new Date().toISOString()}).select("id").single();
  if(r.error){setMsg(r.error.message);return}
  await s.from("vendor_profiles").update({compliance_status:"invited"}).eq("id",v.id);
  await s.from("vendor_project_assignments").update({status:"invited",invited_at:new Date().toISOString()}).eq("project_id",project.id).eq("vendor_id",v.id);
  const link=window.location.origin+"/vendor/onboarding?invite="+r.data.id;setInviteLink(link);setMsg("Invitation created. Copy the onboarding link and send it to the vendor.");load();
 }

 async function addRequirement(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!templates[0])return;const f=new FormData(e.currentTarget);const r=await createClient().from("vendor_requirements").insert({template_id:templates[0].id,label:String(f.get("label")),field_key:String(f.get("field_key")).toLowerCase().replace(/[^a-z0-9]+/g,"_"),requirement_type:String(f.get("type")),help_text:String(f.get("help")||"")||null,is_required:f.get("required")==="on",sort_order:reqs.length?Math.max(...reqs.map(x=>x.sort_order))+10:10,document_type:String(f.get("document_type")||"")||null,expires:f.get("expires")==="on"});
  if(r.error){setMsg(r.error.message);return}setMode(null);setMsg("Requirement added.");load();
 }

 if(!project)return <main className="setup-shell"><section className="setup-card">Loading vendors…</section></main>;
 return <div className="shell"><AppSidebar projectId={project.id} active="Vendors & Subs"/><main className="main standalone-page">
  <header className="topbar"><div><p className="eyebrow">PROJECT NETWORK</p><h1>Vendors & Subs</h1><p>Manage subcontractors and suppliers for {project.name} in one place.</p></div><a className="secondary-action" href={"/?project="+project.id}>← Back to project</a></header>
  {msg&&<div className="form-message">{msg}</div>}{inviteLink&&<div className="invite-link"><strong>Vendor onboarding link</strong><input readOnly value={inviteLink}/><button className="primary-action" onClick={()=>navigator.clipboard.writeText(inviteLink)}>Copy link</button></div>}
  <section className="panel page-panel"><div className="panel-title"><div><p className="eyebrow">VENDOR DIRECTORY</p><h3>Project vendors & subcontractors</h3></div><button className="primary-action" onClick={()=>setMode(mode==="vendor"?null:"vendor")}>＋ Add vendor</button></div>
   {mode==="vendor"&&<form className="inline-form" onSubmit={addVendor}><input name="legal_name" required placeholder="Legal business name"/><input name="dba_name" placeholder="DBA / trade name"/><select name="vendor_type"><option value="subcontractor">Subcontractor</option><option value="vendor">Vendor</option><option value="consultant">Consultant</option></select><input name="trade" placeholder="Trade / category"/><input name="ein" placeholder="EIN / Tax ID"/><select name="tax_classification"><option value="">Tax classification</option><option>Sole proprietor</option><option>C Corporation</option><option>S Corporation</option><option>Partnership</option><option>LLC</option><option>Other</option></select><input name="contact_name" placeholder="Primary contact"/><input name="contact_email" type="email" placeholder="Contact email"/><input name="contact_phone" placeholder="Contact phone"/><input name="scope" placeholder="Project scope"/><textarea name="notes" placeholder="Internal notes"/><button className="primary-action">Save vendor</button></form>}
   <div className="vendor-table">{vendors.map(v=><article key={v.id}><div><span className="entity-avatar">{(v.legal_name||"V").slice(0,2).toUpperCase()}</span></div><div><h4>{v.legal_name||"Unnamed vendor"}</h4><p>{v.vendor_type} · {v.contact_name||"No contact"} · {v.contact_email||"No email"}</p><div className="status-row"><span className={"status-pill "+v.compliance_status}>{v.compliance_status.replaceAll("_"," ")}</span><span className="status-pill">{v.payment_enrollment_status.replaceAll("_"," ")}</span></div></div><div className="vendor-actions"><button onClick={()=>setEditing(editing===v.id?null:v.id)}>Edit</button><button onClick={()=>createInvite(v)}>Invite</button></div>{editing===v.id&&<form className="vendor-edit" onSubmit={e=>saveVendor(e,v.id)}><input name="legal_name" defaultValue={v.legal_name||""}/><input name="dba_name" defaultValue={v.dba_name||""} placeholder="DBA"/><input name="ein" defaultValue={v.ein||""} placeholder="EIN"/><input name="tax_classification" defaultValue={v.tax_classification||""} placeholder="Tax classification"/><input name="contact_name" defaultValue={v.contact_name||""} placeholder="Contact"/><input name="contact_email" type="email" defaultValue={v.contact_email||""}/><input name="contact_phone" defaultValue={v.contact_phone||""}/><select name="payment_enrollment_status" defaultValue={v.payment_enrollment_status}><option>not_started</option><option>requested</option><option>complete</option><option>verified</option></select><select name="compliance_status" defaultValue={v.compliance_status}><option>not_invited</option><option>invited</option><option>in_progress</option><option>submitted</option><option>needs_attention</option><option>approved</option><option>expired</option></select><textarea name="notes" defaultValue={v.notes||""}/><button className="primary-action">Save changes</button></form>}</article>)}</div>
  </section>
  <section className="panel page-panel"><div className="panel-title"><div><p className="eyebrow">ONBOARDING REQUIREMENTS</p><h3>{templates[0]?.name||"Vendor requirements"}</h3></div><button className="primary-action" onClick={()=>setMode(mode==="requirement"?null:"requirement")}>＋ Add requirement</button></div><p className="panel-copy">Customize exactly what every invited vendor must provide. Your team can still manually enter or override responses from the vendor record.</p>
   {mode==="requirement"&&<form className="inline-form" onSubmit={addRequirement}><input name="label" required placeholder="Question / requirement label"/><input name="field_key" required placeholder="Internal field key"/><select name="type"><option value="text">Text</option><option value="email">Email</option><option value="phone">Phone</option><option value="number">Number</option><option value="date">Date</option><option value="yes_no">Yes / No</option><option value="select">Select</option><option value="document">Document upload</option><option value="payment_enrollment">Payment enrollment</option></select><input name="document_type" placeholder="Document type, e.g. license"/><input name="help" placeholder="Help text / instructions"/><label className="checkline"><input type="checkbox" name="required" defaultChecked/> Required</label><label className="checkline"><input type="checkbox" name="expires"/> Has expiration date</label><button className="primary-action">Add requirement</button></form>}
   <div className="requirements-list">{reqs.map(r=><article key={r.id}><div><strong>{r.label}</strong><p>{r.help_text||r.field_key}</p></div><div><span className="type">{r.requirement_type.replaceAll("_"," ")}</span>{r.is_required&&<span className="required-tag">Required</span>}{r.expires&&<span className="required-tag">Expires</span>}</div></article>)}</div>
  </section>
  <section className="panel page-panel"><p className="eyebrow">INVITATIONS</p><h3>Onboarding activity</h3>{invites.length?<div className="event-list">{invites.map(i=><article key={i.id}><time>{new Date(i.created_at).toLocaleDateString()}</time><div><h4>{i.invited_email}</h4><p>Status: {i.status.replaceAll("_"," ")}</p></div><div className="impact-stack"><span>{i.due_date||"No due date"}</span></div></article>)}</div>:<div className="empty-state"><p>No vendor invitations yet.</p></div>}</section>
 </main>
}

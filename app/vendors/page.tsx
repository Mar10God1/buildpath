"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AppSidebar } from "@/components/app-sidebar";
import { getProjectVisual } from "@/lib/project-visuals";
import { recommendedRequirements } from "@/lib/adaptive-workspace";

type Project={id:string;organization_id:string;name:string;project_type:string|null;hero_image_url:string|null;user_role:string|null;project_stage:string|null;construction_mode:string|null;funding_type:string|null;original_budget:number|null;complexity_override:string|null};
type Vendor={id:string;legal_name:string|null;dba_name:string|null;vendor_type:string;ein:string|null;tax_classification:string|null;contact_name:string|null;contact_email:string|null;contact_phone:string|null;payment_enrollment_status:string;compliance_status:string;notes:string|null};
type Template={id:string;name:string;description:string|null;is_default:boolean};
type Requirement={id:string;template_id:string;label:string;field_key:string;requirement_type:string;help_text:string|null;is_required:boolean;sort_order:number;document_type:string|null;expires:boolean;source:string};
type ProjectRequirement={requirement_key:string;label:string;enabled:boolean;source:string};
type Invite={id:string;vendor_id:string;invited_email:string;status:string;due_date:string|null;created_at:string;template_id:string};

export default function VendorsPage(){
 const[project,setProject]=useState<Project|null>(null);const[heroImage,setHeroImage]=useState("");const[vendors,setVendors]=useState<Vendor[]>([]);const[templates,setTemplates]=useState<Template[]>([]);const[reqs,setReqs]=useState<Requirement[]>([]);const[projectReqs,setProjectReqs]=useState<ProjectRequirement[]>([]);const[invites,setInvites]=useState<Invite[]>([]);const[editing,setEditing]=useState<string|null>(null);const[mode,setMode]=useState<"vendor"|"requirement"|null>(null);const[msg,setMsg]=useState("");const[inviteLink,setInviteLink]=useState("");

 async function load(){
  const s=createClient();const auth=await s.auth.getUser();if(!auth.data.user){window.location.href="/login?next="+encodeURIComponent(window.location.pathname+window.location.search);return}
  const wanted=new URLSearchParams(window.location.search).get("project");
  const pr=await s.from("projects").select("id,organization_id,name,project_type,hero_image_url,user_role,project_stage,construction_mode,funding_type,original_budget,complexity_override").order("created_at",{ascending:false});
  const list=(pr.data||[]) as Project[];const p=list.find(x=>x.id===wanted)||list[0];if(!p){window.location.href="/setup";return}
  setProject(p);
  if(p.hero_image_url){const signed=await s.storage.from("project-assets").createSignedUrl(p.hero_image_url,3600);setHeroImage(signed.data?.signedUrl||getProjectVisual(p.project_type).image)}else setHeroImage(getProjectVisual(p.project_type).image);

  const [v,t,i,pq]=await Promise.all([
    s.from("vendor_profiles").select("*").eq("organization_id",p.organization_id).order("created_at",{ascending:false}),
    s.from("vendor_requirement_templates").select("id,name,description,is_default").eq("project_id",p.id).order("is_default",{ascending:false}),
    s.from("vendor_invites").select("id,vendor_id,invited_email,status,due_date,created_at,template_id").eq("project_id",p.id).order("created_at",{ascending:false}),
    s.from("project_requirements").select("requirement_key,label,enabled,source").eq("project_id",p.id)
  ]);
  setVendors((v.data||[]) as Vendor[]);setInvites((i.data||[]) as Invite[]);setProjectReqs((pq.data||[]) as ProjectRequirement[]);
  let template=((t.data||[])[0] as Template|undefined);
  if(!template){
   const created=await s.from("vendor_requirement_templates").insert({organization_id:p.organization_id,project_id:p.id,name:p.name+" Vendor Onboarding",description:"Adaptive vendor requirements for this project.",is_default:true,created_by:auth.data.user.id}).select("id,name,description,is_default").single();
   if(created.error){setMsg(created.error.message);return}
   template=created.data as Template;
  }
  setTemplates([template]);
  await syncRecommended(s,p,template.id,(pq.data||[]) as ProjectRequirement[]);
  const rr=await s.from("vendor_requirements").select("*").eq("template_id",template.id).order("sort_order");
  if(!rr.error)setReqs((rr.data||[]) as Requirement[]);
 }

 async function syncRecommended(s:ReturnType<typeof createClient>,p:Project,templateId:string,pReqs:ProjectRequirement[]){
  const map:Record<string,{type:string;doc:string|null;expires:boolean;help:string}>={
   legal_name:{type:"text",doc:null,expires:false,help:"Legal business name shown on tax documents"},
   ein:{type:"text",doc:null,expires:false,help:"Federal Employer Identification Number"},
   tax_classification:{type:"select",doc:null,expires:false,help:"Federal tax classification"},
   contact_name:{type:"text",doc:null,expires:false,help:"Primary onboarding contact"},
   contact_email:{type:"email",doc:null,expires:false,help:"Primary contact email"},
   contact_phone:{type:"phone",doc:null,expires:false,help:"Primary contact phone"},
   w9:{type:"document",doc:"w9",expires:false,help:"Upload a current signed W-9"},
   payment_enrollment:{type:"payment_enrollment",doc:null,expires:false,help:"Complete secure payment enrollment"},
   insurance:{type:"document",doc:"coi",expires:true,help:"Upload required insurance certificate"},
   workers_comp:{type:"document",doc:"workers_comp",expires:true,help:"Upload workers' compensation coverage"},
   license:{type:"document",doc:"license",expires:true,help:"Upload applicable trade or contractor license"},
   prevailing_wage:{type:"yes_no",doc:null,expires:false,help:"Acknowledge prevailing wage requirements"},
   certified_payroll:{type:"document",doc:"certified_payroll",expires:false,help:"Provide required certified payroll documentation"},
   bonding:{type:"document",doc:"bond",expires:true,help:"Provide required payment/performance bonding"},
   dbe_wbe:{type:"document",doc:"dbe_wbe",expires:true,help:"Provide applicable DBE / WBE certification"},
   infection_control:{type:"document",doc:"infection_control",expires:false,help:"Provide required infection-control documentation"},
   safety_program:{type:"document",doc:"safety_program",expires:false,help:"Provide required safety plan or credentials"},
   commissioning:{type:"document",doc:"commissioning",expires:false,help:"Provide required commissioning documentation"},
   public_reporting:{type:"document",doc:"public_reporting",expires:false,help:"Provide required public reporting documentation"}
  };
  const desired=new Map<string,{key:string;label:string;source:"system"|"project"}>();
  recommendedRequirements(p).forEach(x=>desired.set(x.key,{key:x.key,label:x.label,source:"system"}));
  pReqs.filter(x=>x.enabled&&map[x.requirement_key]).forEach(x=>desired.set(x.requirement_key,{key:x.requirement_key,label:x.label,source:"project"}));

  const existing=await s.from("vendor_requirements").select("id,field_key,source").eq("template_id",templateId);
  const rows=(existing.data||[]) as {id:string;field_key:string;source:string}[];
  const remove=rows.filter(x=>["system","project"].includes(x.source)&&!desired.has(x.field_key)).map(x=>x.id);
  if(remove.length)await s.from("vendor_requirements").delete().in("id",remove);

  let order=10;
  for(const d of desired.values()){
   const spec=map[d.key];if(!spec)continue;
   const found=rows.find(x=>x.field_key===d.key);
   if(!found){
    await s.from("vendor_requirements").insert({template_id:templateId,label:d.label,field_key:d.key,requirement_type:spec.type,help_text:spec.help,is_required:true,sort_order:order,document_type:spec.doc,expires:spec.expires,source:d.source});
   }else if(found.source!=="user"){
    await s.from("vendor_requirements").update({label:d.label,requirement_type:spec.type,help_text:spec.help,is_required:true,sort_order:order,document_type:spec.doc,expires:spec.expires,source:d.source}).eq("id",found.id);
   }
   order+=10;
  }
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
  e.preventDefault();if(!templates[0])return;const f=new FormData(e.currentTarget);const r=await createClient().from("vendor_requirements").insert({template_id:templates[0].id,label:String(f.get("label")),field_key:String(f.get("field_key")).toLowerCase().replace(/[^a-z0-9]+/g,"_"),requirement_type:String(f.get("type")),help_text:String(f.get("help")||"")||null,is_required:f.get("required")==="on",sort_order:reqs.length?Math.max(...reqs.map(x=>x.sort_order))+10:10,document_type:String(f.get("document_type")||"")||null,expires:f.get("expires")==="on",source:"user"});
  if(r.error){setMsg(r.error.message);return}setMode(null);setMsg("Requirement added.");load();
 }

 if(!project)return <main className="setup-shell"><section className="setup-card">Loading vendors…</section></main>;
 const visual=getProjectVisual(project.project_type);
 const compliant=vendors.filter(v=>v.compliance_status==="approved").length;
 const pending=vendors.filter(v=>["invited","in_progress","submitted"].includes(v.compliance_status)).length;
 const attention=vendors.filter(v=>["needs_attention","expired"].includes(v.compliance_status)).length;
 const w9=Math.min(vendors.length,compliant+Math.floor(pending*.6));
 const coi=Math.min(vendors.length,compliant+Math.floor(pending*.35));
 const compliancePct=vendors.length?Math.round((compliant/vendors.length)*100):0;
 return <div className="shell"><AppSidebar projectId={project.id} active="Subs & Vendors"/><main className="main standalone-page">
  <div className="global-topbar"><div className="global-search">⌕ <span>Search vendors, contacts, trades, certifications, or projects...</span></div><div className="global-user"><span className="notify-dot">●</span><span className="user-avatar">MG</span><span><strong>BuildPath</strong><small>Project workspace</small></span></div></div>
  <header className="topbar" style={{backgroundImage:"linear-gradient(90deg,rgba(10,11,12,.88),rgba(10,11,12,.54) 55%,rgba(10,11,12,.35)),url("+JSON.stringify(heroImage||visual.image)+")"}}><div><p className="eyebrow">{visual.eyebrow}</p><h1>Vendors & Subs</h1><p>Manage subcontractors and suppliers for {project.name} in one place.</p></div></header>
  <div className="vendor-toolbar"><div className="segmented"><button className="active">All Vendors ({vendors.length})</button><button>Subcontractors ({vendors.filter(v=>v.vendor_type==="subcontractor").length})</button><button>Suppliers ({vendors.filter(v=>v.vendor_type==="vendor").length})</button><button>Onboarding ({pending})</button></div><button className="secondary-action">⇩ Export</button><button className="primary-action" onClick={()=>setMode(mode==="vendor"?null:"vendor")}>＋ Add Vendor</button></div>
  {msg&&<div className="form-message">{msg}</div>}
  {inviteLink&&<div className="invite-link"><strong>Vendor onboarding link</strong><input readOnly value={inviteLink}/><button className="primary-action" onClick={()=>navigator.clipboard.writeText(inviteLink)}>Copy link</button></div>}

  <div className="vendor-summary-grid">
   <section className="panel compliance-summary"><div className="panel-title"><h3>◆ &nbsp; Compliance Overview</h3><span className="text-button">View Details →</span></div>
    <div className="compliance-metrics">
     <div><span>W-9 Collection</span><strong>{vendors.length?Math.round((w9/vendors.length)*100):0}%</strong><small>{w9} of {vendors.length} collected</small><i><b style={{width:(vendors.length?w9/vendors.length*100:0)+"%"}}/></i></div>
     <div><span>COI Tracking</span><strong>{vendors.length?Math.round((coi/vendors.length)*100):0}%</strong><small>{coi} of {vendors.length} compliant</small><i><b style={{width:(vendors.length?coi/vendors.length*100:0)+"%"}}/></i></div>
     <div><span>Expiring Documents</span><strong>{attention}</strong><small>need attention</small><i className="danger-bar"><b style={{width:Math.min(100,attention*18)+"%"}}/></i></div>
     <div><span>Pending Approvals</span><strong>{pending}</strong><small>vendors awaiting review</small><i><b style={{width:Math.min(100,pending*15)+"%"}}/></i></div>
    </div>
   </section>
   <section className="panel requirements-summary"><div className="panel-title"><h3>▤ &nbsp; Requirements Template</h3><button className="text-button" onClick={()=>setMode(mode==="requirement"?null:"requirement")}>Manage →</button></div><strong className="template-title">{templates[0]?.name||"Default Vendor Requirements"}</strong><small>Applied to all new vendor invitations</small><div className="requirements-mini">{reqs.slice(0,5).map(r=><div key={r.id}><span className="req-check">✓</span><b>{r.label}</b><em>{r.is_required?"Required":"Optional"}</em></div>)}</div></section>
   <section className="panel quick-actions"><h3>⚡ &nbsp; Quick Actions</h3><button onClick={()=>setMode("vendor")}>＋ Add Vendor <span>→</span></button><button>✉ Invite Multiple Vendors <span>→</span></button><button onClick={()=>setMode("requirement")}>▤ Manage Requirements <span>→</span></button><button>⇧ Bulk Document Request <span>→</span></button><button>⇩ Export Vendor List <span>→</span></button></section>
  </div>

  {mode==="vendor"&&<section className="panel page-panel"><div className="panel-title"><h3>Add Vendor</h3><button className="text-button" onClick={()=>setMode(null)}>Close</button></div><form className="inline-form" onSubmit={addVendor}><input name="legal_name" required placeholder="Legal business name"/><input name="dba_name" placeholder="DBA / trade name"/><select name="vendor_type"><option value="subcontractor">Subcontractor</option><option value="vendor">Vendor</option><option value="consultant">Consultant</option></select><input name="trade" placeholder="Trade / category"/><input name="ein" placeholder="EIN / Tax ID"/><select name="tax_classification"><option value="">Tax classification</option><option>Sole proprietor</option><option>C Corporation</option><option>S Corporation</option><option>Partnership</option><option>LLC</option><option>Other</option></select><input name="contact_name" placeholder="Primary contact"/><input name="contact_email" type="email" placeholder="Contact email"/><input name="contact_phone" placeholder="Contact phone"/><input name="scope" placeholder="Project scope"/><textarea name="notes" placeholder="Internal notes"/><button className="primary-action">Save vendor</button></form></section>}

  {mode==="requirement"&&<section className="panel page-panel"><div className="panel-title"><h3>Manage Requirements</h3><button className="text-button" onClick={()=>setMode(null)}>Close</button></div><form className="inline-form" onSubmit={addRequirement}><input name="label" required placeholder="Question / requirement label"/><input name="field_key" required placeholder="Internal field key"/><select name="type"><option value="text">Text</option><option value="email">Email</option><option value="phone">Phone</option><option value="number">Number</option><option value="date">Date</option><option value="yes_no">Yes / No</option><option value="select">Select</option><option value="document">Document upload</option><option value="payment_enrollment">Payment enrollment</option></select><input name="document_type" placeholder="Document type, e.g. license"/><input name="help" placeholder="Help text / instructions"/><label className="checkline"><input type="checkbox" name="required" defaultChecked/> Required</label><label className="checkline"><input type="checkbox" name="expires"/> Has expiration date</label><button className="primary-action">Add requirement</button></form></section>}

  <div className="vendor-mid-grid">
   <section className="panel"><div className="panel-title"><h3>▦ &nbsp; Recent Invitations</h3><span className="text-button">View All →</span></div><div className="compact-list">{invites.slice(0,4).map(i=><div key={i.id}><span className="list-icon">✉</span><p><strong>{i.invited_email}</strong><small>{new Date(i.created_at).toLocaleDateString()}</small></p><span className={"status-pill "+i.status}>{i.status.replaceAll("_"," ")}</span></div>)}</div></section>
   <section className="panel"><div className="panel-title"><h3>⚠ &nbsp; Expiring Soon</h3><span className="text-button">View All →</span></div><div className="compact-list">{vendors.filter(v=>["expired","needs_attention"].includes(v.compliance_status)).slice(0,4).map(v=><div key={v.id}><span className="list-icon">▤</span><p><strong>{v.legal_name||"Unnamed vendor"}</strong><small>Compliance document needs attention</small></p><time>Review</time></div>)}</div></section>
  </div>

  <section className="panel vendor-directory-panel">
   <div className="vendor-filters"><div className="filter-search">⌕ Search vendors or contacts...</div><button>Trade <span>All Trades⌄</span></button><button>Compliance Status <span>All Statuses⌄</span></button><button>Payment Status <span>All Statuses⌄</span></button><button>Invitation Status <span>All Statuses⌄</span></button><button>Clear Filters</button></div>
   <div className="vendor-grid-table">
    <div className="vendor-grid-head"><span>Company Name</span><span>Type</span><span>Compliance</span><span>Payment</span><span>Primary Contact</span><span>Invitation</span><span/></div>
    {vendors.map(v=><div className="vendor-grid-row" key={v.id}><div className="vendor-company"><span className="entity-avatar">{(v.legal_name||"V").slice(0,2).toUpperCase()}</span><strong>{v.legal_name||"Unnamed vendor"}</strong></div><span className="vendor-type-pill">{v.vendor_type}</span><span className={"status-pill "+v.compliance_status}>{v.compliance_status.replaceAll("_"," ")}</span><span className="payment-pill">{v.payment_enrollment_status.replaceAll("_"," ")}</span><div><strong>{v.contact_name||"No contact"}</strong><small>{v.contact_email||"No email"}</small></div><span className="status-pill">{invites.find(i=>i.vendor_id===v.id)?.status||"not invited"}</span><div className="vendor-actions"><button onClick={()=>setEditing(editing===v.id?null:v.id)}>Edit</button><button onClick={()=>createInvite(v)}>Invite</button></div>{editing===v.id&&<form className="vendor-edit" onSubmit={e=>saveVendor(e,v.id)}><input name="legal_name" defaultValue={v.legal_name||""}/><input name="dba_name" defaultValue={v.dba_name||""} placeholder="DBA"/><input name="ein" defaultValue={v.ein||""} placeholder="EIN"/><input name="tax_classification" defaultValue={v.tax_classification||""} placeholder="Tax classification"/><input name="contact_name" defaultValue={v.contact_name||""} placeholder="Contact"/><input name="contact_email" type="email" defaultValue={v.contact_email||""}/><input name="contact_phone" defaultValue={v.contact_phone||""}/><select name="payment_enrollment_status" defaultValue={v.payment_enrollment_status}><option>not_started</option><option>requested</option><option>complete</option><option>verified</option></select><select name="compliance_status" defaultValue={v.compliance_status}><option>not_invited</option><option>invited</option><option>in_progress</option><option>submitted</option><option>needs_attention</option><option>approved</option><option>expired</option></select><textarea name="notes" defaultValue={v.notes||""}/><button className="primary-action">Save changes</button></form>}</div>)}
   </div>
  </section>
 </main></div>
}
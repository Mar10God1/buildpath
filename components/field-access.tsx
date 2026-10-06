"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Invite={id:string;invited_email:string|null;status:string;expires_at:string;created_at:string};

async function sha256(value:string){
 const bytes=new TextEncoder().encode(value);
 const digest=await crypto.subtle.digest("SHA-256",bytes);
 return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");
}

export function FieldAccess({projectId}:{projectId:string}){
 const[email,setEmail]=useState("");
 const[invites,setInvites]=useState<Invite[]>([]);
 const[link,setLink]=useState("");
 const[msg,setMsg]=useState("");
 const[busy,setBusy]=useState(false);

 async function load(){
  const r=await createClient().from("project_field_invites").select("id,invited_email,status,expires_at,created_at").eq("project_id",projectId).order("created_at",{ascending:false}).limit(12);
  if(!r.error)setInvites((r.data||[]) as Invite[]);
 }
 useEffect(()=>{void load()},[projectId]);

 async function invite(e:FormEvent){
  e.preventDefault();setBusy(true);setMsg("");setLink("");
  const s=createClient();const auth=await s.auth.getUser();if(!auth.data.user){setBusy(false);return}
  const token=crypto.randomUUID()+crypto.randomUUID().replaceAll("-","");
  const tokenHash=await sha256(token);
  const r=await s.from("project_field_invites").insert({
   project_id:projectId,invited_email:email.trim()||null,token_hash:tokenHash,role:"field_contributor",
   created_by:auth.data.user.id
  }).select("id").single();
  setBusy(false);
  if(r.error){setMsg(r.error.message);return}
  const url=window.location.origin+"/field/join?token="+encodeURIComponent(token);
  setLink(url);setMsg("Field access link created. Send it to the contributor.");setEmail("");await load();
 }

 async function revoke(id:string){
  const r=await createClient().from("project_field_invites").update({status:"revoked"}).eq("id",id);
  if(r.error){setMsg(r.error.message);return}await load();
 }

 return <section className="panel page-panel field-access-panel">
  <div className="panel-title"><div><p className="eyebrow">FIELD ACCESS</p><h3>Invite people to capture jobsite intel</h3></div><a className="secondary-action" href={"/field?project="+projectId}>Open Field Capture →</a></div>
  <p className="panel-copy">Field contributors get a capture-first experience for photos, receipts, invoices, incidents, deliveries, safety observations and voice notes—not the full office workspace.</p>
  <form className="field-invite-form" onSubmit={invite}><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email (optional — leave blank for a shareable link)"/><button className="primary-action" disabled={busy}>{busy?"Creating…":"Create field invite"}</button></form>
  {msg&&<div className="form-message">{msg}</div>}
  {link&&<div className="invite-link"><strong>Field capture invite</strong><input readOnly value={link}/><button className="primary-action" onClick={()=>navigator.clipboard.writeText(link)}>Copy link</button></div>}
  {invites.length>0&&<div className="field-invite-list">{invites.map(i=><div key={i.id}><span><strong>{i.invited_email||"Shareable field link"}</strong><small>Expires {new Date(i.expires_at).toLocaleDateString()}</small></span><em className={"capture-status "+i.status}>{i.status}</em>{i.status==="pending"&&<button onClick={()=>revoke(i.id)}>Revoke</button>}</div>)}</div>}
 </section>
}

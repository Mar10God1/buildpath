"use client";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
export function ConsultationResetPassword(){
 const[password,setPassword]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);const r=await createClient().auth.updateUser({password});setBusy(false);if(r.error){setMessage(r.error.message);return}setMessage("Password updated. You can return to ConsultationPath.");}
 return <main className="cp-auth"><section className="cp-auth-card"><div className="cp-brand"><span className="cp-mark">C</span><strong>Consultation<span>Path</span></strong></div><p className="cp-kicker">ACCOUNT RECOVERY</p><h1>Choose a new password</h1><form className="cp-form" onSubmit={submit}><label>New password<input type="password" minLength={10} required value={password} onChange={e=>setPassword(e.target.value)}/></label>{message&&<div className="cp-message">{message}</div>}<button className="cp-primary" disabled={busy}>{busy?"Updating…":"Update password"}</button></form><a className="cp-link" href="/consultationpath/login">Back to sign in</a></section><section className="cp-auth-hero"><div><p className="cp-kicker">THE MEMORY OF THE ENGAGEMENT</p><h2>Keep the project history accessible.</h2></div></section></main>;
}
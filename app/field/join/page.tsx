"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BuildPathLogo } from "@/components/buildpath-logo";

export default function FieldJoinPage(){
 const[msg,setMsg]=useState("Checking your field access…");
 const[needsLogin,setNeedsLogin]=useState(false);

 useEffect(()=>{void accept()},[]);

 async function accept(){
  const token=new URLSearchParams(window.location.search).get("token");
  if(!token){setMsg("This field access link is missing its token.");return}
  const s=createClient();const auth=await s.auth.getUser();
  if(!auth.data.user){setNeedsLogin(true);setMsg("Sign in or create an account to accept this field access invite.");return}
  const r=await s.rpc("accept_field_invite",{invite_token:token});
  if(r.error){setMsg(r.error.message);return}
  const projectId=String(r.data||"");
  window.location.href="/field?project="+encodeURIComponent(projectId);
 }

 function login(){
  const next=window.location.pathname+window.location.search;
  window.location.href="/login?next="+encodeURIComponent(next);
 }

 return <main className="field-join-shell"><section className="field-join-card"><BuildPathLogo/><p className="eyebrow">FIELD CONTRIBUTOR ACCESS</p><h1>Join this BuildPath project</h1><p>{msg}</p>{needsLogin&&<button className="primary-action" onClick={login}>Sign in / create account →</button>}</section></main>
}

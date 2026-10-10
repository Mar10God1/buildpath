"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { FieldAccess } from "@/components/field-access";
import { PROJECT_PERMISSION_KEYS, PERMISSION_LABELS, ROLE_LABELS, roleDefault, type ProjectPermission, type ProjectRole } from "@/lib/buildpath-permissions";

type Member = { user_id:string; email:string|null; membership_type:string; organization_role:string|null; project_role:ProjectRole; permissions:Record<string,boolean> };
type Draft = { role:ProjectRole; permissions:Partial<Record<ProjectPermission,boolean>> };
const ROLE_OPTIONS:ProjectRole[]=["admin","project_manager","superintendent","safety","finance","field","viewer"];
const EDITABLE_PERMISSIONS=PROJECT_PERMISSION_KEYS.filter(p=>p!=="manage_access");

export function ProjectAccessAdmin({projectId}:{projectId:string}){
  const [members,setMembers]=useState<Member[]>([]);
  const [drafts,setDrafts]=useState<Record<string,Draft>>({});
  const [busy,setBusy]=useState<string|null>(null);
  const [error,setError]=useState("");
  const [saved,setSaved]=useState("");
  const [loading,setLoading]=useState(true);
  const [self,setSelf]=useState("");
  const [selfRole,setSelfRole]=useState<ProjectRole>("viewer");
  const [expanded,setExpanded]=useState<string|null>(null);

  async function load(){
    setLoading(true);setError("");
    const s=createClient();
    const a=await s.auth.getUser();setSelf(a.data.user?.id||"");
    const {data,error:queryError}=await s.rpc("project_access_directory",{target_project:projectId});
    if(queryError){setError(queryError.message);setMembers([]);setLoading(false);return;}
    const people=(data||[]) as Member[];
    setMembers(people);
    setSelfRole(people.find(m=>m.user_id===a.data.user?.id)?.project_role||"viewer");
    setDrafts(Object.fromEntries(people.map(m=>[m.user_id,{role:m.project_role,permissions:m.permissions||{}}])));
    setLoading(false);
  }
  useEffect(()=>{void load()},[projectId]);

  function update(user:string,patch:Partial<Draft>){
    setSaved("");
    setDrafts(old=>({...old,[user]:{...old[user],...patch}}));
  }
  function toggle(user:string,key:ProjectPermission,enabled:boolean){
    const current=drafts[user];
    if(!current)return;
    const next={...current.permissions};
    if(enabled===roleDefault(current.role,key))delete next[key];else next[key]=enabled;
    update(user,{permissions:next});
  }
  async function save(member:Member){
    const draft=drafts[member.user_id];
    if(!draft)return;
    setError("");setSaved("");setBusy(member.user_id);
    const s=createClient();
    const {error:saveError}=await s.from("project_access_grants").upsert({
      project_id:projectId,user_id:member.user_id,role:draft.role,
      permissions:draft.permissions,
    },{onConflict:"project_id,user_id"});
    setBusy(null);
    if(saveError){setError(saveError.message);return;}
    setSaved("Permissions saved for "+(member.email||"this user")+".");
    await load();
  }
  const myOwner=selfRole==="owner";
  return <section className="panel page-panel" style={{marginBottom:12}}>
    <div className="panel-title">
      <div><p className="eyebrow">PROJECT SECURITY</p><h3>Access & roles</h3></div>
      <button className="secondary-action" type="button" onClick={()=>void load()}>Refresh members ↻</button>
    </div>
    <p className="panel-copy">Give each project team member only the access needed for their work. Role presets can be adjusted per member. Changes are enforced by project database permissions for protected modules. Organization owners keep full access.</p>
    {loading&&<p className="panel-copy">Loading project team…</p>}
    {error&&<p role="alert" className="form-message">{error}</p>}
    {saved&&<p role="status" style={{fontSize:12,color:"#207947"}}>{saved}</p>}
    {!loading&&<div style={{display:"grid",gap:9,marginTop:14}}>
      {members.map(m=>{
        const draft=drafts[m.user_id]||{role:m.project_role,permissions:m.permissions||{}};
        const protectedMember=m.user_id===self||m.organization_role==="owner"||(m.organization_role==="admin"&&!myOwner)|| (m.project_role==="admin"&&!myOwner);
        const changed=draft.role!==m.project_role||JSON.stringify(draft.permissions)!==JSON.stringify(m.permissions||{});
        return <article key={m.user_id} style={{border:"1px solid #dededb",borderRadius:7,padding:12,background:"#fff"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
            <div><strong style={{fontSize:12}}>{m.email||"User "+m.user_id.slice(0,8)}</strong>
              <div style={{fontSize:10,color:"#7b8285",marginTop:3}}>
                {m.membership_type==="field_contributor"?"Field contributor":"Organization member"}
                {m.user_id===self?" · You":""}
                {m.organization_role==="owner"?" · Organization owner":""}
              </div>
            </div>
            <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}>
              <select aria-label={"Role for "+(m.email||m.user_id)} value={draft.role} disabled={protectedMember}
                onChange={e=>update(m.user_id,{role:e.target.value as ProjectRole,permissions:{}})}
                style={{padding:"8px 10px",border:"1px solid #cfd2d3",borderRadius:5,background:protectedMember?"#f1f1ed":"white",fontSize:11}}>
                {m.project_role==="owner"&&<option value="owner">Organization owner</option>}
                {ROLE_OPTIONS.filter(r=>r!=="admin"||myOwner||m.project_role==="admin").map(r=><option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
              <button className="secondary-action" type="button" onClick={()=>setExpanded(expanded===m.user_id?null:m.user_id)}>
                {expanded===m.user_id?"Hide permissions":"Permissions"} {expanded===m.user_id?"⌃":"⌄"}
              </button>
              {!protectedMember&&<button className="primary-action" type="button" disabled={busy!==null||!changed} onClick={()=>save(m)}>
                {busy===m.user_id?"Saving…":"Save"}
              </button>}
            </div>
          </div>
          {expanded===m.user_id&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(225px,1fr))",gap:8,marginTop:12,borderTop:"1px solid #e9e9e5",paddingTop:12}}>
            {EDITABLE_PERMISSIONS.map(p=><label key={p} style={{display:"flex",alignItems:"center",gap:8,fontSize:11,color:"#343b40",cursor:protectedMember?"default":"pointer"}}>
              <input type="checkbox" disabled={protectedMember||draft.role==="admin"} checked={draft.permissions[p]??roleDefault(draft.role,p)} onChange={e=>toggle(m.user_id,p,e.target.checked)}/>
              {PERMISSION_LABELS[p]}
            </label>)}
            <small style={{fontSize:10,color:"#7c8285",gridColumn:"1/-1"}}>Administration is reserved for approved project admins and organization owners. You cannot change your own rights or elevate your privileges.</small>
          </div>}
        </article>;
      })}
      {!members.length&&<p className="panel-copy">No other members have joined this project yet. Invite a teammate below, then refresh to assign their role and permissions.</p>}
    </div>}
    <div style={{borderTop:"1px solid #e0e2df",marginTop:18,paddingTop:16}}><h4 style={{margin:"0 0 6px",fontSize:13}}>Invite a project collaborator</h4><p className="panel-copy">Use a project field invite to get the teammate connected. Once they accept, refresh the member list above and assign a broader role such as superintendent, project manager, safety, or finance. Grant only the access they need.</p><FieldAccess projectId={projectId}/></div>
  </section>;
}

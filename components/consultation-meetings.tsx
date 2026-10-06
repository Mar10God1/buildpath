"use client";
import { ChangeEvent, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Evidence={id:string;title:string|null;evidence_type:string;source_system:string|null;occurred_at:string|null;raw_text:string|null;created_at:string};

export function ConsultationMeetings({projectId,evidence,refresh}:{projectId:string;evidence:Evidence[];refresh:()=>void}){
 const[title,setTitle]=useState(""),[date,setDate]=useState(new Date().toISOString().slice(0,10)),[source,setSource]=useState("Live meeting"),[transcript,setTranscript]=useState(""),[listening,setListening]=useState(false),[message,setMessage]=useState("");
 const recognition=useRef<any>(null);
 const meetings=useMemo(()=>evidence.filter(e=>["meeting_transcript","meeting_note"].includes(e.evidence_type)),[evidence]);

 function startMic(){
  setMessage("");
  const W=window as any,SpeechRecognition=W.SpeechRecognition||W.webkitSpeechRecognition;
  if(!SpeechRecognition){setMessage("Live speech capture is not supported in this browser. Use Chrome/Edge or upload/paste a transcript.");return}
  const r=new SpeechRecognition();recognition.current=r;r.continuous=true;r.interimResults=true;r.lang="en-US";
  r.onresult=(ev:any)=>{let finalText="";for(let i=ev.resultIndex;i<ev.results.length;i++){if(ev.results[i].isFinal)finalText+=ev.results[i][0].transcript+" ";}if(finalText)setTranscript(t=>(t+(t?" ":"")+finalText).trim())};
  r.onerror=(ev:any)=>{setMessage("Microphone capture stopped: "+(ev.error||"browser speech error"));setListening(false)};
  r.onend=()=>setListening(false);r.start();setListening(true);
 }
 function stopMic(){try{recognition.current?.stop()}catch{}setListening(false)}
 async function loadFile(e:ChangeEvent<HTMLInputElement>){const file=e.target.files?.[0];if(!file)return;setSource(file.name.endsWith(".vtt")?"Video transcript":file.name.endsWith(".srt")?"Caption transcript":"Transcript file");const text=await file.text();setTranscript(text);if(!title)setTitle(file.name.replace(/\.(txt|vtt|srt|csv)$/i,""))}
 function extractCandidates(text:string,evidenceId:string){
  const sentences=text.replace(/\r/g," ").split(/(?<=[.!?])\s+|\n+/).map(s=>s.trim()).filter(s=>s.length>18);
  const rules=[
   {subtype:"change",test:/\b(add|change|expand|include|new requirement|out of scope|scope)\b/i,title:"Possible scope change"},
   {subtype:"decision",test:/\b(decided|agreed|approved|decision|we will use|go with)\b/i,title:"Possible decision"},
   {subtype:"dependency",test:/\b(client|customer|finance|fp&a|team)\b.*\b(provide|send|deliver|upload|confirm|approve|owe|waiting)\b/i,title:"Possible client dependency"},
   {subtype:"commitment",test:/\b(i will|we will|we'll|by friday|by monday|by next|commit|follow up)\b/i,title:"Possible commitment"},
   {subtype:"risk",test:/\b(risk|delay|blocked|blocker|issue|concern|slip|late)\b/i,title:"Possible risk"}
  ];
  const seen=new Set<string>(),out:any[]=[];
  for(const sentence of sentences){for(const rule of rules){if(rule.test.test(sentence)){const key=rule.subtype+"|"+sentence.toLowerCase();if(seen.has(key))continue;seen.add(key);out.push({candidate_type:rule.subtype==="commitment"?"commitment":"event",candidate_key:rule.subtype,confidence:.72,proposed_value:{subtype:rule.subtype,title:rule.title,description:sentence,source_quote:sentence,date,evidence_id:evidenceId,schedule_impact_days:0,cost_impact:0,status:"open"}});break}}}
  return out.slice(0,12);
 }
 async function save(){
  if(!title.trim()||!transcript.trim()){setMessage("Add a meeting title and transcript first.");return}
  const s=createClient(),u=await s.auth.getUser();const occurred_at=date?date+"T12:00:00":null;
  const existing=await s.from("evidence").select("id").eq("project_id",projectId).eq("evidence_type","meeting_transcript").eq("raw_text",transcript.trim()).maybeSingle();
  if(existing.data){setMessage("This transcript is already in the engagement. Nothing was duplicated.");return}
  const a=await s.from("evidence").insert({project_id:projectId,evidence_type:"meeting_transcript",title:title.trim(),source_system:source||"manual",occurred_at,raw_text:transcript.trim(),created_by:u.data.user?.id||null}).select("id").single();
  if(a.error){setMessage(a.error.message);return}
  const b=await s.from("project_events").insert({project_id:projectId,event_type:"meeting",title:title.trim(),description:"Meeting transcript captured in ConsultationPath",start_at:date||null,date_precision:"day",status:"complete",cost_impact:0,schedule_impact_days:0,created_by:u.data.user?.id||null});
  if(b.error){setMessage("Transcript saved, but timeline entry failed: "+b.error.message);refresh();return}
  const job=await s.from("ingestion_jobs").insert({project_id:projectId,evidence_id:a.data.id,storage_path:"inline/"+a.data.id,file_name:title.trim()+".txt",mime_type:"text/plain",status:"needs_review",extracted_text:transcript.trim(),extracted_metadata:{source:"meeting",meeting_title:title.trim()},created_by:u.data.user?.id||null}).select("id").single();
  if(!job.error){const candidates=extractCandidates(transcript.trim(),a.data.id).map(x=>({...x,job_id:job.data.id,project_id:projectId}));if(candidates.length)await s.from("extraction_candidates").insert(candidates);else await s.from("ingestion_jobs").update({status:"complete",completed_at:new Date().toISOString()}).eq("id",job.data.id)}
  setTitle("");setTranscript("");setSource("Live meeting");setMessage("Meeting saved. Review suggested changes in Review Inbox.");refresh();
 }
 return <section className="cp-meetings">
  <div className="cp-card">
   <div className="cp-card-head"><div><p className="cp-kicker">MEETING INGESTION</p><h2>Capture what the client actually said</h2><p className="cp-muted">Bring meeting conversations into the same evidence trail as scope, decisions and schedule impact.</p></div></div>
   <div className="cp-capture-options">
    <article><span>●</span><strong>Live microphone</strong><p>Capture spoken discussion directly in supported desktop browsers.</p><button className={listening?"cp-secondary":"cp-primary"} onClick={listening?stopMic:startMic}>{listening?"■ Stop listening":"● Start microphone"}</button></article>
    <article><span>⇧</span><strong>Transcript file</strong><p>Import Zoom, Teams, Meet or other transcript/caption exports.</p><label className="cp-upload">Choose transcript<input type="file" accept=".txt,.vtt,.srt,.csv,text/plain,text/vtt" onChange={loadFile}/></label></article>
    <article><span>⌁</span><strong>Meeting apps</strong><p>Direct Zoom, Microsoft Teams and Google Meet connections will flow into this same inbox.</p><div className="cp-app-pills"><i>Zoom</i><i>Teams</i><i>Meet</i></div></article>
   </div>
  </div>
  <div className="cp-card">
   <p className="cp-kicker">NEW MEETING</p><div className="cp-meeting-meta"><label>Meeting title<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Weekly Adaptive Planning design session"/></label><label>Date<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Source<input value={source} onChange={e=>setSource(e.target.value)} placeholder="Zoom / Teams / Live"/></label></div>
   <label className="cp-transcript-label">Transcript<textarea value={transcript} onChange={e=>setTranscript(e.target.value)} placeholder="Paste a transcript here, upload one above, or use live microphone capture…"/></label>
   <div className="cp-transcript-actions"><small>{transcript.length.toLocaleString()} characters captured</small><button className="cp-primary" onClick={save}>Save meeting to engagement →</button></div>{message&&<div className="cp-message cp-meeting-message">{message}</div>}
  </div>
  <div className="cp-card"><p className="cp-kicker">MEETING HISTORY</p><h3>Transcripts available as project evidence</h3>{meetings.map(m=><article className="cp-meeting-row" key={m.id}><div><strong>{m.title||"Meeting"}</strong><span>{m.source_system||"meeting"} · {new Date(m.occurred_at||m.created_at).toLocaleDateString()}</span></div><small>{(m.raw_text||"").length.toLocaleString()} chars</small></article>)}{!meetings.length&&<p className="cp-empty">No meeting transcripts have been captured yet.</p>}</div>
 </section>
}
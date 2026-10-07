import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});
type Workstream={key:string;label:string};
const STOP=new Set(["and","the","for","with","data","phase","project","client","scope","work"]);
const GENERIC_SIGNALS:{pattern:RegExp;hints:RegExp}[]=[
 {pattern:/integration|import|export|api|migration|migrate|data load|connector|feed|interface|extract|file/i,hints:/data|integration|migration|interface/i},
 {pattern:/report|dashboard|analytics|kpi|variance|metric/i,hints:/report|analytic|dashboard|insight/i},
 {pattern:/uat|user acceptance|test|testing|test script|defect|bug/i,hints:/test|uat|quality|qa/i},
 {pattern:/training|train|go.?live|cutover|launch|hypercare|adoption|change management/i,hints:/train|go.?live|launch|cutover|adoption|change/i},
 {pattern:/requirement|design|discovery|workshop|process map|blueprint|solution design/i,hints:/design|discovery|requirement|blueprint/i},
 {pattern:/configur|build|setup|set up|workflow|field|object|module|customi[sz]/i,hints:/config|build|setup|develop/i}
];

function keyFrom(label:string){
 return label.toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"").slice(0,48)||"general";
}
function compact(s:string){return s.replace(/^[\s\-*•\d.)]+/,"").replace(/\s+/g," ").trim();}
function normalized(s:string){return compact(s).toLowerCase().replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();}
function tokens(s:string){return new Set(normalized(s).split(" ").filter(x=>x.length>2&&!STOP.has(x)))}
function similar(a:string,b:string){
 const na=normalized(a),nb=normalized(b);if(!na||!nb)return false;
 if(na.length>28&&nb.length>28&&(na.includes(nb)||nb.includes(na)))return true;
 const A=tokens(a),B=tokens(b);if(!A.size||!B.size)return false;let same=0;for(const x of A)if(B.has(x))same++;
 const union=new Set([...A,...B]).size;return union>0&&same/union>=0.76;
}
function workstreamFor(sentence:string,streams:Workstream[]){
 if(!streams.length)return "general";
 for(const w of streams){const words=w.label.toLowerCase().split(/[^a-z0-9]+/).filter(x=>x.length>2&&!STOP.has(x));if(words.some(x=>new RegExp("\\b"+x,"i").test(sentence)))return w.key}
 for(const g of GENERIC_SIGNALS){if(!g.pattern.test(sentence))continue;const hit=streams.find(w=>g.hints.test(w.label)||g.hints.test(w.key));if(hit)return hit.key}
 return streams[0].key;
}
function milestoneTitle(s:string){const clean=compact(s).replace(/^(we|client|customer|finance|team)\s+/i,"").replace(/[.!?]+$/,"").trim();return clean.length>74?clean.slice(0,71)+"…":clean}
function dateFrom(s:string){
 const iso=s.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);if(iso)return iso[1]+"-"+iso[2].padStart(2,"0")+"-"+iso[3].padStart(2,"0");
 const md=s.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:,?\s+(20\d{2}))?/i);
 if(md){const year=md[3]||String(new Date().getFullYear());const month=String(new Date(md[1]+" 1, 2000").getMonth()+1).padStart(2,"0");return year+"-"+month+"-"+md[2].padStart(2,"0")}
 return "";
}
function extractMeeting(text:string,evidenceId:string,meetingDate:string|null,streams:Workstream[]){
 const sentences=text.replace(/\r/g," ").split(/(?<=[.!?])\s+|\n+/).map(compact).filter(s=>s.length>18);
 const rules=[
  {subtype:"milestone",test:/\b(approved|approval|complete|completed|sign.?off|signed off|ready|validated|validation|delivered|delivery|configured|built|tested|uat|training|go.?live readiness)\b/i,title:"Suggested milestone"},
  {subtype:"change",test:/\b(add|change|expand|include|new requirement|out of scope|scope)\b/i,title:"Possible scope change"},
  {subtype:"decision",test:/\b(decided|agreed|approved|decision|we will use|go with)\b/i,title:"Possible decision"},
  {subtype:"dependency",test:/\b(client|customer|they|their team|team)\b.*\b(provide|send|deliver|upload|confirm|approve|owe|waiting)\b/i,title:"Possible client dependency"},
  {subtype:"commitment",test:/\b(i will|we will|we'll|by friday|by monday|by next|commit|follow up)\b/i,title:"Possible commitment"},
  {subtype:"risk",test:/\b(risk|delay|blocked|blocker|issue|concern|slip|late)\b/i,title:"Possible risk"}
 ];
 const out:any[]=[];
 for(const sentence of sentences){for(const rule of rules){if(!rule.test.test(sentence))continue;const milestone=rule.subtype==="milestone";out.push({candidate_type:milestone?"requirement":rule.subtype==="commitment"?"commitment":"event",candidate_key:rule.subtype,confidence:milestone?.84:.72,proposed_value:{subtype:rule.subtype,title:milestone?milestoneTitle(sentence):rule.title,description:sentence,source_quote:sentence,date:meetingDate?.slice(0,10)||null,evidence_id:evidenceId,schedule_impact_days:0,cost_impact:0,status:milestone?"not_started":"open",workstream_key:milestone?workstreamFor(sentence,streams):undefined,target_date:milestone?dateFrom(sentence):undefined,owner:"",scope_origin:milestone&&/\b(add|new|extra|additional|phase one instead|wasn't|was not|not in scope)\b/i.test(sentence)?"added":"original"}});break}}
 return out.slice(0,24);
}
function extractSow(text:string,evidenceId:string,streams:Workstream[]){
 const lines=text.split(/\r?\n/).map(compact).filter(s=>s.length>8);
 const out:any[]=[];const scopeSignal=/\b(discovery|design|configuration|build|workforce|financial|planning|integration|migration|report|dashboard|analytics|testing|uat|training|go.?live|implementation|module|workstream|deliverable)\b/i;
 const milestoneSignal=/\b(milestone|deliverable|complete|completion|approval|approved|sign.?off|uat|training|go.?live|launch|validated|configured|design complete|ready)\b/i;
 const known=new Set(streams.map(s=>s.key));
 for(const line of lines){
  if(scopeSignal.test(line)&&line.length<=120){
   const label=milestoneTitle(line).replace(/^(scope|workstream|deliverable)\s*[:\-]\s*/i,"");const key=keyFrom(label);
   if(!known.has(key)){known.add(key);out.push({candidate_type:"requirement",candidate_key:"baseline_scope",confidence:.76,proposed_value:{subtype:"baseline_scope",title:label,label,workstream_key:key,description:line,source_quote:line,evidence_id:evidenceId,scope_origin:"original",status:"proposed"}})}
  }
  if(milestoneSignal.test(line)){
   out.push({candidate_type:"requirement",candidate_key:"milestone",confidence:.8,proposed_value:{subtype:"milestone",title:milestoneTitle(line),description:line,source_quote:line,evidence_id:evidenceId,workstream_key:workstreamFor(line,streams),target_date:dateFrom(line),owner:"",scope_origin:"original",status:"not_started"}})
  }
 }
 return out.slice(0,30);
}

Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 const auth=req.headers.get("Authorization");if(!auth)return json({error:"Missing authorization"},401);
 const keys=JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}");const publishable=keys.default||Deno.env.get("SUPABASE_ANON_KEY"),url=Deno.env.get("SUPABASE_URL");if(!url||!publishable)return json({error:"Function environment is not configured"},500);
 const supabase=createClient(url,publishable,{global:{headers:{Authorization:auth}}});const token=auth.replace(/^Bearer\s+/i,"");const {data:userData,error:userError}=await supabase.auth.getUser(token);if(userError||!userData.user)return json({error:"Unauthorized"},401);
 let body:any;try{body=await req.json()}catch{return json({error:"Invalid JSON"},400)}const evidenceId=body?.evidence_id;if(!evidenceId)return json({error:"evidence_id is required"},400);
 const {data:evidence,error:evidenceError}=await supabase.from("evidence").select("id,project_id,title,evidence_type,source_system,raw_text,occurred_at").eq("id",evidenceId).single();if(evidenceError||!evidence)return json({error:evidenceError?.message||"Evidence not found"},404);if(!evidence.raw_text?.trim())return json({error:"Evidence has no text"},422);
 const existing=await supabase.from("ingestion_jobs").select("id,status,extracted_metadata").eq("evidence_id",evidence.id).maybeSingle();if(existing.data)return json({job_id:existing.data.id,status:existing.data.status,duplicate:true,candidate_count:existing.data.extracted_metadata?.candidate_count||0,deduplicated_count:existing.data.extracted_metadata?.deduplicated_count||0});
 const mode=body?.mode==="sow"||evidence.evidence_type==="sow"?"sow":"meeting";
 const {data:job,error:jobError}=await supabase.from("ingestion_jobs").insert({project_id:evidence.project_id,evidence_id:evidence.id,storage_path:"inline/"+evidence.id,file_name:(evidence.title||mode)+".txt",mime_type:"text/plain",status:"processing",extracted_text:evidence.raw_text.trim(),extracted_metadata:{source:mode,processor:"consultation-ingest-v3"},created_by:userData.user.id}).select("id").single();if(jobError||!job)return json({error:jobError?.message||"Could not create ingestion job"},500);
 const streamRows=await supabase.from("project_requirements").select("requirement_key,label,enabled").eq("project_id",evidence.project_id).like("requirement_key","cp_scope_%").order("created_at");
 const streams:Workstream[]=(streamRows.data||[]).filter(r=>r.enabled).map(r=>({key:String(r.requirement_key).slice("cp_scope_".length),label:r.label||""}));
 let raw=mode==="sow"?extractSow(evidence.raw_text.trim(),evidence.id,streams):extractMeeting(evidence.raw_text.trim(),evidence.id,evidence.occurred_at,streams);
 const [events,milestones,prior]=await Promise.all([
  supabase.from("project_events").select("title,description").eq("project_id",evidence.project_id),
  supabase.from("consultation_workstream_milestones").select("title,description").eq("project_id",evidence.project_id),
  supabase.from("extraction_candidates").select("candidate_key,proposed_value").eq("project_id",evidence.project_id)
 ]);
 const existingTexts:string[]=[];
 for(const x of events.data||[])existingTexts.push(String(x.title||""),String(x.description||""));
 for(const x of milestones.data||[])existingTexts.push(String(x.title||""),String(x.description||""));
 for(const x of prior.data||[]){const v=x.proposed_value||{};existingTexts.push(String(v.title||""),String(v.description||""),String(v.source_quote||""))}
 const accepted:any[]=[];let deduplicated=0;
 for(const c of raw){const v=c.proposed_value||{};const probe=String(v.source_quote||v.description||v.title||"");if(existingTexts.some(t=>t&&similar(probe,t))||accepted.some(a=>similar(probe,String(a.proposed_value?.source_quote||a.proposed_value?.description||a.proposed_value?.title||"")))){deduplicated++;continue}accepted.push({...c,job_id:job.id,project_id:evidence.project_id})}
 if(accepted.length){const {error}=await supabase.from("extraction_candidates").insert(accepted);if(error){await supabase.from("ingestion_jobs").update({status:"failed",error_message:error.message}).eq("id",job.id);return json({error:error.message},500)}}
 const metadata={source:mode,processor:"consultation-ingest-v3",candidate_count:accepted.length,deduplicated_count:deduplicated};await supabase.from("ingestion_jobs").update({status:accepted.length?"needs_review":"complete",completed_at:accepted.length?null:new Date().toISOString(),extracted_metadata:metadata}).eq("id",job.id);
 return json({job_id:job.id,candidate_count:accepted.length,deduplicated_count:deduplicated,status:accepted.length?"needs_review":"complete"});
});
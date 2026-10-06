import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";

export const runtime="nodejs";
export const maxDuration=30;

type Candidate={
  candidate_type:string;
  candidate_key:string|null;
  proposed_value:Record<string,unknown>;
  confidence:number;
};

function unique<T>(values:T[]){return Array.from(new Set(values))}
function parseMoney(text:string){
  return unique((text.match(/\$\s?\d[\d,]*(?:\.\d{2})?/g)||[]).map(x=>Number(x.replace(/[^0-9.-]/g,"")))).filter(n=>Number.isFinite(n)).slice(0,8);
}
function parseEmails(text:string){
  return unique(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)||[]).slice(0,8);
}
function parseScheduleImpact(text:string){
  const m=text.match(/\b(\d+(?:\.\d+)?)\s*(hour|hours|hr|hrs|day|days)\s*(?:late|delay|delayed|behind|lost|impact)/i)
    ||text.match(/\b(?:late|delay|delayed|behind|lost|impact(?:ed)?)\s*(?:by\s*)?(\d+(?:\.\d+)?)\s*(hour|hours|hr|hrs|day|days)/i);
  if(!m)return null;
  const value=Number(m[1]);if(!Number.isFinite(value))return null;
  return /hour|hr/i.test(m[2])?Math.max(1,Math.round(value/8)):Math.max(1,Math.round(value));
}
function eventType(type:string,text:string){
  const t=text.toLowerCase();
  if(type==="safety"||/safety|osha|hazard|unsafe|near miss/.test(t))return"safety";
  if(type==="incident"||/incident|damage|injur|accident|leak|break/.test(t))return"incident";
  if(type==="delivery"||/deliver|shipment|material arrived/.test(t))return"delivery";
  if(type==="progress"||/installed|completed|finished|progress/.test(t))return"progress";
  if(type==="receipt"||type==="invoice")return"cost";
  return"field";
}
function buildCandidates(input:{
  submissionType:string;title:string|null;notes:string|null;transcript:string|null;
  amount:number|null;vendorName:string|null;occurredAt:string;evidenceId:string;submissionId:string;
}){
  const text=[input.title,input.notes,input.transcript].filter(Boolean).join("\n").trim();
  const title=input.title||({
    progress:"Field progress update",receipt:"Field receipt",invoice:"Field invoice",incident:"Field incident",
    safety:"Safety observation",delivery:"Delivery update",voice_note:"Field voice note",other:"Field update"
  } as Record<string,string>)[input.submissionType]||"Field update";
  const source={source:"field_capture",submission_id:input.submissionId,evidence_id:input.evidenceId};
  const out:Candidate[]=[];
  const scheduleDays=parseScheduleImpact(text);

  out.push({
    candidate_type:"event",
    candidate_key:(input.submissionType+":"+title).toLowerCase(),
    proposed_value:{
      ...source,title,description:text||title,event_type:eventType(input.submissionType,text),
      date:input.occurredAt,schedule_impact_days:scheduleDays,
      cost_impact:input.amount||null,vendor_name:input.vendorName||null
    },
    confidence:text?0.86:0.72
  });

  const amounts=unique([...(input.amount!=null?[input.amount]:[]),...parseMoney(text)]);
  amounts.forEach(value=>out.push({
    candidate_type:"cost",
    candidate_key:String(value),
    proposed_value:{...source,amount:value,vendor_name:input.vendorName||null,description:text||title,date:input.occurredAt},
    confidence:input.amount===value?0.98:0.82
  }));

  if(input.vendorName)out.push({
    candidate_type:"company",
    candidate_key:input.vendorName.toLowerCase(),
    proposed_value:{...source,name:input.vendorName,relationship:"field_vendor"},
    confidence:0.9
  });

  parseEmails(text).forEach(email=>out.push({
    candidate_type:"person",
    candidate_key:email.toLowerCase(),
    proposed_value:{...source,email},
    confidence:0.8
  }));

  const commitmentPatterns=[
    /\b(?:i|we)\s+(?:will|'ll)\s+([^.!?]+)/gi,
    /\bneed(?:s)?\s+to\s+([^.!?]+)/gi,
    /\b(?:promised|committed|agreed)\s+to\s+([^.!?]+)/gi
  ];
  const commitments:string[]=[];
  for(const re of commitmentPatterns){
    let m:RegExpExecArray|null;
    while((m=re.exec(text))!==null){if(m[1])commitments.push(m[1].trim())}
  }
  unique(commitments).slice(0,5).forEach((commitment,i)=>out.push({
    candidate_type:"commitment",
    candidate_key:(title+":commitment:"+i).toLowerCase(),
    proposed_value:{...source,title:commitment,description:text,date:input.occurredAt},
    confidence:0.72
  }));

  if(/\b(?:stop work|unsafe|hazard|injur|accident|near miss|damag|leak|fire|electrical|fall|collapse)\b/i.test(text)){
    out.push({
      candidate_type:"document_fact",
      candidate_key:"field_risk_flag",
      proposed_value:{...source,title:"Field risk flag",summary:text||title,risk_type:eventType(input.submissionType,text)},
      confidence:0.88
    });
  }

  return out.slice(0,20);
}


type AIIntel={
  summary?:string|null;vendor_name?:string|null;amount?:number|null;invoice_number?:string|null;date?:string|null;
  event_title?:string|null;event_type?:string|null;schedule_impact_days?:number|null;cost_impact?:number|null;
  risk_flags?:string[];companies?:string[];people?:Array<{name?:string|null;email?:string|null}>;commitments?:string[];
};

function parseJsonObject(text:string):AIIntel|null{
  const cleaned=text.trim().replace(/^\`\`\`(?:json)?/i,"").replace(/\`\`\`$/,"").trim();
  const start=cleaned.indexOf("{"),end=cleaned.lastIndexOf("}");
  if(start<0||end<=start)return null;
  try{return JSON.parse(cleaned.slice(start,end+1)) as AIIntel}catch{return null}
}

async function enrichWithAI(args:{
  supabase:ReturnType<typeof createClient>;storagePath:string|null;mediaType:string|null;
  submissionType:string;title:string|null;notes:string|null;transcript:string|null;
  amount:number|null;vendorName:string|null;occurredAt:string;userId:string;
}):Promise<{intel:AIIntel|null;used:boolean;model:string|null}>{
  const context=[
    "Capture type: "+args.submissionType,
    "Captured at: "+args.occurredAt,
    args.title?"Title: "+args.title:"",
    args.vendorName?"Vendor supplied by user: "+args.vendorName:"",
    args.amount!=null?"Amount supplied by user: "+args.amount:"",
    args.notes?"Notes: "+args.notes:"",
    args.transcript?"Transcript: "+args.transcript:""
  ].filter(Boolean).join("\n");

  let imageBytes:Uint8Array|null=null;
  if(args.storagePath&&args.mediaType?.startsWith("image/")){
    const download=await args.supabase.storage.from("field-capture").download(args.storagePath);
    if(!download.error&&download.data.size<=10*1024*1024)imageBytes=new Uint8Array(await download.data.arrayBuffer());
  }

  if(!imageBytes&&context.length<35)return{intel:null,used:false,model:null};

  const prompt=`You extract construction project intelligence from field evidence.
Return ONLY one valid JSON object, with no markdown and no commentary.
Never invent details that are not visible or stated. Use null or [] when unknown.

Schema:
{
 "summary": string|null,
 "vendor_name": string|null,
 "amount": number|null,
 "invoice_number": string|null,
 "date": string|null,
 "event_title": string|null,
 "event_type": "progress"|"cost"|"delivery"|"incident"|"safety"|"field"|null,
 "schedule_impact_days": number|null,
 "cost_impact": number|null,
 "risk_flags": string[],
 "companies": string[],
 "people": [{"name": string|null, "email": string|null}],
 "commitments": string[]
}

For receipts/invoices, read vendor, total amount, invoice/receipt number and date if legible.
For progress/delivery photos, describe only visible work/materials and flag obvious issues.
For safety/incident evidence, identify visible or stated hazards/incidents without guessing causes.
Convert clearly stated hour delays to workdays using 8 hours = 1 day.
Do not infer identities from faces.
Field context:
${context}`;

  try{
    const parts:any[]=[{type:"text",text:prompt}];
    if(imageBytes)parts.push({type:"image",image:imageBytes,mimeType:args.mediaType||undefined});
    const result=await generateText({
      model:"openai/gpt-5-nano",
      messages:[{role:"user",content:parts}]
    });
    return{intel:parseJsonObject(result.text),used:true,model:"openai/gpt-5-nano"};
  }catch{
    return{intel:null,used:false,model:null};
  }
}

function mergeAI(found:Candidate[],intel:AIIntel|null,source:Record<string,unknown>,fallbackDate:string){
  if(!intel)return found;
  const event=found.find(x=>x.candidate_type==="event");
  if(event){
    event.proposed_value={
      ...event.proposed_value,
      ...(intel.event_title?{title:intel.event_title}:{}),
      ...(intel.summary?{description:intel.summary}:{}),
      ...(intel.event_type?{event_type:intel.event_type}:{}),
      ...(intel.date?{date:intel.date}:{}),
      ...(typeof intel.schedule_impact_days==="number"?{schedule_impact_days:intel.schedule_impact_days}:{}),
      ...(typeof intel.cost_impact==="number"?{cost_impact:intel.cost_impact}:{}),
      ...(intel.vendor_name?{vendor_name:intel.vendor_name}:{}),
    };
    event.confidence=Math.max(event.confidence,0.9);
  }
  if(intel.summary)found.push({candidate_type:"document_fact",candidate_key:"ai_field_summary",proposed_value:{...source,title:"AI field summary",summary:intel.summary,risk_flags:intel.risk_flags||[]},confidence:0.9});
  const amount=typeof intel.amount==="number"?intel.amount:(typeof intel.cost_impact==="number"?intel.cost_impact:null);
  if(amount!=null&&!found.some(x=>x.candidate_type==="cost"&&Number(x.proposed_value.amount)===amount)){
    found.push({candidate_type:"cost",candidate_key:String(amount),proposed_value:{...source,amount,vendor_name:intel.vendor_name||null,date:intel.date||fallbackDate,invoice_number:intel.invoice_number||null},confidence:0.9});
  }
  const companies=unique([...(intel.companies||[]),...(intel.vendor_name?[intel.vendor_name]:[])].map(x=>x.trim()).filter(Boolean));
  companies.forEach(name=>{if(!found.some(x=>x.candidate_type==="company"&&x.candidate_key===name.toLowerCase()))found.push({candidate_type:"company",candidate_key:name.toLowerCase(),proposed_value:{...source,name,relationship:"field_vendor"},confidence:0.86})});
  (intel.people||[]).forEach((p,i)=>{
    const key=(p.email||p.name||("person-"+i)).toLowerCase();
    if(!found.some(x=>x.candidate_type==="person"&&x.candidate_key===key))found.push({candidate_type:"person",candidate_key:key,proposed_value:{...source,name:p.name||null,email:p.email||null},confidence:p.email?0.86:0.7});
  });
  (intel.commitments||[]).slice(0,5).forEach((title,i)=>found.push({candidate_type:"commitment",candidate_key:("ai:"+title+":"+i).toLowerCase(),proposed_value:{...source,title,date:intel.date||fallbackDate,description:intel.summary||null},confidence:0.8}));
  (intel.risk_flags||[]).slice(0,6).forEach((flag,i)=>found.push({candidate_type:"document_fact",candidate_key:"risk:"+i,proposed_value:{...source,title:"Field risk flag",summary:flag,risk_type:intel.event_type||"field"},confidence:0.88}));
  return found.slice(0,30);
}

export async function POST(req:NextRequest){
  try{
    const token=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
    if(!token)return NextResponse.json({error:"Unauthorized"},{status:401});
    const {submissionId}=await req.json();
    if(!submissionId)return NextResponse.json({error:"Missing submissionId"},{status:400});

    const supabase=createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {global:{headers:{Authorization:"Bearer "+token}}}
    );
    const auth=await supabase.auth.getUser(token);
    if(!auth.data.user)return NextResponse.json({error:"Unauthorized"},{status:401});

    const sr=await supabase.from("field_submissions").select(
      "id,project_id,submitted_by,submission_type,title,notes,transcript,media_type,storage_path,amount,vendor_name,occurred_at,evidence_id"
    ).eq("id",submissionId).single();
    if(sr.error)return NextResponse.json({error:sr.error.message},{status:403});
    const s=sr.data;
    if(s.submitted_by!==auth.data.user.id)return NextResponse.json({error:"Not allowed"},{status:403});
    if(!s.evidence_id)return NextResponse.json({error:"Field evidence is missing"},{status:400});

    await supabase.from("field_submissions").update({processing_status:"processing"}).eq("id",s.id);

    const fileName=s.storage_path?.split("/").pop()||((s.title||s.submission_type)+".field");
    const job=await supabase.from("ingestion_jobs").insert({
      project_id:s.project_id,evidence_id:s.evidence_id,
      storage_path:s.storage_path||("field://"+s.id),
      file_name:fileName,mime_type:s.media_type||"application/x-buildpath-field",
      status:"processing",created_by:auth.data.user.id
    }).select("id").single();
    if(job.error)throw job.error;

    let found=buildCandidates({
      submissionType:s.submission_type,title:s.title,notes:s.notes,transcript:s.transcript,
      amount:s.amount!=null?Number(s.amount):null,vendorName:s.vendor_name,
      occurredAt:s.occurred_at,evidenceId:s.evidence_id,submissionId:s.id
    });
    const source={source:"field_capture",submission_id:s.id,evidence_id:s.evidence_id};
    const ai=await enrichWithAI({
      supabase,storagePath:s.storage_path,mediaType:s.media_type,submissionType:s.submission_type,
      title:s.title,notes:s.notes,transcript:s.transcript,amount:s.amount!=null?Number(s.amount):null,
      vendorName:s.vendor_name,occurredAt:s.occurred_at,userId:auth.data.user.id
    });
    found=mergeAI(found,ai.intel,source,s.occurred_at);

    if(found.length){
      const ins=await supabase.from("extraction_candidates").insert(found.map(c=>({...c,job_id:job.data.id,project_id:s.project_id})));
      if(ins.error)throw ins.error;
    }

    const status=found.length?"needs_review":"complete";
    await supabase.from("ingestion_jobs").update({
      status,
      extracted_text:[s.notes,s.transcript].filter(Boolean).join("\n").slice(0,100000),
      extracted_metadata:{source:"field_capture",submission_id:s.id,candidate_count:found.length,ai_enriched:ai.used,ai_model:ai.model},
      completed_at:new Date().toISOString()
    }).eq("id",job.data.id);
    await supabase.from("field_submissions").update({processing_status:status}).eq("id",s.id);

    return NextResponse.json({status,candidateCount:found.length,jobId:job.data.id,aiEnriched:ai.used});
  }catch(error:any){
    return NextResponse.json({error:error?.message||"Field processing failed"},{status:500});
  }
}

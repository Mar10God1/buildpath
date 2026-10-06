import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFParse } from "pdf-parse";
import { BUILDER_SYSTEM, CLAUDE_MODEL, aiConfigured, claudeStructured } from "@/lib/ai/claude";

export const runtime = "nodejs";
export const maxDuration = 60;

function inferType(fileName:string){
  const n=fileName.toLowerCase();
  if(n.includes("change order")||/\bco[-_ ]?\d+/i.test(n)) return "change_order";
  if(n.includes("rfi")) return "rfi";
  if(n.includes("schedule")) return "schedule";
  if(n.includes("meeting")||n.includes("minutes")) return "meeting_note";
  if(n.includes("invoice")) return "invoice";
  if(n.includes("email")||n.endsWith(".eml")) return "email";
  return "document";
}
function unique<T>(a:T[]){return Array.from(new Set(a))}
function candidates(text:string,fileName:string){
  const dates=unique(text.match(/\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}\b/gi)||[]).slice(0,12);
  const isoDates=unique(text.match(/\b\d{4}-\d{2}-\d{2}\b/g)||[]).slice(0,12);
  const dollars=unique(text.match(/\$\s?\d[\d,]*(?:\.\d{2})?/g)||[]).slice(0,12);
  const emails=unique(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)||[]).slice(0,12);
  const out:any[]=[];
  const lower=text.toLowerCase();
  const requirementSignals=[
    ["insurance","Insurance / COI",/certificate of insurance|general liability|workers.? compensation/],
    ["prevailing_wage","Prevailing wage",/prevailing wage/],
    ["certified_payroll","Certified payroll",/certified payroll/],
    ["bonding","Bonding",/performance bond|payment bond|surety bond/],
    ["dbe_wbe","DBE / WBE requirements",/\bdbe\b|\bwbe\b|disadvantaged business|women-owned business/],
    ["infection_control","Infection control",/infection control|icra\b/],
    ["safety_program","Safety program",/site safety plan|safety program|osha/],
    ["commissioning","Commissioning",/commissioning requirements?|functional performance test/],
    ["public_reporting","Public reporting",/public reporting|government reporting/],
    ["submittals","Submittal tracking",/submittal register|submittal log/],
    ["rfi_tracking","RFI tracking",/rfi log|request for information/]
  ] as const;
  requirementSignals.forEach(([key,label,re])=>{if(re.test(lower))out.push({candidate_type:"requirement",candidate_key:key,proposed_value:{requirement_key:key,label,source:fileName},confidence:.82})});
  [...dates,...isoDates].forEach(v=>out.push({candidate_type:"date",candidate_key:v,proposed_value:{date:v,source:fileName},confidence:.88}));
  dollars.forEach(v=>out.push({candidate_type:"cost",candidate_key:v,proposed_value:{amount_text:v,source:fileName},confidence:.8}));
  emails.forEach(v=>out.push({candidate_type:"person",candidate_key:v.toLowerCase(),proposed_value:{email:v,source:fileName},confidence:.78}));
  const title=fileName.replace(/\.[^.]+$/,"").replace(/[_-]+/g," ");
  out.unshift({candidate_type:"document_fact",candidate_key:"document_summary",proposed_value:{title,document_type:inferType(fileName),summary:text.slice(0,1200)},confidence:.9});
  if(dates.length||isoDates.length){
    out.push({candidate_type:"event",candidate_key:title.toLowerCase(),proposed_value:{title,description:text.slice(0,700),event_type:inferType(fileName),date:(dates[0]||isoDates[0])},confidence:.62});
  }
  return out.slice(0,40);
}

type AIExtraction={
  document_type:string; summary:string;
  dates:{date:string;what:string}[];
  amounts:{amount:number;what:string}[];
  people:{name:string|null;email:string|null;company:string|null;role:string|null}[];
  change_requests:{title:string;detail:string;amount:number|null}[];
  requirements:string[];
};
const REQUIREMENT_KEYS=["insurance","prevailing_wage","certified_payroll","bonding","dbe_wbe","permits","infection_control","safety_program","commissioning","public_reporting","submittals","rfi_tracking"];
const REQUIREMENT_LABELS:Record<string,string>={insurance:"Insurance / COI",prevailing_wage:"Prevailing wage",certified_payroll:"Certified payroll",bonding:"Bonding",dbe_wbe:"DBE / WBE requirements",permits:"Permits / inspections",infection_control:"Infection control",safety_program:"Safety program",commissioning:"Commissioning",public_reporting:"Public reporting",submittals:"Submittal tracking",rfi_tracking:"RFI tracking"};

/** Claude reads the document and returns review candidates in the same shape as the regex extractor. */
async function aiCandidates(text:string,fileName:string){
  const x=await claudeStructured<AIExtraction>({
    system:BUILDER_SYSTEM,
    toolName:"record_document_facts",
    toolDescription:"Record the useful facts found in a construction job document.",
    maxTokens:3000,
    prompt:`File name: ${fileName}\n\nDocument text:\n"""\n${text.slice(0,60000)}\n"""\n\nPull out the facts a small builder would want on the job record. Dates as YYYY-MM-DD. Only include what the document actually says.`,
    schema:{
      properties:{
        document_type:{type:"string",enum:["change_order","invoice","estimate","contract","schedule","email","meeting_note","permit","inspection","rfi","selection","warranty","document"]},
        summary:{type:"string",description:"2-3 sentence plain summary"},
        dates:{type:"array",items:{type:"object",properties:{date:{type:"string"},what:{type:"string"}},required:["date","what"]}},
        amounts:{type:"array",items:{type:"object",properties:{amount:{type:"number"},what:{type:"string"}},required:["amount","what"]}},
        people:{type:"array",items:{type:"object",properties:{name:{type:["string","null"]},email:{type:["string","null"]},company:{type:["string","null"]},role:{type:["string","null"]}},required:["name","email","company","role"]}},
        change_requests:{type:"array",description:"Requested or agreed changes to scope or price",items:{type:"object",properties:{title:{type:"string"},detail:{type:"string"},amount:{type:["number","null"]}},required:["title","detail","amount"]}},
        requirements:{type:"array",items:{type:"string",enum:REQUIREMENT_KEYS}}
      },
      required:["document_type","summary","dates","amounts","people","change_requests","requirements"]
    }
  });
  const title=fileName.replace(/\.[^.]+$/,"").replace(/[_-]+/g," ");
  const out:any[]=[{candidate_type:"document_fact",candidate_key:"document_summary",proposed_value:{title,document_type:x.document_type,summary:x.summary,ai_model:CLAUDE_MODEL},confidence:.92}];
  (x.dates||[]).slice(0,12).forEach(d=>{
    out.push({candidate_type:"date",candidate_key:d.date,proposed_value:{date:d.date,what:d.what,source:fileName},confidence:.9});
    out.push({candidate_type:"event",candidate_key:(d.what||title).toLowerCase().slice(0,120),proposed_value:{title:d.what||title,description:x.summary,event_type:x.document_type,date:d.date},confidence:.75});
  });
  (x.amounts||[]).slice(0,12).forEach(a=>out.push({candidate_type:"cost",candidate_key:String(a.amount),proposed_value:{amount:a.amount,amount_text:"$"+a.amount.toLocaleString("en-US"),what:a.what,source:fileName},confidence:.85}));
  (x.people||[]).slice(0,12).forEach(p=>out.push({candidate_type:"person",candidate_key:(p.email||p.name||"unknown").toLowerCase(),proposed_value:{...p,source:fileName},confidence:.82}));
  (x.change_requests||[]).slice(0,8).forEach(c=>out.push({candidate_type:"change_request",candidate_key:c.title.toLowerCase().slice(0,120),proposed_value:{...c,source:fileName},confidence:.8}));
  (x.requirements||[]).filter(k=>REQUIREMENT_KEYS.includes(k)).forEach(k=>out.push({candidate_type:"requirement",candidate_key:k,proposed_value:{requirement_key:k,label:REQUIREMENT_LABELS[k],source:fileName},confidence:.85}));
  return {found:out.slice(0,60),documentType:x.document_type};
}

export async function POST(req:NextRequest){
  try{
    const token=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
    if(!token) return NextResponse.json({error:"Unauthorized"},{status:401});
    const body=await req.json();
    const {projectId,storagePath,fileName,mimeType}=body;
    if(!projectId||!storagePath||!fileName) return NextResponse.json({error:"Missing file metadata"},{status:400});
    const supabase=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{global:{headers:{Authorization:"Bearer "+token}}});
    const user=await supabase.auth.getUser(token);
    if(!user.data.user) return NextResponse.json({error:"Unauthorized"},{status:401});

    const evidenceType=inferType(fileName);
    const ev=await supabase.from("evidence").insert({project_id:projectId,evidence_type:evidenceType,title:fileName,source_system:"file_upload",storage_path:storagePath,created_by:user.data.user.id}).select("id").single();
    if(ev.error) throw ev.error;
    const job=await supabase.from("ingestion_jobs").insert({project_id:projectId,evidence_id:ev.data.id,storage_path:storagePath,file_name:fileName,mime_type:mimeType||null,status:"processing",created_by:user.data.user.id}).select("id").single();
    if(job.error) throw job.error;

    const download=await supabase.storage.from("project-evidence").download(storagePath);
    if(download.error) throw download.error;
    const blob=download.data;
    let text="";
    const mime=mimeType||blob.type||"";
    if(mime==="application/pdf"||fileName.toLowerCase().endsWith(".pdf")){
      const parser=new PDFParse({data:new Uint8Array(await blob.arrayBuffer())});
      const result=await parser.getText();
      text=result.text||"";
      await parser.destroy();
    }else if(mime.startsWith("text/")||/\.(txt|csv|json|eml)$/i.test(fileName)){
      text=await blob.text();
    }else{
      await supabase.from("ingestion_jobs").update({status:"needs_review",extracted_metadata:{note:"File stored successfully. Automatic text extraction is currently available for PDF, TXT, CSV, JSON and EML files."}}).eq("id",job.data.id);
      return NextResponse.json({jobId:job.data.id,evidenceId:ev.data.id,status:"needs_review",candidateCount:0});
    }

    let found:any[]=[];let method="pattern";let aiError:string|null=null;
    if(aiConfigured()&&text.trim()){
      try{
        const ai=await aiCandidates(text,fileName);
        found=ai.found;method="claude";
        if(ai.documentType&&ai.documentType!=="document")await supabase.from("evidence").update({evidence_type:ai.documentType}).eq("id",ev.data.id);
      }catch(e:any){aiError=e?.message||"AI extraction failed";}
    }
    if(method==="pattern")found=candidates(text,fileName);
    if(found.length){
      const rows=found.map(c=>({...c,job_id:job.data.id,project_id:projectId}));
      const ins=await supabase.from("extraction_candidates").insert(rows);
      if(ins.error) throw ins.error;
    }
    await supabase.from("evidence").update({raw_text:text.slice(0,100000),metadata:{extraction:method,candidate_count:found.length,...(aiError?{ai_error:aiError}:{})}}).eq("id",ev.data.id);
    await supabase.from("ingestion_jobs").update({status:found.length?"needs_review":"complete",extracted_text:text.slice(0,100000),extracted_metadata:{characters:text.length,candidate_count:found.length,method,...(aiError?{ai_error:aiError}:{})},completed_at:new Date().toISOString()}).eq("id",job.data.id);
    return NextResponse.json({jobId:job.data.id,evidenceId:ev.data.id,status:found.length?"needs_review":"complete",candidateCount:found.length});
  }catch(error:any){
    return NextResponse.json({error:error?.message||"Extraction failed"},{status:500});
  }
}

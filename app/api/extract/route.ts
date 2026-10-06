import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFParse } from "pdf-parse";

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

    const found=candidates(text,fileName);
    if(found.length){
      const rows=found.map(c=>({...c,job_id:job.data.id,project_id:projectId}));
      const ins=await supabase.from("extraction_candidates").insert(rows);
      if(ins.error) throw ins.error;
    }
    await supabase.from("evidence").update({raw_text:text.slice(0,100000),metadata:{extraction:"automatic",candidate_count:found.length}}).eq("id",ev.data.id);
    await supabase.from("ingestion_jobs").update({status:found.length?"needs_review":"complete",extracted_text:text.slice(0,100000),extracted_metadata:{characters:text.length,candidate_count:found.length},completed_at:new Date().toISOString()}).eq("id",job.data.id);
    return NextResponse.json({jobId:job.data.id,evidenceId:ev.data.id,status:found.length?"needs_review":"complete",candidateCount:found.length});
  }catch(error:any){
    return NextResponse.json({error:error?.message||"Extraction failed"},{status:500});
  }
}

export type AdaptiveProject = {
  project_type?: string|null;
  project_stage?: string|null;
  user_role?: string|null;
  construction_mode?: string|null;
  funding_type?: string|null;
  original_budget?: number|null;
  complexity_override?: string|null;
};

export type ProjectRequirement = { requirement_key:string; label:string; enabled:boolean; source:string };
export type ModulePreference = { module_key:string; visibility:"visible"|"available"|"hidden" };
export type ModuleKey =
  | "home"|"timeline"|"documents"|"ask"|"field_capture"|"schedule"|"cost"|"vendors"|"selections"
  | "inspections"|"rfis"|"submittals"|"change_orders"|"daily_reports"|"compliance"
  | "procurement"|"safety"|"commissioning"|"people"|"project_data";

export type ModuleDecision={key:ModuleKey;label:string;icon:string;visibility:"visible"|"available"|"hidden";reason:string;priority:number};

const meta:Record<ModuleKey,{label:string;icon:string}>={
 home:{label:"Home",icon:"⌂"},timeline:{label:"Timeline",icon:"◷"},documents:{label:"Documents",icon:"▤"},ask:{label:"Ask BuildPath",icon:"?"},field_capture:{label:"Field Capture",icon:"＋"},
 schedule:{label:"Schedule",icon:"▣"},cost:{label:"Cost",icon:"$"},vendors:{label:"Vendors & Subs",icon:"♟"},selections:{label:"Selections",icon:"◇"},
 inspections:{label:"Inspections",icon:"✓"},rfis:{label:"RFIs",icon:"?"},submittals:{label:"Submittals",icon:"▧"},change_orders:{label:"Change Orders",icon:"△"},
 daily_reports:{label:"Daily Reports",icon:"☷"},compliance:{label:"Compliance",icon:"⚑"},procurement:{label:"Procurement",icon:"⇄"},
 safety:{label:"Safety",icon:"⚠"},commissioning:{label:"Commissioning",icon:"◎"},people:{label:"People & Companies",icon:"♙"},project_data:{label:"Project Data",icon:"⚙"}
};

function has(reqs:ProjectRequirement[],key:string){return reqs.some(r=>r.enabled&&r.requirement_key===key)}
function norm(v?:string|null){return (v||"").toLowerCase().replace(/[\s/]+/g,"_")}
function push(map:Map<ModuleKey,ModuleDecision>,key:ModuleKey,visibility:"visible"|"available"|"hidden",priority:number,reason:string){
 const current=map.get(key);
 const rank={hidden:0,available:1,visible:2};
 if(!current||rank[visibility]>rank[current.visibility]||priority>current.priority)map.set(key,{key,...meta[key],visibility,priority,reason});
}

export function inferComplexity(p:AdaptiveProject, companyCount=0, documentCount=0){
 if(p.complexity_override)return p.complexity_override;
 let score=0;
 if((p.original_budget||0)>=5000000)score+=3; else if((p.original_budget||0)>=1000000)score+=2; else if((p.original_budget||0)>=250000)score+=1;
 if(companyCount>=15)score+=3; else if(companyCount>=6)score+=2; else if(companyCount>=3)score+=1;
 if(documentCount>=100)score+=3; else if(documentCount>=25)score+=2; else if(documentCount>=8)score+=1;
 const type=norm(p.project_type);
 if(["industrial","healthcare","infrastructure","civic_public"].some(x=>type.includes(x)))score+=2;
 if(norm(p.funding_type).includes("public"))score+=2;
 return score>=7?"complex":score>=3?"standard":"simple";
}

export function buildWorkspace(p:AdaptiveProject,reqs:ProjectRequirement[]=[],prefs:ModulePreference[]=[],companyCount=0,documentCount=0){
 const m=new Map<ModuleKey,ModuleDecision>();
 push(m,"home","visible",100,"Core project workspace");
 push(m,"timeline","visible",95,"Connected project history");
 push(m,"documents","visible",94,"Evidence is the source of project truth");
 push(m,"ask","visible",93,"Project intelligence");
 push(m,"field_capture","available",70,"Fast mobile field evidence capture");
 push(m,"project_data","visible",20,"Project configuration");
 push(m,"people","available",25,"Project relationships");

 const type=norm(p.project_type),role=norm(p.user_role),stage=norm(p.project_stage),mode=norm(p.construction_mode),funding=norm(p.funding_type);
 const complexity=inferComplexity(p,companyCount,documentCount);

 if(!["planning","design"].includes(stage))push(m,"schedule","visible",88,"Active project execution");
 else push(m,"schedule","available",55,"Useful as the project moves into execution");

 if(role.includes("owner")||role.includes("developer")){
  push(m,"cost","visible",92,"Owners need budget and forecast visibility");
  push(m,"schedule","visible",90,"Owners need milestone visibility");
  push(m,"change_orders","visible",82,"Major financial decisions");
  push(m,"vendors","available",45,"Available when direct vendor management is needed");
 }
 if(role.includes("project_manager")||role==="pm"||role.includes("construction_manager")||role.includes("general_contractor")){
  ["schedule","cost","rfis","submittals","change_orders","procurement","vendors"].forEach((k,i)=>push(m,k as ModuleKey,"visible",92-i,"Project management workflow"));
  push(m,"daily_reports","available",58,"Field reporting support");
 }
 if(role.includes("superintendent")||role.includes("field")){
  push(m,"field_capture","visible",99,"Primary mobile field workflow");
  ["schedule","daily_reports","inspections","rfis","safety","procurement"].forEach((k,i)=>push(m,k as ModuleKey,"visible",94-i,"Field execution priority"));
  push(m,"cost","available",35,"Cost is secondary for field users");
 }
 if(role.includes("finance")||role.includes("controller")||role.includes("cfo")){
  push(m,"cost","visible",98,"Primary finance responsibility");
  push(m,"vendors","visible",88,"Vendor compliance and payment setup");
  push(m,"compliance","visible",82,"Vendor and financial controls");
  push(m,"schedule","available",45,"Schedule context");
 }
 if(role.includes("architect")||role.includes("engineer")||role.includes("design")){
  push(m,"rfis","visible",94,"Design clarification workflow");
  push(m,"submittals","visible",91,"Design review workflow");
  push(m,"documents","visible",98,"Drawing and specification record");
  push(m,"change_orders","available",55,"Design changes can affect cost");
 }
 if(role.includes("subcontractor")||role.includes("vendor")){
  push(m,"field_capture","visible",96,"Simple evidence capture for field contributors");
  push(m,"schedule","visible",92,"Trade commitments and milestones");
  push(m,"documents","visible",96,"Scope and required documentation");
  push(m,"compliance","visible",88,"Onboarding and compliance");
  push(m,"cost","available",38,"Commercial context");
 }

 if(type.includes("residential")||type.includes("multifamily")){
  push(m,"schedule","visible",90,"Core residential milestone tracking");
  if((p.original_budget||0)>0)push(m,"cost","visible",88,"Budget and change visibility");
  push(m,"selections","visible",84,"Residential projects often depend on owner selections");
  push(m,"inspections","visible",80,"Inspection milestones");
  push(m,"vendors","visible",76,"Trade coordination");
  push(m,"daily_reports",complexity==="simple"?"hidden":"available",38,"Only useful on larger residential projects");
  push(m,"submittals",complexity==="complex"?"visible":"available",42,"More relevant on complex residential work");
 }
 if(type.includes("commercial")||type.includes("office")||type.includes("retail")){
  ["rfis","submittals","change_orders","vendors"].forEach((k,i)=>push(m,k as ModuleKey,"visible",90-i,"Commercial construction workflow"));
  push(m,"daily_reports","visible",82,"Commercial field documentation");
 }
 if(type.includes("industrial")){
  ["safety","procurement","commissioning","vendors","schedule","inspections"].forEach((k,i)=>push(m,k as ModuleKey,"visible",96-i,"Industrial project priority"));
  push(m,"submittals","visible",80,"Equipment and material review");
 }
 if(type.includes("health")){
  ["inspections","compliance","commissioning","schedule","procurement"].forEach((k,i)=>push(m,k as ModuleKey,"visible",96-i,"Healthcare project priority"));
  push(m,"safety","available",65,"Occupied-space / infection-control context");
 }
 if(type.includes("education")||type.includes("school")){
  ["schedule","inspections","vendors"].forEach((k,i)=>push(m,k as ModuleKey,"visible",88-i,"Education project workflow"));
  push(m,"compliance",funding.includes("public")?"visible":"available",70,"Public requirements when applicable");
 }
 if(type.includes("hospitality")||type.includes("hotel")){
  push(m,"selections","visible",91,"Finish and FF&E decisions");
  push(m,"procurement","visible",89,"Long-lead finish and equipment procurement");
  push(m,"commissioning","available",65,"Closeout / turnover");
 }
 if(type.includes("civic")||type.includes("public")||type.includes("infrastructure")||funding.includes("public")){
  ["compliance","schedule","cost","vendors","daily_reports","inspections"].forEach((k,i)=>push(m,k as ModuleKey,"visible",98-i,"Public project controls"));
 }

 const reqMap:Record<string,ModuleKey[]>={
  prevailing_wage:["compliance","vendors"],certified_payroll:["compliance","vendors"],bonding:["compliance","vendors"],
  dbe_wbe:["compliance","vendors"],insurance:["compliance","vendors"],permits:["inspections"],
  infection_control:["compliance","safety"],safety_program:["safety"],commissioning:["commissioning"],
  public_reporting:["compliance","daily_reports"],submittals:["submittals"],rfi_tracking:["rfis"]
 };
 Object.entries(reqMap).forEach(([key,mods])=>{if(has(reqs,key))mods.forEach((mod,i)=>push(m,mod,"visible",99-i,"Required by this project"))});

 if(mode.includes("renovation")||mode.includes("tenant")||mode.includes("remediation")){
  push(m,"daily_reports","visible",75,"Existing-condition documentation");
  push(m,"inspections","visible",79,"Phased existing-condition work");
 }
 if(stage==="closeout"||stage==="commissioning"){
  push(m,"commissioning","visible",99,"Current project stage");
  push(m,"inspections","visible",95,"Closeout verification");
  push(m,"documents","visible",98,"Closeout documentation");
 }

 if(complexity==="simple"){
  ["rfis","submittals","daily_reports","compliance","procurement","safety","commissioning"].forEach(k=>{
   const x=m.get(k as ModuleKey); if(!x||x.priority<80)push(m,k as ModuleKey,"hidden",1,"Hidden to keep a simple project simple");
  });
 }

 prefs.forEach(p=>{
  const key=p.module_key as ModuleKey;
  if(meta[key])m.set(key,{key,...meta[key],visibility:p.visibility,priority:110,reason:"User customization"});
 });

 return [...m.values()].sort((a,b)=>b.priority-a.priority);
}

export function recommendedRequirements(p:AdaptiveProject){
 const type=norm(p.project_type),funding=norm(p.funding_type);
 const base=[{key:"legal_name",label:"Legal business name"},{key:"ein",label:"EIN / Tax ID"},{key:"tax_classification",label:"Tax classification"},{key:"contact_name",label:"Primary contact"},{key:"contact_email",label:"Contact email"},{key:"contact_phone",label:"Contact phone"},{key:"w9",label:"W-9 / tax information"},{key:"payment_enrollment",label:"Payment enrollment"}];
 const out=[...base];
 if(!type.includes("residential")||type.includes("multifamily"))out.push({key:"insurance",label:"Certificate of Insurance"});
 if(type.includes("commercial")||type.includes("industrial")||type.includes("health")||type.includes("civic")||type.includes("infrastructure")){
  out.push({key:"workers_comp",label:"Workers' compensation"},{key:"license",label:"Trade / contractor license"});
 }
 if(funding.includes("public")||type.includes("civic")||type.includes("infrastructure")){
  out.push({key:"prevailing_wage",label:"Prevailing wage acknowledgment"},{key:"certified_payroll",label:"Certified payroll"},{key:"bonding",label:"Bonding documentation"},{key:"dbe_wbe",label:"DBE / WBE information"});
 }
 if(type.includes("health"))out.push({key:"infection_control",label:"Infection-control requirements"});
 if(type.includes("industrial"))out.push({key:"safety_program",label:"Site safety program / credentials"});
 return out;
}

export const requirementOptions=[
 ["insurance","Insurance / COI"],["prevailing_wage","Prevailing wage"],["certified_payroll","Certified payroll"],["bonding","Bonding"],
 ["dbe_wbe","DBE / WBE requirements"],["permits","Permits / inspections"],["infection_control","Infection control"],["safety_program","Safety program"],
 ["commissioning","Commissioning"],["public_reporting","Public reporting"],["submittals","Submittal tracking"],["rfi_tracking","RFI tracking"]
] as const;

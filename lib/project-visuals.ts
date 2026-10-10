export type ProjectVisual = {
  image: string;
  eyebrow: string;
  headline: string;
  subhead: string;
};

const generic =
  "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=1800&q=85";

export function getProjectVisual(projectType?: string | null): ProjectVisual {
  const type=(projectType||"").toLowerCase();

  if(type.includes("residential")||type.includes("remodel")||type.includes("addition")||type.includes("multifamily")||type.includes("apartment")||type.includes("housing")){
    return {
      image:"https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1800&q=85",
      eyebrow:"RESIDENTIAL JOB",
      headline:"Build the house. BuildPath handles the paperwork.",
      subhead:"Photos and voice notes from the site become daily logs, change orders and a clear record of every decision."
    };
  }
  if(type.includes("industrial")||type.includes("warehouse")||type.includes("manufactur")||type.includes("distribution")){
    return {
      image:"https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1800&q=85",
      eyebrow:"INDUSTRIAL CONSTRUCTION",
      headline:"Coordinate complex industrial work with confidence.",
      subhead:"Connect field activity, procurement, schedule exposure, vendors, and cost impacts in one project record."
    };
  }
  if(type.includes("health")||type.includes("medical")||type.includes("hospital")){
    return {
      image:"https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=1800&q=85",
      eyebrow:"HEALTHCARE CONSTRUCTION",
      headline:"Keep critical healthcare projects aligned.",
      subhead:"Tie design decisions, compliance, vendors, schedule, and evidence together across the build."
    };
  }
  if(type.includes("education")||type.includes("school")||type.includes("campus")){
    return {
      image:"https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=1800&q=85",
      eyebrow:"EDUCATION CONSTRUCTION",
      headline:"Build campuses with a clearer project record.",
      subhead:"Keep milestones, approvals, contractors, documents, and schedule changes connected."
    };
  }
  if(type.includes("hospitality")||type.includes("hotel")||type.includes("resort")){
    return {
      image:"https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1800&q=85",
      eyebrow:"HOSPITALITY CONSTRUCTION",
      headline:"Coordinate the details that define the guest experience.",
      subhead:"Connect finishes, procurement, approvals, vendors, schedule, and cost through one project memory."
    };
  }
  if(type.includes("civic")||type.includes("public")||type.includes("government")||type.includes("municipal")){
    return {
      image:"https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1800&q=85",
      eyebrow:"CIVIC & PUBLIC CONSTRUCTION",
      headline:"Create a transparent record from planning through closeout.",
      subhead:"Track stakeholders, approvals, documents, milestones, and project accountability."
    };
  }
  if(type.includes("infrastructure")||type.includes("civil")||type.includes("transport")){
    return {
      image:"https://images.unsplash.com/photo-1516939884455-1445c8652f83?auto=format&fit=crop&w=1800&q=85",
      eyebrow:"INFRASTRUCTURE",
      headline:"See the full path from field conditions to project outcomes.",
      subhead:"Connect schedule, cost, contractors, evidence, and decisions across infrastructure work."
    };
  }
  if(type.includes("commercial")||type.includes("office")||type.includes("retail")||type.includes("mixed")){
    return {
      image:"https://images.unsplash.com/photo-1487958449943-2429e8be8625?auto=format&fit=crop&w=1800&q=85",
      eyebrow:"COMMERCIAL CONSTRUCTION",
      headline:"Keep your commercial project aligned across teams.",
      subhead:"Connect schedule, cost, documents, vendors, approvals, and field activity in one place."
    };
  }
  return {
    image:generic,
    eyebrow:"YOUR JOB RECORD",
    headline:"Less paperwork. More building.",
    subhead:"Field photos, voice notes, receipts and client requests turn into daily logs, change orders and one clear job record."
  };
}

"use client";

import { BuildPathLogo } from "@/components/buildpath-logo";

export function AppSidebar({projectId,active}:{projectId?:string;active?:string}) {
  const q=projectId?"?project="+projectId:"";
  const items=[
    ["⌂","Home","/"+q],
    ["▦","Projects","/"+q],
    ["▣","Schedule","/"+q],
    ["$","Cost","/"+q],
    ["▤","Documents","/"+q],
    ["♟","Vendors & Subs","/vendors"+q],
    ["▥","Upload & Extract","/documents/upload"+q],
    ["▧","Reports","/"+q],
    ["?","Ask BuildPath","/"+q]
  ];
  return <aside className="sidebar shared-sidebar">
    <BuildPathLogo/>
    <nav>
      {items.map(([icon,label,href])=><a key={label} href={href} className={active===label?"nav-active":""}><span className="nav-icon">{icon}</span><span>{label}</span>{label==="Ask BuildPath"&&<small className="beta-badge">BETA</small>}</a>)}
    </nav>
    <div className="sidebar-spacer"/>
    <div className="sidebar-concrete"><strong>BUILD<br/>SMARTER<br/>TOGETHER</strong><span/></div>
  </aside>
}

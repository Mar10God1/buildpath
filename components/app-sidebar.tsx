"use client";

import { BuildPathLogo } from "@/components/buildpath-logo";

export function AppSidebar({projectId,active}:{projectId?:string;active?:string}) {
  const q=projectId?"?project="+projectId:"";
  const items=[
    ["⌂","Job Overview","/"+q],
    ["＋","Field Capture","/field"+q],
    ["☷","Daily Logs","/daily-logs"+q],
    ["△","Change Orders","/change-orders"+q],
    ["▥","Upload & Extract","/documents/upload"+q],
    ["♟","Subs & Vendors","/vendors"+q],
    ["?","Ask BuildPath","/"+q]
  ];
  return <aside className="sidebar shared-sidebar">
    <BuildPathLogo/>
    <nav>
      {items.map(([icon,label,href])=><a key={label} href={href} className={active===label?"nav-active":""}><span className="nav-icon">{icon}</span><span>{label}</span>{label==="Ask BuildPath"&&<small className="beta-badge">BETA</small>}</a>)}
    </nav>
    <div className="sidebar-spacer"/>
    <div className="sidebar-concrete"><strong>LESS<br/>PAPERWORK<br/>MORE BUILDING</strong><span/></div>
  </aside>
}

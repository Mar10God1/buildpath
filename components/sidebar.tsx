import { navItems } from "@/lib/demo-data";
import { Building2, ChevronDown, Hexagon } from "lucide-react";

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand"><Hexagon size={28} strokeWidth={1.5} /><span>BuildPath</span></div>
      <button className="project-switcher">
        <span><strong>Riverside Medical Office</strong><small>Austin, TX</small></span>
        <ChevronDown size={16} />
      </button>
      <nav>
        {navItems.map((item, i) => <button key={item} className={i === 0 ? "nav-active" : ""}>{item}</button>)}
      </nav>
      <div className="sidebar-bottom">
        <Building2 size={18} />
        <span><strong>BuildPath Intelligence</strong><small>Project memory connected</small></span>
      </div>
    </aside>
  );
}

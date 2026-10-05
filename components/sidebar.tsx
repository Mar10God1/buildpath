import { navItems } from "@/lib/demo-data";

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">⬡</span><span>BuildPath</span></div>
      <button className="project-switcher">
        <span><strong>Riverside Medical Office</strong><small>Austin, TX</small></span>
        <span aria-hidden>⌄</span>
      </button>
      <nav>
        {navItems.map((item, i) => <button key={item} className={i === 0 ? "nav-active" : ""}>{item}</button>)}
      </nav>
      <div className="sidebar-bottom">
        <span className="sidebar-icon">▦</span>
        <span><strong>BuildPath Intelligence</strong><small>Project memory connected</small></span>
      </div>
    </aside>
  );
}

import { AlertTriangle, ArrowUpRight, CalendarDays, CircleDollarSign, Clock3, FileText, MessageSquareText, Sparkles } from "lucide-react";
import { attention, events, project } from "@/lib/demo-data";

export function Dashboard() {
  return (
    <main className="main">
      <header className="topbar">
        <div><p className="eyebrow">PROJECT INTELLIGENCE</p><h1>{project.name}</h1><p>{project.location}</p></div>
        <button className="ask"><Sparkles size={17}/> Ask BuildPath</button>
      </header>

      <section className="hero-card">
        <div className="hero-copy">
          <p className="eyebrow">TODAY'S PROJECT READ</p>
          <h2>The project is moving, but the critical path is exposed.</h2>
          <p>Framing is 14 days behind baseline. BuildPath connected weather, steel-release correspondence, field rework, and CO-017 to reconstruct the delay chain.</p>
          <button className="text-button">Show me why <ArrowUpRight size={15}/></button>
        </div>
        <div className="risk-score"><span>PROJECT HEALTH</span><strong>72</strong><small>At Risk</small></div>
      </section>

      <section className="metrics">
        <article><Clock3/><span>Schedule</span><strong>14 days behind</strong><small>Forecast finish {project.forecastFinish}</small></article>
        <article><CircleDollarSign/><span>Cost</span><strong>{project.forecast}</strong><small>{project.budget} original budget</small></article>
        <article><CalendarDays/><span>Progress</span><strong>{project.completion}%</strong><small>Overall completion</small></article>
        <article><FileText/><span>Evidence</span><strong>1,284 items</strong><small>Connected to project memory</small></article>
      </section>

      <div className="two-col">
        <section className="panel">
          <div className="panel-title"><div><p className="eyebrow">NEEDS ATTENTION</p><h3>What could change the outcome</h3></div><AlertTriangle size={20}/></div>
          <div className="attention-list">
            {attention.map((item) => <article key={item.title}><div><strong>{item.title}</strong><p>{item.detail}</p></div><span>{item.impact}</span></article>)}
          </div>
        </section>

        <section className="panel ask-panel">
          <p className="eyebrow">ASK THE PROJECT</p>
          <h3>What do you want to understand?</h3>
          <div className="question-box"><MessageSquareText size={19}/><span>Why is framing two weeks behind?</span></div>
          <div className="chips"><button>What changed this week?</button><button>Where are we over budget?</button><button>What decisions are overdue?</button></div>
        </section>
      </div>

      <section className="panel timeline-panel">
        <div className="panel-title"><div><p className="eyebrow">CONNECTED TIMELINE</p><h3>How the framing delay developed</h3></div><button className="text-button">Open full timeline <ArrowUpRight size={15}/></button></div>
        <div className="timeline">
          {events.map((event) => <article key={event.date + event.title}><div className="dot"/><time>{event.date}</time><span className="type">{event.type}</span><strong>{event.title}</strong><p>{event.detail}</p></article>)}
        </div>
      </section>
    </main>
  );
}

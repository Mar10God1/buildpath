import { Dashboard } from "@/components/dashboard";
import { Sidebar } from "@/components/sidebar";

export default function Home() {
  return <div className="shell"><Sidebar /><Dashboard /></div>;
}

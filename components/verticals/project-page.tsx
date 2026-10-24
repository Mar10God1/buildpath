"use client";

import { useParams } from "next/navigation";
import { Workspace } from "./workspace";

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  return <Workspace projectId={projectId} />;
}

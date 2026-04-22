"use client";

import { useRouter } from "next/navigation";
import ProjectSelector from "@/components/ProjectSelector";

export default function ReportsHeader({
  projects,
  selectedProjectId
}: {
  projects: { id: string; name: string }[];
  selectedProjectId: string;
}) {
  const router = useRouter();

  function handleChange(projectId: string) {
    router.push(`/reports?projectId=${projectId}`);
  }

  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div>
        <h1 className="page-title">Reports</h1>
        <p className="text-sm text-slate/60">Select a project to view GA4 reports.</p>
      </div>
      <ProjectSelector
        projects={projects}
        value={selectedProjectId}
        onChange={handleChange}
        persistKey="mdh:reports:selectedProjectId"
      />
    </div>
  );
}

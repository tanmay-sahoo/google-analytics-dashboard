"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Project = {
  id: string;
  name: string;
  timezone: string;
  currency: string;
};

export default function ProjectsListClient({
  projects,
  canDelete
}: {
  projects: Project[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmProject, setConfirmProject] = useState<Project | null>(null);
  const [confirmValue, setConfirmValue] = useState("");
  const [confirmError, setConfirmError] = useState<string | null>(null);

  async function handleDelete(project: Project) {
    if (!canDelete || busyId) {
      return;
    }
    setError(null);
    setConfirmError(null);
    setConfirmValue("");
    setConfirmProject(project);
  }

  async function confirmDelete() {
    if (!confirmProject) {
      return;
    }
    if (confirmValue !== confirmProject.name) {
      setConfirmError("Project name did not match.");
      return;
    }
    setConfirmError(null);
    setBusyId(confirmProject.id);
    try {
      const response = await fetch(`/api/projects/${confirmProject.id}`, {
        method: "DELETE"
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to delete project.");
      }
      setConfirmProject(null);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete project.";
      setError(message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      {error ? <div className="alert">{error}</div> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {projects.map((project) => (
          <div key={project.id} className="card flex items-center justify-between gap-4">
            <Link href={`/projects/${project.id}`} className="min-w-0 flex-1">
              <div className="truncate text-lg font-semibold">{project.name}</div>
              <div className="mt-2 text-xs uppercase tracking-[0.2em] text-slate/50">
                {project.timezone} - {project.currency}
              </div>
            </Link>
            {canDelete ? (
              <button
                type="button"
                className="btn-outline"
                onClick={() => handleDelete(project)}
                disabled={busyId === project.id}
              >
                {busyId === project.id ? "Deleting..." : "Delete"}
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {confirmProject ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate/60 p-4">
          <div className="card w-full max-w-lg">
            <div className="text-lg font-semibold">Delete project</div>
            <p className="mt-2 text-sm text-slate/60">
              Type <span className="font-semibold text-slate">{confirmProject.name}</span> to confirm deletion.
            </p>
            <input
              className="input mt-4"
              value={confirmValue}
              onChange={(event) => setConfirmValue(event.target.value)}
              placeholder="Project name"
            />
            {confirmError ? <div className="mt-2 text-sm text-rose-500">{confirmError}</div> : null}
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                className="btn-outline"
                onClick={() => setConfirmProject(null)}
                disabled={busyId === confirmProject.id}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={confirmDelete}
                disabled={busyId === confirmProject.id}
              >
                {busyId === confirmProject.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import Link from "next/link";
import { apiUrl } from "@/lib/base-path";
import { useRouter } from "next/navigation";
import { useState } from "react";
import FlashMessage from "@/components/FlashMessage";

type Project = {
  id: string;
  name: string;
  timezone: string;
  currency: string;
};

export default function ProjectsListClient({
  projects,
  canDelete,
  canCreate = false
}: {
  projects: Project[];
  canDelete: boolean;
  canCreate?: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmProject, setConfirmProject] = useState<Project | null>(null);
  const [confirmValue, setConfirmValue] = useState("");
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleCreate(form: HTMLFormElement) {
    setCreating(true);
    setCreateError(null);
    const formData = new FormData(form);
    const payload = {
      name: String(formData.get("name") ?? "").trim(),
      timezone: String(formData.get("timezone") ?? "").trim() || "UTC",
      currency: String(formData.get("currency") ?? "").trim().toUpperCase() || "USD"
    };

    if (payload.name.length < 2) {
      setCreateError("Project name must be at least 2 characters.");
      setCreating(false);
      return;
    }

    try {
      const response = await fetch(apiUrl("/api/projects"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to create project.");
      }
      form.reset();
      setCreateOpen(false);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create project.";
      setCreateError(message);
    } finally {
      setCreating(false);
    }
  }

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
      const response = await fetch(apiUrl(`/api/projects/${confirmProject.id}`), {
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
    <div className="space-y-4">
      <FlashMessage message={error} tone="error" onDismiss={() => setError(null)} />
      {canCreate ? (
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate/60">
            {projects.length} project{projects.length === 1 ? "" : "s"}
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setCreateError(null);
              setCreateOpen(true);
            }}
          >
            + Create project
          </button>
        </div>
      ) : null}
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
      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate/60 p-4">
          <div className="card w-full max-w-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">Create project</div>
                <p className="mt-1 text-xs text-slate/60">
                  Choose a name, timezone, and reporting currency.
                </p>
              </div>
              <button
                type="button"
                className="btn-outline"
                onClick={() => setCreateOpen(false)}
                disabled={creating}
              >
                Close
              </button>
            </div>
            <form
              className="mt-5 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreate(event.currentTarget);
              }}
            >
              <label className="block space-y-1.5 text-sm">
                <div className="text-slate/70">Project name</div>
                <input
                  name="name"
                  className="input"
                  placeholder="e.g. Acme Web"
                  required
                  minLength={2}
                  autoFocus
                />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block space-y-1.5 text-sm">
                  <div className="text-slate/70">Timezone</div>
                  <input
                    name="timezone"
                    className="input"
                    placeholder="UTC"
                    defaultValue="UTC"
                    required
                  />
                </label>
                <label className="block space-y-1.5 text-sm">
                  <div className="text-slate/70">Currency</div>
                  <input
                    name="currency"
                    className="input"
                    placeholder="USD"
                    defaultValue="USD"
                    maxLength={3}
                    required
                  />
                </label>
              </div>
              {createError ? (
                <div className="text-sm text-rose-500">{createError}</div>
              ) : null}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setCreateOpen(false)}
                  disabled={creating}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={creating}>
                  {creating ? "Creating..." : "Create project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

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

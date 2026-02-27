"use client";

import { useState } from "react";

type Project = {
  id: string;
  name: string;
  timezone: string;
  currency: string;
  projectUsers: { userId: string }[];
};

type User = { id: string; name: string | null; email: string };

export default function AdminProjectsClient({
  initialProjects,
  users
}: {
  initialProjects: Project[];
  users: User[];
}) {
  const [projects, setProjects] = useState(initialProjects);
  const [message, setMessage] = useState<string | null>(null);

  async function refetch() {
    const response = await fetch("/api/projects");
    const data = await response.json();
    setProjects(data.projects);
  }

  async function createProject(form: HTMLFormElement) {
    const formData = new FormData(form);
    const payload = {
      name: String(formData.get("name")),
      timezone: String(formData.get("timezone")),
      currency: String(formData.get("currency"))
    };

    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      await refetch();
      setMessage("Project created.");
    } else {
      setMessage("Failed to create project.");
    }
  }

  async function updateProject(id: string, payload: Record<string, string>) {
    const response = await fetch(`/api/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      await refetch();
      setMessage("Project updated.");
    } else {
      setMessage("Failed to update project.");
    }
  }

  async function assignUsers(id: string, userIds: string[]) {
    const response = await fetch(`/api/projects/${id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds })
    });

    if (response.ok) {
      await refetch();
      setMessage("Assignments updated.");
    } else {
      setMessage("Failed to assign users.");
    }
  }

  async function deleteProject(id: string) {
    const response = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (response.ok) {
      await refetch();
      setMessage("Project deleted.");
    } else {
      setMessage("Failed to delete project.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="label">Create project</div>
        <form
          className="mt-4 grid gap-4 md:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            void createProject(event.currentTarget);
          }}
        >
          <input name="name" className="input" placeholder="Project name" required />
          <input name="timezone" className="input" placeholder="Timezone" required />
          <input name="currency" className="input" placeholder="Currency" required />
          <button className="btn-primary">Create</button>
        </form>
        {message ? <div className="mt-3 text-sm text-slate/60">{message}</div> : null}
      </div>

      <div className="card">
        <div className="label">Projects</div>
        <div className="mt-4 space-y-4">
          {projects.map((project) => (
            <div key={project.id} className="rounded-2xl border border-slate-200/70 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-lg font-semibold">{project.name}</div>
                  <div className="text-xs uppercase tracking-[0.2em] text-slate/50">
                    {project.timezone} - {project.currency}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn-outline"
                    onClick={() => updateProject(project.id, { name: `${project.name} (Updated)` })}
                  >
                    Quick rename
                  </button>
                  <button className="btn-outline" onClick={() => deleteProject(project.id)}>
                    Delete
                  </button>
                </div>
              </div>
              <div className="mt-4">
                <div className="label">Assign users</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {users.map((user) => {
                    const checked = project.projectUsers.some((item) => item.userId === user.id);
                    return (
                      <label key={user.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          defaultChecked={checked}
                          onChange={(event) => {
                            const selected = new Set(
                              project.projectUsers.map((item) => item.userId)
                            );
                            if (event.target.checked) {
                              selected.add(user.id);
                            } else {
                              selected.delete(user.id);
                            }
                            assignUsers(project.id, Array.from(selected));
                          }}
                        />
                        {user.name ?? user.email}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

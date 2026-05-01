"use client";

import { useMemo, useState } from "react";
import { apiUrl } from "@/lib/base-path";
import FlashMessage, { inferTone } from "@/components/FlashMessage";
import SortableHeader from "@/components/SortableHeader";

type User = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  isActive: boolean;
  menuAccess: string[] | null;
  notificationsEnabled?: boolean;
  createdAt?: string;
  createdBy?: { id: string; name: string | null; email: string | null } | null;
  projectIds?: string[];
};

type ProjectOption = { id: string; name: string };

type MenuItem = { key: string; label: string };

const MENU_OPTIONS: MenuItem[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "projects", label: "Projects" },
  { key: "alerts", label: "Alerts" },
  { key: "admin-projects", label: "Admin Projects" },
  { key: "admin-users", label: "Admin Users" },
  { key: "admin-integrations", label: "Admin Integrations" },
  { key: "admin-alerts", label: "Notifications" },
  { key: "admin-settings", label: "Admin Settings" },
  { key: "admin-logs", label: "Admin Logs" }
];

export default function AdminUsersClient({
  initialUsers,
  projects = []
}: {
  initialUsers?: User[];
  projects?: ProjectOption[];
}) {
  const [users, setUsers] = useState<User[]>(initialUsers ?? []);
  const [message, setMessage] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [menuAccess, setMenuAccess] = useState<string[]>([]);
  const [createProjectIds, setCreateProjectIds] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedAccess, setSelectedAccess] = useState<string[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>("USER");
  const [selectedActive, setSelectedActive] = useState(true);
  const [createRole, setCreateRole] = useState<string>("USER");
  const [createActive, setCreateActive] = useState(true);
  const [createNotifEnabled, setCreateNotifEnabled] = useState(false);
  const [selectedNotifEnabled, setSelectedNotifEnabled] = useState(false);
  const messageTone = inferTone(message);
  const [sortKey, setSortKey] = useState<
    "name" | "email" | "role" | "status" | "menuAccess" | "createdBy" | "manage"
  >("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  async function refetch() {
    const response = await fetch(apiUrl("/api/users"));
    const data = await response.json();
    const list: User[] = Array.isArray(data.users)
      ? data.users.map((row: User & { projectUsers?: { projectId: string }[] }) => ({
          ...row,
          projectIds: row.projectUsers?.map((pu) => pu.projectId) ?? row.projectIds ?? []
        }))
      : [];
    setUsers(list);
  }

  async function createUser(form: HTMLFormElement) {
    const formData = new FormData(form);
    const effectiveMenus =
      createRole === "ADMIN" ? MENU_OPTIONS.map((item) => item.key) : menuAccess;
    const effectiveProjects = createRole === "ADMIN" ? [] : createProjectIds;
    const payload = {
      name: String(formData.get("name")),
      email: String(formData.get("email")),
      password: String(formData.get("password")),
      role: createRole,
      isActive: createActive,
      menuAccess: effectiveMenus,
      projectIds: effectiveProjects,
      notificationsEnabled: createRole === "ADMIN" ? true : createNotifEnabled
    };

    const response = await fetch(apiUrl("/api/users"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      await refetch();
      setMessage("User created.");
      setShowCreate(false);
      setMenuAccess([]);
      setCreateProjectIds([]);
      setCreateRole("USER");
      setCreateActive(true);
      setCreateNotifEnabled(false);
      form.reset();
    } else {
      setMessage("Failed to create user.");
    }
  }

  async function updateUser(id: string, payload: Record<string, unknown>) {
    const response = await fetch(apiUrl(`/api/users/${id}`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      await refetch();
      setMessage("User updated.");
    } else {
      setMessage("Failed to update user.");
    }
  }

  async function deleteUser(id: string) {
    const response = await fetch(apiUrl(`/api/users/${id}`), { method: "DELETE" });
    if (response.ok) {
      await refetch();
      setMessage("User deleted.");
      setSelectedUser(null);
    } else {
      setMessage("Failed to delete user.");
    }
  }

  function toggleMenuAccess(key: string) {
    setMenuAccess((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );
  }

  function openUserMenu(user: User) {
    setSelectedUser(user);
    setSelectedAccess(user.menuAccess ?? []);
    setSelectedProjectIds(user.projectIds ?? []);
    setSelectedRole(user.role);
    setSelectedActive(user.isActive);
    setSelectedNotifEnabled(user.notificationsEnabled ?? user.role === "ADMIN");
  }

  function toggleSelectedAccess(key: string) {
    setSelectedAccess((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );
  }

  function toggleCreateProject(id: string) {
    setCreateProjectIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  function toggleSelectedProject(id: string) {
    setSelectedProjectIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  function applyRoleAccess(role: string, target: "create" | "edit") {
    if (role === "ADMIN") {
      const all = MENU_OPTIONS.map((item) => item.key);
      if (target === "create") {
        setMenuAccess(all);
      } else {
        setSelectedAccess(all);
      }
    }
  }

  function toggleSort(
    key: "name" | "email" | "role" | "status" | "menuAccess" | "createdBy" | "manage"
  ) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  }

  const sortedUsers = useMemo(() => {
    const direction = sortDirection === "asc" ? 1 : -1;
    return [...users].sort((a, b) => {
      const nameA = (a.name ?? "").toLowerCase();
      const nameB = (b.name ?? "").toLowerCase();
      const emailA = a.email.toLowerCase();
      const emailB = b.email.toLowerCase();
      const roleA = a.role.toLowerCase();
      const roleB = b.role.toLowerCase();
      const statusA = a.isActive ? 1 : 0;
      const statusB = b.isActive ? 1 : 0;
      const menuA = a.menuAccess?.length ?? 0;
      const menuB = b.menuAccess?.length ?? 0;
      const creatorA = (a.createdBy?.name ?? a.createdBy?.email ?? "system").toLowerCase();
      const creatorB = (b.createdBy?.name ?? b.createdBy?.email ?? "system").toLowerCase();

      let compare = 0;
      if (sortKey === "name") compare = nameA.localeCompare(nameB);
      else if (sortKey === "email") compare = emailA.localeCompare(emailB);
      else if (sortKey === "role") compare = roleA.localeCompare(roleB);
      else if (sortKey === "status") compare = statusA - statusB;
      else if (sortKey === "menuAccess") compare = menuA - menuB;
      else if (sortKey === "createdBy") compare = creatorA.localeCompare(creatorB);
      else compare = nameA.localeCompare(nameB);

      if (compare === 0) {
        compare = emailA.localeCompare(emailB);
      }
      return compare * direction;
    });
  }, [users, sortDirection, sortKey]);

  return (
    <div className="space-y-6">
      <div className="section-header">
        <div>
          <div className="page-title">Users</div>
          <div className="muted">Manage roles, status, and menu access.</div>
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            setShowCreate(true);
            setCreateRole("USER");
            setMenuAccess([]);
            setCreateActive(true);
            setCreateNotifEnabled(false);
          }}
        >
          + Create user
        </button>
      </div>

      <FlashMessage message={message} tone={messageTone} onDismiss={() => setMessage(null)} />

      {showCreate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate/30 px-4">
          <div className="card w-full max-w-2xl">
            <div className="flex items-center justify-between">
              <div className="label">Create user</div>
              <button className="btn-outline" onClick={() => setShowCreate(false)}>
                Close
              </button>
            </div>
            <form
              className="mt-4 grid gap-4 md:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                void createUser(event.currentTarget);
              }}
            >
              <input name="name" className="input" placeholder="Name" />
              <input name="email" type="email" className="input" placeholder="Email" required />
              <input name="password" type="password" className="input" placeholder="Password" required />
              <select
                name="role"
                className="input"
                value={createRole}
                onChange={(event) => {
                  const nextRole = event.target.value;
                  setCreateRole(nextRole);
                  if (nextRole === "ADMIN") {
                    applyRoleAccess(nextRole, "create");
                  }
                }}
              >
                <option value="USER">User</option>
                <option value="ADMIN">Admin</option>
              </select>
              <label className="flex items-center justify-between rounded-xl border border-slate/10 bg-white px-4 py-3 text-sm">
                <span className="text-slate/70">Active status</span>
                <button
                  type="button"
                  className={`relative h-6 w-11 rounded-full transition ${
                    createActive ? "bg-emerald-500" : "bg-slate/30"
                  }`}
                  onClick={() => setCreateActive((current) => !current)}
                >
                  <span
                    className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition ${
                      createActive ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </label>
              <label className="md:col-span-2 flex items-center justify-between rounded-xl border border-slate/10 bg-white px-4 py-3 text-sm">
                <div>
                  <div className="text-slate/70">Email notifications</div>
                  <div className="mt-0.5 text-xs text-slate/50">
                    {createRole === "ADMIN"
                      ? "Admins always receive alert emails."
                      : "Send alert emails for projects this user has access to."}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={createRole === "ADMIN"}
                  className={`relative h-6 w-11 rounded-full transition ${
                    createRole === "ADMIN" || createNotifEnabled ? "bg-emerald-500" : "bg-slate/30"
                  } ${createRole === "ADMIN" ? "opacity-70 cursor-not-allowed" : ""}`}
                  onClick={() => setCreateNotifEnabled((current) => !current)}
                >
                  <span
                    className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition ${
                      createRole === "ADMIN" || createNotifEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </label>
              <div className="md:col-span-2">
                <div className="text-xs uppercase tracking-[0.2em] text-slate/50">Menu access</div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {MENU_OPTIONS.map((item) => (
                    <label key={item.key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={menuAccess.includes(item.key)}
                        disabled={createRole === "ADMIN"}
                        onChange={() => toggleMenuAccess(item.key)}
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate/50">Project access</div>
                  {projects.length > 0 && createRole !== "ADMIN" ? (
                    <button
                      type="button"
                      className="text-xs font-medium text-ocean hover:underline"
                      onClick={() =>
                        setCreateProjectIds(
                          createProjectIds.length === projects.length ? [] : projects.map((p) => p.id)
                        )
                      }
                    >
                      {createProjectIds.length === projects.length ? "Clear all" : "Select all"}
                    </button>
                  ) : null}
                </div>
                {createRole === "ADMIN" ? (
                  <p className="mt-2 text-xs text-slate/50">Admins automatically have access to all projects.</p>
                ) : projects.length === 0 ? (
                  <p className="mt-2 text-xs text-slate/50">No projects yet — create projects first.</p>
                ) : (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 max-h-48 overflow-y-auto pr-1">
                    {projects.map((project) => (
                      <label key={project.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={createProjectIds.includes(project.id)}
                          onChange={() => toggleCreateProject(project.id)}
                        />
                        {project.name}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="md:col-span-2">
                <button className="btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {selectedUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate/30 px-4">
          <div className="card w-full max-w-2xl">
            <div className="flex items-center justify-between">
              <div className="label">Manage user</div>
              <button className="btn-outline" onClick={() => setSelectedUser(null)}>
                Close
              </button>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-slate/50">Name</div>
                <div className="mt-1 text-sm text-slate">{selectedUser.name ?? "-"}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-slate/50">Email</div>
                <div className="mt-1 text-sm text-slate">{selectedUser.email}</div>
              </div>
              <label className="space-y-2 text-sm">
                <div className="text-slate/70">Role</div>
                <select
                  className="input"
                  value={selectedRole}
                  onChange={(event) => {
                    const nextRole = event.target.value;
                    setSelectedRole(nextRole);
                    if (nextRole === "ADMIN") {
                      applyRoleAccess(nextRole, "edit");
                    }
                  }}
                >
                  <option value="USER">User</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </label>
              <label className="flex items-center justify-between rounded-xl border border-slate/10 bg-white px-4 py-3 text-sm">
                <span className="text-slate/70">Active status</span>
                <button
                  type="button"
                  className={`relative h-6 w-11 rounded-full transition ${
                    selectedActive ? "bg-emerald-500" : "bg-slate/30"
                  }`}
                  onClick={() => {
                    setSelectedActive((current) => !current);
                  }}
                >
                  <span
                    className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition ${
                      selectedActive ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </label>
              <label className="md:col-span-2 flex items-center justify-between rounded-xl border border-slate/10 bg-white px-4 py-3 text-sm">
                <div>
                  <div className="text-slate/70">Email notifications</div>
                  <div className="mt-0.5 text-xs text-slate/50">
                    {selectedRole === "ADMIN"
                      ? "Admins always receive alert emails."
                      : "Send alert emails for projects this user has access to."}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={selectedRole === "ADMIN"}
                  className={`relative h-6 w-11 rounded-full transition ${
                    selectedRole === "ADMIN" || selectedNotifEnabled ? "bg-emerald-500" : "bg-slate/30"
                  } ${selectedRole === "ADMIN" ? "opacity-70 cursor-not-allowed" : ""}`}
                  onClick={() => setSelectedNotifEnabled((current) => !current)}
                >
                  <span
                    className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition ${
                      selectedRole === "ADMIN" || selectedNotifEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </label>
              <div className="md:col-span-2">
                <div className="text-xs uppercase tracking-[0.2em] text-slate/50">Menu access</div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {MENU_OPTIONS.map((item) => (
                    <label key={item.key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedAccess.includes(item.key)}
                        disabled={selectedRole === "ADMIN"}
                        onChange={() => toggleSelectedAccess(item.key)}
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate/50">Project access</div>
                  {projects.length > 0 && selectedRole !== "ADMIN" ? (
                    <button
                      type="button"
                      className="text-xs font-medium text-ocean hover:underline"
                      onClick={() =>
                        setSelectedProjectIds(
                          selectedProjectIds.length === projects.length ? [] : projects.map((p) => p.id)
                        )
                      }
                    >
                      {selectedProjectIds.length === projects.length ? "Clear all" : "Select all"}
                    </button>
                  ) : null}
                </div>
                {selectedRole === "ADMIN" ? (
                  <p className="mt-2 text-xs text-slate/50">Admins automatically have access to all projects.</p>
                ) : projects.length === 0 ? (
                  <p className="mt-2 text-xs text-slate/50">No projects yet.</p>
                ) : (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 max-h-48 overflow-y-auto pr-1">
                    {projects.map((project) => (
                      <label key={project.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedProjectIds.includes(project.id)}
                          onChange={() => toggleSelectedProject(project.id)}
                        />
                        {project.name}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="md:col-span-2">
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    const formData = new FormData(event.currentTarget);
                    const password = String(formData.get("password"));
                    if (password) {
                      updateUser(selectedUser.id, { password });
                      event.currentTarget.reset();
                    }
                  }}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center"
                >
                  <input
                    name="password"
                    type="password"
                    className="input"
                    placeholder="New password"
                  />
                  <button className="btn-outline" type="submit">
                    Update password
                  </button>
                </form>
              </div>
              <div className="md:col-span-2 flex flex-wrap gap-2">
                <button
                  className="btn-primary"
                  onClick={() =>
                    updateUser(selectedUser.id, {
                      role: selectedRole,
                      isActive: selectedActive,
                      menuAccess: selectedAccess,
                      projectIds: selectedRole === "ADMIN" ? [] : selectedProjectIds,
                      notificationsEnabled: selectedRole === "ADMIN" ? true : selectedNotifEnabled
                    })
                  }
                >
                  Save changes
                </button>
                <button className="btn-outline" onClick={() => setSelectedUser(null)}>
                  Cancel
                </button>
              </div>
              <div className="md:col-span-2">
                <button className="btn-outline" onClick={() => deleteUser(selectedUser.id)}>
                  Delete user
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="card">
        <div className="label">User access</div>
        <div className="mt-4 overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>
                  <SortableHeader
                    label="Name"
                    active={sortKey === "name"}
                    direction={sortDirection}
                    onClick={() => toggleSort("name")}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Email"
                    active={sortKey === "email"}
                    direction={sortDirection}
                    onClick={() => toggleSort("email")}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Role"
                    active={sortKey === "role"}
                    direction={sortDirection}
                    onClick={() => toggleSort("role")}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Status"
                    active={sortKey === "status"}
                    direction={sortDirection}
                    onClick={() => toggleSort("status")}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Menu access"
                    active={sortKey === "menuAccess"}
                    direction={sortDirection}
                    onClick={() => toggleSort("menuAccess")}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Created by"
                    active={sortKey === "createdBy"}
                    direction={sortDirection}
                    onClick={() => toggleSort("createdBy")}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Manage"
                    active={sortKey === "manage"}
                    direction={sortDirection}
                    onClick={() => toggleSort("manage")}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((user) => (
                <tr key={user.id} className="border-t border-slate-100">
                  <td>{user.name ?? "-"}</td>
                  <td>{user.email}</td>
                  <td>
                    <span className="chip">{user.role}</span>
                  </td>
                  <td>
                    <span className="chip">{user.isActive ? "Active" : "Inactive"}</span>
                  </td>
                  <td>
                    <span className="chip">
                      {user.menuAccess?.length ?? 0} selected
                    </span>
                  </td>
                  <td>
                    <span className="chip">
                      {user.createdBy?.name ?? user.createdBy?.email ?? "System"}
                    </span>
                  </td>
                  <td>
                    <button className="btn-outline" onClick={() => openUserMenu(user)}>
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

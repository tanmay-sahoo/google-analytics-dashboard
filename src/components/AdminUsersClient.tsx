"use client";

import { useState } from "react";

type User = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  isActive: boolean;
  menuAccess: string[] | null;
  createdAt?: string;
  createdBy?: { id: string; name: string | null; email: string | null } | null;
};

type MenuItem = { key: string; label: string };

const MENU_OPTIONS: MenuItem[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "projects", label: "Projects" },
  { key: "alerts", label: "Alerts" },
  { key: "admin-projects", label: "Admin Projects" },
  { key: "admin-users", label: "Admin Users" },
  { key: "admin-integrations", label: "Admin Integrations" },
  { key: "admin-alerts", label: "Admin Alerts" },
  { key: "admin-settings", label: "Admin Settings" },
  { key: "admin-logs", label: "Admin Logs" }
];

export default function AdminUsersClient({ initialUsers }: { initialUsers?: User[] }) {
  const [users, setUsers] = useState<User[]>(initialUsers ?? []);
  const [message, setMessage] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [menuAccess, setMenuAccess] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedAccess, setSelectedAccess] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>("USER");
  const [selectedActive, setSelectedActive] = useState(true);
  const [createRole, setCreateRole] = useState<string>("USER");
  const [createActive, setCreateActive] = useState(true);

  async function refetch() {
    const response = await fetch("/api/users");
    const data = await response.json();
    setUsers(Array.isArray(data.users) ? data.users : []);
  }

  async function createUser(form: HTMLFormElement) {
    const formData = new FormData(form);
    const effectiveMenus =
      createRole === "ADMIN" ? MENU_OPTIONS.map((item) => item.key) : menuAccess;
      const payload = {
        name: String(formData.get("name")),
        email: String(formData.get("email")),
        password: String(formData.get("password")),
        role: createRole,
        isActive: createActive,
        menuAccess: effectiveMenus
      };

    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      await refetch();
      setMessage("User created.");
      setShowCreate(false);
      setMenuAccess([]);
      setCreateRole("USER");
      setCreateActive(true);
      form.reset();
    } else {
      setMessage("Failed to create user.");
    }
  }

  async function updateUser(id: string, payload: Record<string, unknown>) {
    const response = await fetch(`/api/users/${id}`, {
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
    const response = await fetch(`/api/users/${id}`, { method: "DELETE" });
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
    setSelectedRole(user.role);
    setSelectedActive(user.isActive);
  }

  function toggleSelectedAccess(key: string) {
    setSelectedAccess((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
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
          }}
        >
          + Create user
        </button>
      </div>

      {message ? <div className="alert">{message}</div> : null}

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
                      menuAccess: selectedAccess
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
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Menu access</th>
                <th>Created by</th>
                <th>Manage</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
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

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import FlashMessage, { inferTone } from "@/components/FlashMessage";
import SortableHeader from "@/components/SortableHeader";
import StatusBadge from "@/components/StatusBadge";

type ProjectOption = { id: string; name: string };

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  href: string | null;
  kind: "ALERT" | "SYSTEM";
  readAt: string | null;
  createdAt: string;
  project: { id: string; name: string } | null;
  user: { id: string; name: string | null; email: string } | null;
};

type SortKey = "createdAt" | "title" | "project" | "kind" | "status" | "user";

export default function NotificationsClient({
  isAdminScope,
  projects
}: {
  isAdminScope: boolean;
  projects: ProjectOption[];
}) {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const messageTone = inferTone(message);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<"" | "ALERT" | "SYSTEM">("");
  const [statusFilter, setStatusFilter] = useState<"all" | "unread" | "read">("all");
  const [projectFilter, setProjectFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (isAdminScope) params.set("scope", "all");
    params.set("limit", "200");
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (kindFilter) params.set("kind", kindFilter);
    if (projectFilter) params.set("projectId", projectFilter);
    if (debouncedSearch) params.set("q", debouncedSearch);
    try {
      const res = await fetch(`/api/notifications?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        setMessage("Failed to load notifications.");
        return;
      }
      const data = await res.json();
      setItems(Array.isArray(data.notifications) ? data.notifications : []);
    } catch {
      setMessage("Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, isAdminScope, kindFilter, projectFilter, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection(key === "createdAt" ? "desc" : "asc");
  }

  const sortedItems = useMemo(() => {
    const direction = sortDirection === "asc" ? 1 : -1;
    return [...items].sort((a, b) => {
      let compare = 0;
      if (sortKey === "createdAt") compare = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else if (sortKey === "title") compare = a.title.localeCompare(b.title);
      else if (sortKey === "project")
        compare = (a.project?.name ?? "").localeCompare(b.project?.name ?? "");
      else if (sortKey === "kind") compare = a.kind.localeCompare(b.kind);
      else if (sortKey === "status")
        compare = Number(Boolean(a.readAt)) - Number(Boolean(b.readAt));
      else if (sortKey === "user")
        compare = (a.user?.email ?? "").localeCompare(b.user?.email ?? "");
      return compare * direction;
    });
  }, [items, sortKey, sortDirection]);

  async function markOneRead(id: string) {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] })
    });
    await load();
  }

  async function markAllRead() {
    if (isAdminScope) {
      setMessage("Each user can only mark their own notifications as read.");
      return;
    }
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true })
    });
    await load();
  }

  function clearFilters() {
    setSearch("");
    setKindFilter("");
    setStatusFilter("all");
    setProjectFilter("");
  }

  const unreadVisible = sortedItems.filter((n) => !n.readAt).length;

  return (
    <div className="space-y-6">
      <FlashMessage message={message} tone={messageTone} onDismiss={() => setMessage(null)} />

      <div className="card">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="label">Filters</div>
            <p className="mt-1 text-xs text-slate/60">
              {isAdminScope
                ? "Showing notifications across all users."
                : "Showing your notifications."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate/60">{unreadVisible} unread shown</span>
            {!isAdminScope ? (
              <button type="button" className="btn-outline" onClick={() => void markAllRead()} disabled={loading}>
                Mark all read
              </button>
            ) : null}
            <button type="button" className="btn-outline" onClick={clearFilters} disabled={loading}>
              Clear filters
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <label className="space-y-1.5 text-sm md:col-span-2">
            <div className="text-xs text-slate/60">Search</div>
            <input
              className="input"
              placeholder="Search title or message..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="space-y-1.5 text-sm">
            <div className="text-xs text-slate/60">Kind</div>
            <select
              className="input"
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value as "" | "ALERT" | "SYSTEM")}
            >
              <option value="">All</option>
              <option value="ALERT">Alerts</option>
              <option value="SYSTEM">System</option>
            </select>
          </label>
          <label className="space-y-1.5 text-sm">
            <div className="text-xs text-slate/60">Status</div>
            <select
              className="input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "unread" | "read")}
            >
              <option value="all">All</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
            </select>
          </label>
          {projects.length > 0 ? (
            <label className="space-y-1.5 text-sm md:col-span-2">
              <div className="text-xs text-slate/60">Project</div>
              <select
                className="input"
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
              >
                <option value="">All projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between">
          <div className="label">Notifications log</div>
          {loading ? <span className="text-xs text-slate/60">Loading…</span> : null}
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="whitespace-nowrap pr-6">
                  <SortableHeader
                    label="When"
                    active={sortKey === "createdAt"}
                    direction={sortDirection}
                    onClick={() => toggleSort("createdAt")}
                  />
                </th>
                <th className="whitespace-nowrap pr-6">
                  <SortableHeader
                    label="Title"
                    active={sortKey === "title"}
                    direction={sortDirection}
                    onClick={() => toggleSort("title")}
                  />
                </th>
                <th className="whitespace-nowrap pr-6">Message</th>
                <th className="whitespace-nowrap pr-6">
                  <SortableHeader
                    label="Project"
                    active={sortKey === "project"}
                    direction={sortDirection}
                    onClick={() => toggleSort("project")}
                  />
                </th>
                {isAdminScope ? (
                  <th className="whitespace-nowrap pr-6">
                    <SortableHeader
                      label="User"
                      active={sortKey === "user"}
                      direction={sortDirection}
                      onClick={() => toggleSort("user")}
                    />
                  </th>
                ) : null}
                <th className="whitespace-nowrap pr-6">
                  <SortableHeader
                    label="Kind"
                    active={sortKey === "kind"}
                    direction={sortDirection}
                    onClick={() => toggleSort("kind")}
                  />
                </th>
                <th className="whitespace-nowrap pr-6">
                  <SortableHeader
                    label="Status"
                    active={sortKey === "status"}
                    direction={sortDirection}
                    onClick={() => toggleSort("status")}
                  />
                </th>
                <th className="whitespace-nowrap pr-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.length === 0 ? (
                <tr className="border-t border-slate-100">
                  <td colSpan={isAdminScope ? 8 : 7} className="py-8 text-center text-sm text-slate/60">
                    No notifications match the current filters.
                  </td>
                </tr>
              ) : (
                sortedItems.map((item) => {
                  const unread = !item.readAt;
                  return (
                    <tr key={item.id} className={`border-t border-slate-100 align-top ${unread ? "bg-sky-50/40 dark:bg-sky-900/10" : ""}`}>
                      <td className="whitespace-nowrap pr-6 text-xs text-slate/70">
                        {new Date(item.createdAt).toLocaleString()}
                      </td>
                      <td className="pr-6">
                        <div className={`text-sm ${unread ? "font-semibold" : ""}`}>{item.title}</div>
                      </td>
                      <td className="pr-6 text-xs text-slate/70">
                        <div className="line-clamp-3 max-w-md">{item.body}</div>
                      </td>
                      <td className="whitespace-nowrap pr-6 text-sm">{item.project?.name ?? "—"}</td>
                      {isAdminScope ? (
                        <td className="whitespace-nowrap pr-6 text-xs text-slate/70">
                          {item.user ? item.user.name ?? item.user.email : "—"}
                        </td>
                      ) : null}
                      <td className="whitespace-nowrap pr-6">
                        <StatusBadge
                          label={item.kind}
                          tone={item.kind === "ALERT" ? "warn" : "accent"}
                        />
                      </td>
                      <td className="whitespace-nowrap pr-6">
                        <StatusBadge label={unread ? "Unread" : "Read"} />
                      </td>
                      <td className="whitespace-nowrap pr-2 text-right">
                        <div className="inline-flex items-center gap-2">
                          {item.href ? (
                            <Link href={item.href} className="btn-outline">
                              View
                            </Link>
                          ) : null}
                          {unread && !isAdminScope ? (
                            <button
                              type="button"
                              className="btn-outline"
                              onClick={() => void markOneRead(item.id)}
                            >
                              Mark read
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

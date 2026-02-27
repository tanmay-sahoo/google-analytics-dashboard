"use client";

import { useMemo, useState } from "react";

type ActivityItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  message: string | null;
  createdAt: string;
  user: { name: string | null; email: string | null } | null;
};

type RunItem = {
  id: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  totalProjects: number;
  totalGa4: number;
  totalAds: number;
  error: string | null;
};

type ProjectLogItem = {
  id: string;
  projectName: string;
  runId: string;
  ga4Inserted: number;
  adsInserted: number;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
};

type TabKey = "activity" | "runs" | "projects";

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return `${date.toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

export default function AdminLogsClient({
  activity,
  runs,
  projectLogs
}: {
  activity: ActivityItem[];
  runs: RunItem[];
  projectLogs: ProjectLogItem[];
}) {
  const [tab, setTab] = useState<TabKey>("activity");

  const runMap = useMemo(() => {
    const map = new Map<string, RunItem>();
    runs.forEach((run) => map.set(run.id, run));
    return map;
  }, [runs]);

  const tabs = [
    { key: "activity" as const, label: "Activity logs" },
    { key: "runs" as const, label: "Ingestion runs" },
    { key: "projects" as const, label: "Project fetches" }
  ];

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-center gap-6 border-b border-slate/200/70 pb-2 dark:border-slate-700">
        {tabs.map((item) => {
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`relative pb-2 text-xs font-semibold uppercase tracking-[0.28em] transition ${
                active
                  ? "text-slate dark:text-slate-100"
                  : "text-slate/50 hover:text-slate dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {item.label}
              {active ? (
                <span className="absolute left-0 right-0 -bottom-2 h-0.5 rounded-full bg-ocean dark:bg-sky-300" />
              ) : null}
            </button>
          );
        })}
      </div>

      {tab === "activity" ? (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>User</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {activity.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td>{formatDate(item.createdAt)}</td>
                  <td>{item.user?.name ?? item.user?.email ?? "System"}</td>
                  <td>
                    <span className="chip">{item.action}</span>
                  </td>
                  <td>
                    {item.entityType}
                    {item.entityId ? ` · ${item.entityId}` : ""}
                  </td>
                  <td>{item.message ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "runs" ? (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Started</th>
                <th>Finished</th>
                <th>Status</th>
                <th>Projects</th>
                <th>GA4 Rows</th>
                <th>Ads Rows</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-t border-slate-100">
                  <td>{formatDate(run.startedAt)}</td>
                  <td>{formatDate(run.finishedAt)}</td>
                  <td>
                    <span className="chip">{run.status}</span>
                  </td>
                  <td>{run.totalProjects}</td>
                  <td>{run.totalGa4}</td>
                  <td>{run.totalAds}</td>
                  <td>{run.error ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "projects" ? (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Run</th>
                <th>Started</th>
                <th>Finished</th>
                <th>GA4 Rows</th>
                <th>Ads Rows</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {projectLogs.map((log) => (
                <tr key={log.id} className="border-t border-slate-100">
                  <td>{log.projectName}</td>
                  <td>{formatDate(runMap.get(log.runId)?.startedAt ?? null)}</td>
                  <td>{formatDate(log.startedAt)}</td>
                  <td>{formatDate(log.finishedAt)}</td>
                  <td>{log.ga4Inserted}</td>
                  <td>{log.adsInserted}</td>
                  <td>{log.error ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import SortableHeader from "@/components/SortableHeader";
import StatusBadge from "@/components/StatusBadge";

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
  const [activitySortKey, setActivitySortKey] = useState<"time" | "user" | "action" | "entity" | "message">("time");
  const [activitySortDirection, setActivitySortDirection] = useState<"asc" | "desc">("desc");
  const [runsSortKey, setRunsSortKey] = useState<
    "started" | "finished" | "status" | "projects" | "ga4" | "ads" | "error"
  >("started");
  const [runsSortDirection, setRunsSortDirection] = useState<"asc" | "desc">("desc");
  const [projectsSortKey, setProjectsSortKey] = useState<
    "project" | "run" | "started" | "finished" | "status" | "ga4" | "ads" | "error"
  >("started");
  const [projectsSortDirection, setProjectsSortDirection] = useState<"asc" | "desc">("desc");

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

  function toggleActivitySort(key: "time" | "user" | "action" | "entity" | "message") {
    if (activitySortKey === key) {
      setActivitySortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setActivitySortKey(key);
    setActivitySortDirection("asc");
  }

  function toggleRunsSort(key: "started" | "finished" | "status" | "projects" | "ga4" | "ads" | "error") {
    if (runsSortKey === key) {
      setRunsSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setRunsSortKey(key);
    setRunsSortDirection("asc");
  }

  function toggleProjectsSort(
    key: "project" | "run" | "started" | "finished" | "status" | "ga4" | "ads" | "error"
  ) {
    if (projectsSortKey === key) {
      setProjectsSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setProjectsSortKey(key);
    setProjectsSortDirection("asc");
  }

  const sortedActivity = useMemo(() => {
    const direction = activitySortDirection === "asc" ? 1 : -1;
    return [...activity].sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      const aUser = (a.user?.name ?? a.user?.email ?? "system").toLowerCase();
      const bUser = (b.user?.name ?? b.user?.email ?? "system").toLowerCase();
      const aAction = a.action.toLowerCase();
      const bAction = b.action.toLowerCase();
      const aEntity = `${a.entityType} ${a.entityId ?? ""}`.toLowerCase();
      const bEntity = `${b.entityType} ${b.entityId ?? ""}`.toLowerCase();
      const aMessage = (a.message ?? "").toLowerCase();
      const bMessage = (b.message ?? "").toLowerCase();

      let compare = 0;
      if (activitySortKey === "time") compare = aTime - bTime;
      else if (activitySortKey === "user") compare = aUser.localeCompare(bUser);
      else if (activitySortKey === "action") compare = aAction.localeCompare(bAction);
      else if (activitySortKey === "entity") compare = aEntity.localeCompare(bEntity);
      else compare = aMessage.localeCompare(bMessage);

      if (compare === 0) compare = aTime - bTime;
      return compare * direction;
    });
  }, [activity, activitySortDirection, activitySortKey]);

  const sortedRuns = useMemo(() => {
    const direction = runsSortDirection === "asc" ? 1 : -1;
    return [...runs].sort((a, b) => {
      const aStarted = new Date(a.startedAt).getTime();
      const bStarted = new Date(b.startedAt).getTime();
      const aFinished = a.finishedAt ? new Date(a.finishedAt).getTime() : 0;
      const bFinished = b.finishedAt ? new Date(b.finishedAt).getTime() : 0;
      const aStatus = a.status.toLowerCase();
      const bStatus = b.status.toLowerCase();
      const aError = (a.error ?? "").toLowerCase();
      const bError = (b.error ?? "").toLowerCase();

      let compare = 0;
      if (runsSortKey === "started") compare = aStarted - bStarted;
      else if (runsSortKey === "finished") compare = aFinished - bFinished;
      else if (runsSortKey === "status") compare = aStatus.localeCompare(bStatus);
      else if (runsSortKey === "projects") compare = a.totalProjects - b.totalProjects;
      else if (runsSortKey === "ga4") compare = a.totalGa4 - b.totalGa4;
      else if (runsSortKey === "ads") compare = a.totalAds - b.totalAds;
      else compare = aError.localeCompare(bError);

      if (compare === 0) compare = aStarted - bStarted;
      return compare * direction;
    });
  }, [runs, runsSortDirection, runsSortKey]);

  const sortedProjectLogs = useMemo(() => {
    const direction = projectsSortDirection === "asc" ? 1 : -1;
    return [...projectLogs].sort((a, b) => {
      const aRun = runMap.get(a.runId)?.startedAt ?? "";
      const bRun = runMap.get(b.runId)?.startedAt ?? "";
      const aStarted = new Date(a.startedAt).getTime();
      const bStarted = new Date(b.startedAt).getTime();
      const aFinished = a.finishedAt ? new Date(a.finishedAt).getTime() : 0;
      const bFinished = b.finishedAt ? new Date(b.finishedAt).getTime() : 0;
      const aError = (a.error ?? "").toLowerCase();
      const bError = (b.error ?? "").toLowerCase();

      const aStatus = a.error ? "FAILED" : a.finishedAt ? "COMPLETED" : "RUNNING";
      const bStatus = b.error ? "FAILED" : b.finishedAt ? "COMPLETED" : "RUNNING";

      let compare = 0;
      if (projectsSortKey === "project") compare = a.projectName.localeCompare(b.projectName);
      else if (projectsSortKey === "run") compare = aRun.localeCompare(bRun);
      else if (projectsSortKey === "started") compare = aStarted - bStarted;
      else if (projectsSortKey === "finished") compare = aFinished - bFinished;
      else if (projectsSortKey === "status") compare = aStatus.localeCompare(bStatus);
      else if (projectsSortKey === "ga4") compare = a.ga4Inserted - b.ga4Inserted;
      else if (projectsSortKey === "ads") compare = a.adsInserted - b.adsInserted;
      else compare = aError.localeCompare(bError);

      if (compare === 0) compare = aStarted - bStarted;
      return compare * direction;
    });
  }, [projectLogs, projectsSortDirection, projectsSortKey, runMap]);

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
                <th>
                  <SortableHeader
                    label="Time"
                    active={activitySortKey === "time"}
                    direction={activitySortDirection}
                    onClick={() => toggleActivitySort("time")}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="User"
                    active={activitySortKey === "user"}
                    direction={activitySortDirection}
                    onClick={() => toggleActivitySort("user")}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Action"
                    active={activitySortKey === "action"}
                    direction={activitySortDirection}
                    onClick={() => toggleActivitySort("action")}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Entity"
                    active={activitySortKey === "entity"}
                    direction={activitySortDirection}
                    onClick={() => toggleActivitySort("entity")}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Message"
                    active={activitySortKey === "message"}
                    direction={activitySortDirection}
                    onClick={() => toggleActivitySort("message")}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedActivity.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td>{formatDate(item.createdAt)}</td>
                  <td>{item.user?.name ?? item.user?.email ?? "System"}</td>
                  <td>
                    <StatusBadge label={item.action} />
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
                <th>
                  <SortableHeader
                    label="Started"
                    active={runsSortKey === "started"}
                    direction={runsSortDirection}
                    onClick={() => toggleRunsSort("started")}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Finished"
                    active={runsSortKey === "finished"}
                    direction={runsSortDirection}
                    onClick={() => toggleRunsSort("finished")}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Status"
                    active={runsSortKey === "status"}
                    direction={runsSortDirection}
                    onClick={() => toggleRunsSort("status")}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Projects"
                    active={runsSortKey === "projects"}
                    direction={runsSortDirection}
                    onClick={() => toggleRunsSort("projects")}
                    align="right"
                  />
                </th>
                <th>
                  <SortableHeader
                    label="GA4 Rows"
                    active={runsSortKey === "ga4"}
                    direction={runsSortDirection}
                    onClick={() => toggleRunsSort("ga4")}
                    align="right"
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Ads Rows"
                    active={runsSortKey === "ads"}
                    direction={runsSortDirection}
                    onClick={() => toggleRunsSort("ads")}
                    align="right"
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Error"
                    active={runsSortKey === "error"}
                    direction={runsSortDirection}
                    onClick={() => toggleRunsSort("error")}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRuns.map((run) => (
                <tr key={run.id} className="border-t border-slate-100">
                  <td>{formatDate(run.startedAt)}</td>
                  <td>{formatDate(run.finishedAt)}</td>
                  <td>
                    <StatusBadge label={run.status} />
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
                <th>
                  <SortableHeader
                    label="Project"
                    active={projectsSortKey === "project"}
                    direction={projectsSortDirection}
                    onClick={() => toggleProjectsSort("project")}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Run"
                    active={projectsSortKey === "run"}
                    direction={projectsSortDirection}
                    onClick={() => toggleProjectsSort("run")}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Started"
                    active={projectsSortKey === "started"}
                    direction={projectsSortDirection}
                    onClick={() => toggleProjectsSort("started")}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Finished"
                    active={projectsSortKey === "finished"}
                    direction={projectsSortDirection}
                    onClick={() => toggleProjectsSort("finished")}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Status"
                    active={projectsSortKey === "status"}
                    direction={projectsSortDirection}
                    onClick={() => toggleProjectsSort("status")}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="GA4 Rows"
                    active={projectsSortKey === "ga4"}
                    direction={projectsSortDirection}
                    onClick={() => toggleProjectsSort("ga4")}
                    align="right"
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Ads Rows"
                    active={projectsSortKey === "ads"}
                    direction={projectsSortDirection}
                    onClick={() => toggleProjectsSort("ads")}
                    align="right"
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Error"
                    active={projectsSortKey === "error"}
                    direction={projectsSortDirection}
                    onClick={() => toggleProjectsSort("error")}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedProjectLogs.map((log) => {
                const status = log.error ? "FAILED" : log.finishedAt ? "COMPLETED" : "RUNNING";
                return (
                  <tr key={log.id} className="border-t border-slate-100">
                    <td>{log.projectName}</td>
                    <td>{formatDate(runMap.get(log.runId)?.startedAt ?? null)}</td>
                    <td>{formatDate(log.startedAt)}</td>
                    <td>{formatDate(log.finishedAt)}</td>
                    <td>
                      <StatusBadge label={status} />
                    </td>
                    <td>{log.ga4Inserted}</td>
                    <td>{log.adsInserted}</td>
                    <td>{log.error ?? "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

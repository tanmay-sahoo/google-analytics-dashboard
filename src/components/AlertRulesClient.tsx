"use client";

import { useMemo, useState } from "react";
import FlashMessage, { inferTone } from "@/components/FlashMessage";
import SortableHeader from "@/components/SortableHeader";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import { METRICS_CATALOG } from "@/lib/metrics-catalog";

type Project = { id: string; name: string };

type WindowUnit = "MINUTES" | "HOURS" | "DAYS" | "WEEKS" | "MONTHS";
type Aggregation = "LATEST" | "SUM" | "AVG";

type AlertRule = {
  id: string;
  projectId: string;
  metric: string;
  scope: string;
  condition: "GT" | "LT" | "PCT_CHANGE";
  threshold: number;
  windowAmount: number;
  windowUnit: WindowUnit;
  aggregation: Aggregation;
  evaluateEveryMins: number;
  cooldownMins: number;
  enabled: boolean;
  project: { name: string };
};

const WINDOW_UNITS: { value: WindowUnit; label: string }[] = [
  { value: "MINUTES", label: "Minutes" },
  { value: "HOURS", label: "Hours" },
  { value: "DAYS", label: "Days" },
  { value: "WEEKS", label: "Weeks" },
  { value: "MONTHS", label: "Months" }
];

const AGGREGATIONS: { value: Aggregation; label: string }[] = [
  { value: "LATEST", label: "Latest value" },
  { value: "SUM", label: "Sum over window" },
  { value: "AVG", label: "Average over window" }
];

const EVAL_PRESETS: { mins: number; label: string }[] = [
  { mins: 5, label: "5 min" },
  { mins: 15, label: "15 min" },
  { mins: 60, label: "1 hour" },
  { mins: 360, label: "6 hours" },
  { mins: 720, label: "12 hours" },
  { mins: 1440, label: "1 day" }
];

function describeWindow(amount: number, unit: WindowUnit) {
  const safeAmount = Math.max(1, Math.round(amount));
  const lower = unit.toLowerCase();
  const label = safeAmount === 1 ? lower.replace(/s$/, "") : lower;
  return `${safeAmount} ${label}`;
}

function describeEvalEvery(mins: number) {
  if (!mins || mins <= 0) return "—";
  if (mins < 60) return `every ${mins} min`;
  if (mins % 1440 === 0) {
    const days = mins / 1440;
    return `every ${days} day${days === 1 ? "" : "s"}`;
  }
  if (mins % 60 === 0) {
    const hours = mins / 60;
    return `every ${hours} hour${hours === 1 ? "" : "s"}`;
  }
  return `every ${mins} min`;
}

export default function AlertRulesClient({
  projects,
  initialRules
}: {
  projects: Project[];
  initialRules: AlertRule[];
}) {
  const [rules, setRules] = useState(initialRules);
  const [message, setMessage] = useState<string | null>(null);
  const messageTone = inferTone(message);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [deletingRule, setDeletingRule] = useState<AlertRule | null>(null);
  const [sortKey, setSortKey] = useState<
    "project" | "metric" | "condition" | "threshold" | "window" | "evalAgg" | "status"
  >("project");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const [createWindowAmount, setCreateWindowAmount] = useState(1);
  const [createWindowUnit, setCreateWindowUnit] = useState<WindowUnit>("DAYS");
  const [createEvalMins, setCreateEvalMins] = useState(60);

  async function fetchRules() {
    const response = await fetch("/api/alerts");
    if (!response.ok) {
      setMessage("Failed to load alert rules.");
      return;
    }
    const data = await response.json().catch(() => ({}));
    setRules(Array.isArray(data.rules) ? data.rules : []);
  }

  function resetCreateForm() {
    setCreateWindowAmount(1);
    setCreateWindowUnit("DAYS");
    setCreateEvalMins(60);
  }

  async function createRule(form: HTMLFormElement) {
    setSaving(true);
    const formData = new FormData(form);
    const payload = {
      projectId: String(formData.get("projectId")),
      metric: String(formData.get("metric")),
      scope: "PROJECT",
      condition: String(formData.get("condition")),
      threshold: Number(formData.get("threshold")),
      windowAmount: Math.max(1, Number(formData.get("windowAmount")) || 1),
      windowUnit: String(formData.get("windowUnit")) as WindowUnit,
      aggregation: String(formData.get("aggregation")) as Aggregation,
      evaluateEveryMins: Math.max(5, Number(formData.get("evaluateEveryMins")) || 60),
      channels: { email: true, slackWebhook: formData.get("slackWebhook") || null },
      cooldownMins: Math.max(0, Number(formData.get("cooldownMins")) || 60),
      enabled: true
    };

    const response = await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Failed to create alert rule.");
      setSaving(false);
      return;
    }

    await fetchRules();
    form.reset();
    resetCreateForm();
    setCreateOpen(false);
    setMessage("Alert rule created.");
    setSaving(false);
  }

  async function saveEdit(form: HTMLFormElement) {
    if (!editingRule) return;
    setSaving(true);
    const formData = new FormData(form);
    const payload = {
      metric: String(formData.get("metric")),
      condition: String(formData.get("condition")),
      threshold: Number(formData.get("threshold")),
      windowAmount: Math.max(1, Number(formData.get("windowAmount")) || 1),
      windowUnit: String(formData.get("windowUnit")) as WindowUnit,
      aggregation: String(formData.get("aggregation")) as Aggregation,
      evaluateEveryMins: Math.max(5, Number(formData.get("evaluateEveryMins")) || 60),
      cooldownMins: Math.max(0, Number(formData.get("cooldownMins")) || 60),
      enabled: String(formData.get("enabled")) === "on"
    };

    const response = await fetch(`/api/alerts/${editingRule.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setMessage(data.error ?? "Failed to update alert rule.");
      setSaving(false);
      return;
    }

    await fetchRules();
    setEditingRule(null);
    setMessage("Alert rule updated.");
    setSaving(false);
  }

  async function confirmDeleteRule() {
    if (!deletingRule) return;
    setSaving(true);
    const response = await fetch(`/api/alerts/${deletingRule.id}`, { method: "DELETE" });
    if (!response.ok) {
      setMessage("Failed to delete alert rule.");
      setSaving(false);
      return;
    }
    await fetchRules();
    setDeletingRule(null);
    setMessage("Alert rule deleted.");
    setSaving(false);
  }

  function toggleSort(
    key: "project" | "metric" | "condition" | "threshold" | "window" | "evalAgg" | "status"
  ) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  }

  const sortedRules = useMemo(() => {
    const direction = sortDirection === "asc" ? 1 : -1;
    return [...rules].sort((a, b) => {
      let compare = 0;
      if (sortKey === "project") compare = a.project.name.localeCompare(b.project.name);
      else if (sortKey === "metric") compare = a.metric.localeCompare(b.metric);
      else if (sortKey === "condition") compare = a.condition.localeCompare(b.condition);
      else if (sortKey === "threshold") compare = a.threshold - b.threshold;
      else if (sortKey === "window") compare = a.windowAmount - b.windowAmount;
      else if (sortKey === "evalAgg") compare = a.evaluateEveryMins - b.evaluateEveryMins;
      else compare = Number(a.enabled) - Number(b.enabled);

      if (compare === 0) compare = a.project.name.localeCompare(b.project.name);
      return compare * direction;
    });
  }, [rules, sortDirection, sortKey]);

  const noProjects = projects.length === 0;

  return (
    <div className="space-y-6">
      <FlashMessage message={message} tone={messageTone} onDismiss={() => setMessage(null)} />

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="label">Alert rules</div>
            <p className="mt-1 text-xs text-slate/60">
              Define metrics, thresholds, and how often each rule should be evaluated.
            </p>
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              if (noProjects) {
                setMessage("No projects available — create a project first.");
                return;
              }
              resetCreateForm();
              setCreateOpen(true);
            }}
          >
            + Create alert
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="whitespace-nowrap pr-6">
                  <SortableHeader
                    label="Project"
                    active={sortKey === "project"}
                    direction={sortDirection}
                    onClick={() => toggleSort("project")}
                  />
                </th>
                <th className="whitespace-nowrap pr-6">
                  <SortableHeader
                    label="Metric"
                    active={sortKey === "metric"}
                    direction={sortDirection}
                    onClick={() => toggleSort("metric")}
                  />
                </th>
                <th className="whitespace-nowrap pr-6">
                  <SortableHeader
                    label="Condition"
                    active={sortKey === "condition"}
                    direction={sortDirection}
                    onClick={() => toggleSort("condition")}
                  />
                </th>
                <th className="whitespace-nowrap pr-6 text-right">
                  <SortableHeader
                    label="Threshold"
                    active={sortKey === "threshold"}
                    direction={sortDirection}
                    onClick={() => toggleSort("threshold")}
                    align="right"
                  />
                </th>
                <th className="whitespace-nowrap pr-6">
                  <SortableHeader
                    label="Window"
                    active={sortKey === "window"}
                    direction={sortDirection}
                    onClick={() => toggleSort("window")}
                  />
                </th>
                <th className="whitespace-nowrap pr-6">
                  <SortableHeader
                    label="Evaluate / Aggregate"
                    active={sortKey === "evalAgg"}
                    direction={sortDirection}
                    onClick={() => toggleSort("evalAgg")}
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
              {sortedRules.length === 0 ? (
                <tr className="border-t border-slate-100">
                  <td colSpan={8} className="py-2">
                    <EmptyState
                      title="No alert rules yet"
                      description='Click "Create alert" to add your first rule.'
                    />
                  </td>
                </tr>
              ) : (
                sortedRules.map((rule) => (
                  <tr key={rule.id} className="border-t border-slate-100 align-top">
                    <td className="whitespace-nowrap pr-6">{rule.project.name}</td>
                    <td className="whitespace-nowrap pr-6">{rule.metric}</td>
                    <td className="whitespace-nowrap pr-6">{rule.condition}</td>
                    <td className="whitespace-nowrap pr-6 text-right">{rule.threshold}</td>
                    <td className="whitespace-nowrap pr-6">{describeWindow(rule.windowAmount, rule.windowUnit)}</td>
                    <td className="whitespace-nowrap pr-6 text-xs text-slate/60">
                      {describeEvalEvery(rule.evaluateEveryMins)} · {rule.aggregation.toLowerCase()}
                    </td>
                    <td className="whitespace-nowrap pr-6">
                      <StatusBadge label={rule.enabled ? "Active" : "Paused"} />
                    </td>
                    <td className="whitespace-nowrap pr-2 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button className="btn-outline" type="button" onClick={() => setEditingRule(rule)}>
                          Edit
                        </button>
                        <button className="btn-outline" type="button" onClick={() => setDeletingRule(rule)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate/60 px-4">
          <div className="card max-h-[90vh] w-full max-w-3xl overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">Create alert rule</div>
                <p className="mt-1 text-xs text-slate/60">
                  The rule will be evaluated automatically on the cadence you choose.
                </p>
              </div>
              <button className="btn-outline" type="button" onClick={() => setCreateOpen(false)}>
                Close
              </button>
            </div>

            <form
              className="mt-5 space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                void createRule(event.currentTarget);
              }}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5 text-sm">
                  <div className="text-slate/70">Project</div>
                  <select name="projectId" className="input" required>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5 text-sm">
                  <div className="text-slate/70">Metric</div>
                  <select name="metric" className="input" required defaultValue="spend">
                    {METRICS_CATALOG.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="space-y-1.5 text-sm">
                  <div className="text-slate/70">Condition</div>
                  <select name="condition" className="input" required>
                    <option value="GT">&gt; threshold</option>
                    <option value="LT">&lt; threshold</option>
                    <option value="PCT_CHANGE">% change</option>
                  </select>
                </label>
                <label className="space-y-1.5 text-sm md:col-span-2">
                  <div className="text-slate/70">Threshold</div>
                  <input
                    name="threshold"
                    type="number"
                    step="any"
                    className="input"
                    placeholder="e.g. 1000"
                    required
                  />
                </label>
              </div>

              <div className="rounded-xl border border-slate/10 p-4">
                <div className="text-sm font-medium text-slate">Time window</div>
                <p className="mt-1 text-xs text-slate/60">
                  Look back over the last {describeWindow(createWindowAmount, createWindowUnit)} of data.
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <label className="space-y-1.5 text-sm">
                    <div className="text-xs text-slate/60">Last (amount)</div>
                    <input
                      name="windowAmount"
                      type="number"
                      min={1}
                      max={365}
                      className="input"
                      value={createWindowAmount}
                      onChange={(e) => setCreateWindowAmount(Number(e.target.value) || 1)}
                      required
                    />
                  </label>
                  <label className="space-y-1.5 text-sm">
                    <div className="text-xs text-slate/60">Unit</div>
                    <select
                      name="windowUnit"
                      className="input"
                      value={createWindowUnit}
                      onChange={(e) => setCreateWindowUnit(e.target.value as WindowUnit)}
                      required
                    >
                      {WINDOW_UNITS.map((u) => (
                        <option key={u.value} value={u.value}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1.5 text-sm">
                    <div className="text-xs text-slate/60">Aggregation</div>
                    <select name="aggregation" className="input" defaultValue="LATEST">
                      {AGGREGATIONS.map((a) => (
                        <option key={a.value} value={a.value}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="rounded-xl border border-slate/10 p-4">
                <div className="text-sm font-medium text-slate">Evaluation cadence</div>
                <p className="mt-1 text-xs text-slate/60">
                  Re-check this rule {describeEvalEvery(createEvalMins)}.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {EVAL_PRESETS.map((preset) => (
                    <button
                      key={preset.mins}
                      type="button"
                      onClick={() => setCreateEvalMins(preset.mins)}
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                        createEvalMins === preset.mins
                          ? "border-ocean bg-ocean/10 text-ocean"
                          : "border-slate/20 text-slate/70 hover:border-slate/40"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="space-y-1.5 text-sm">
                    <div className="text-xs text-slate/60">Or evaluate every (minutes)</div>
                    <input
                      name="evaluateEveryMins"
                      type="number"
                      min={5}
                      className="input"
                      value={createEvalMins}
                      onChange={(e) => setCreateEvalMins(Math.max(5, Number(e.target.value) || 5))}
                      required
                    />
                  </label>
                  <label className="space-y-1.5 text-sm">
                    <div className="text-xs text-slate/60">Cooldown after firing (minutes)</div>
                    <input
                      name="cooldownMins"
                      type="number"
                      min={0}
                      className="input"
                      placeholder="60"
                      defaultValue={60}
                    />
                  </label>
                </div>
              </div>

              <label className="space-y-1.5 text-sm">
                <div className="text-slate/70">Slack webhook (optional)</div>
                <input name="slackWebhook" className="input" placeholder="https://hooks.slack.com/..." />
              </label>

              <p className="text-xs text-slate/60">
                Tip: sub-day windows (minutes/hours) only produce meaningful alerts if your ingestion runs at least as
                often as the window.
              </p>

              <div className="flex justify-end gap-2">
                <button className="btn-outline" type="button" onClick={() => setCreateOpen(false)}>
                  Cancel
                </button>
                <button className="btn-primary" type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Create alert"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editingRule ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate/60 px-4">
          <div className="card max-h-[90vh] w-full max-w-2xl overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">Edit alert rule</div>
              <button className="btn-outline" type="button" onClick={() => setEditingRule(null)}>
                Close
              </button>
            </div>
            <form
              className="mt-4 grid gap-4 md:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                void saveEdit(event.currentTarget);
              }}
            >
              <label className="space-y-1.5 text-sm">
                <div className="text-slate/70">Metric</div>
                <select name="metric" className="input" defaultValue={editingRule.metric} required>
                  {METRICS_CATALOG.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5 text-sm">
                <div className="text-slate/70">Condition</div>
                <select name="condition" className="input" defaultValue={editingRule.condition} required>
                  <option value="GT">&gt; threshold</option>
                  <option value="LT">&lt; threshold</option>
                  <option value="PCT_CHANGE">% change</option>
                </select>
              </label>
              <label className="space-y-1.5 text-sm">
                <div className="text-slate/70">Threshold</div>
                <input
                  name="threshold"
                  type="number"
                  step="any"
                  className="input"
                  defaultValue={editingRule.threshold}
                  required
                />
              </label>
              <label className="space-y-1.5 text-sm">
                <div className="text-slate/70">Aggregation</div>
                <select name="aggregation" className="input" defaultValue={editingRule.aggregation}>
                  {AGGREGATIONS.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5 text-sm">
                <div className="text-slate/70">Window amount</div>
                <input
                  name="windowAmount"
                  type="number"
                  min={1}
                  max={365}
                  className="input"
                  defaultValue={editingRule.windowAmount}
                  required
                />
              </label>
              <label className="space-y-1.5 text-sm">
                <div className="text-slate/70">Window unit</div>
                <select name="windowUnit" className="input" defaultValue={editingRule.windowUnit}>
                  {WINDOW_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5 text-sm">
                <div className="text-slate/70">Evaluate every (mins)</div>
                <input
                  name="evaluateEveryMins"
                  type="number"
                  min={5}
                  className="input"
                  defaultValue={editingRule.evaluateEveryMins}
                />
              </label>
              <label className="space-y-1.5 text-sm">
                <div className="text-slate/70">Cooldown (mins)</div>
                <input
                  name="cooldownMins"
                  type="number"
                  className="input"
                  defaultValue={editingRule.cooldownMins}
                  required
                />
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-slate/10 px-4 py-3 text-sm md:col-span-2">
                <input name="enabled" type="checkbox" defaultChecked={editingRule.enabled} />
                <span className="text-slate/70">Enabled</span>
              </label>
              <div className="md:col-span-2 flex justify-end gap-2">
                <button className="btn-outline" type="button" onClick={() => setEditingRule(null)}>
                  Cancel
                </button>
                <button className="btn-primary" type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deletingRule ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate/60 px-4">
          <div className="card w-full max-w-lg">
            <div className="text-lg font-semibold">Delete alert rule</div>
            <p className="mt-2 text-sm text-slate/60">
              Delete rule for <span className="font-semibold text-slate">{deletingRule.project.name}</span> (
              {deletingRule.metric})?
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button className="btn-outline" type="button" onClick={() => setDeletingRule(null)}>
                Cancel
              </button>
              <button className="btn-primary" type="button" onClick={() => void confirmDeleteRule()} disabled={saving}>
                {saving ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

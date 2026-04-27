"use client";

import { useMemo, useState } from "react";
import FlashMessage, { inferTone } from "@/components/FlashMessage";
import SortableHeader from "@/components/SortableHeader";

type Project = { id: string; name: string };

type AlertRule = {
  id: string;
  projectId: string;
  metric: string;
  scope: string;
  condition: "GT" | "LT" | "PCT_CHANGE";
  threshold: number;
  window: "TODAY" | "YESTERDAY" | "LAST_7_DAYS";
  frequency: string;
  cooldownMins: number;
  enabled: boolean;
  project: { name: string };
};

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
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [deletingRule, setDeletingRule] = useState<AlertRule | null>(null);
  const [sortKey, setSortKey] = useState<
    "project" | "metric" | "condition" | "threshold" | "window" | "status" | "actions"
  >("project");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  async function fetchRules() {
    const response = await fetch("/api/alerts");
    if (!response.ok) {
      setMessage("Failed to load alert rules.");
      return;
    }
    const data = await response.json().catch(() => ({}));
    setRules(Array.isArray(data.rules) ? data.rules : []);
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
      window: String(formData.get("window")),
      frequency: "DAILY_9AM",
      channels: { email: true, slackWebhook: formData.get("slackWebhook") || null },
      cooldownMins: Number(formData.get("cooldownMins")) || 60,
      enabled: true
    };

    const response = await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      setMessage("Failed to create alert rule.");
      setSaving(false);
      return;
    }

    await fetchRules();
    form.reset();
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
      window: String(formData.get("window")),
      cooldownMins: Number(formData.get("cooldownMins")) || 60,
      enabled: String(formData.get("enabled")) === "on"
    };

    const response = await fetch(`/api/alerts/${editingRule.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      setMessage("Failed to update alert rule.");
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
    key: "project" | "metric" | "condition" | "threshold" | "window" | "status" | "actions"
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
      else if (sortKey === "window") compare = a.window.localeCompare(b.window);
      else if (sortKey === "status") compare = Number(a.enabled) - Number(b.enabled);
      else compare = a.id.localeCompare(b.id);

      if (compare === 0) compare = a.project.name.localeCompare(b.project.name);
      return compare * direction;
    });
  }, [rules, sortDirection, sortKey]);

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="label">Create alert</div>
        <form
          className="mt-4 grid gap-4 md:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            void createRule(event.currentTarget);
          }}
        >
          <select name="projectId" className="input" required>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <select name="metric" className="input" required>
            <option value="spend">Spend</option>
            <option value="sessions">Sessions</option>
            <option value="roas">ROAS</option>
          </select>
          <select name="condition" className="input" required>
            <option value="GT">&gt; threshold</option>
            <option value="LT">&lt; threshold</option>
            <option value="PCT_CHANGE">% change</option>
          </select>
          <input name="threshold" type="number" className="input" placeholder="Threshold" required />
          <select name="window" className="input" required>
            <option value="TODAY">Today</option>
            <option value="YESTERDAY">Yesterday</option>
            <option value="LAST_7_DAYS">Last 7 days</option>
          </select>
          <input name="cooldownMins" type="number" className="input" placeholder="Cooldown (mins)" />
          <input name="slackWebhook" className="input" placeholder="Slack webhook (optional)" />
          <button className="btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Create"}
          </button>
        </form>
        <FlashMessage message={message} tone={messageTone} onDismiss={() => setMessage(null)} />
      </div>

      <div className="card">
        <div className="label">Alert rules</div>
        <div className="mt-4 overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>
                  <SortableHeader
                    label="Project"
                    active={sortKey === "project"}
                    direction={sortDirection}
                    onClick={() => toggleSort("project")}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Metric"
                    active={sortKey === "metric"}
                    direction={sortDirection}
                    onClick={() => toggleSort("metric")}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Condition"
                    active={sortKey === "condition"}
                    direction={sortDirection}
                    onClick={() => toggleSort("condition")}
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Threshold"
                    active={sortKey === "threshold"}
                    direction={sortDirection}
                    onClick={() => toggleSort("threshold")}
                    align="right"
                  />
                </th>
                <th>
                  <SortableHeader
                    label="Window"
                    active={sortKey === "window"}
                    direction={sortDirection}
                    onClick={() => toggleSort("window")}
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
                    label="Actions"
                    active={sortKey === "actions"}
                    direction={sortDirection}
                    onClick={() => toggleSort("actions")}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRules.map((rule) => (
                <tr key={rule.id} className="border-t border-slate-100">
                  <td>{rule.project.name}</td>
                  <td>{rule.metric}</td>
                  <td>{rule.condition}</td>
                  <td className="text-right">{rule.threshold}</td>
                  <td>{rule.window}</td>
                  <td>{rule.enabled ? "Active" : "Paused"}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button className="btn-outline" type="button" onClick={() => setEditingRule(rule)}>
                        Edit
                      </button>
                      <button className="btn-outline" type="button" onClick={() => setDeletingRule(rule)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editingRule ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate/60 px-4">
          <div className="card w-full max-w-2xl">
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
              <label className="space-y-2 text-sm">
                <div className="text-slate/70">Metric</div>
                <input name="metric" className="input" defaultValue={editingRule.metric} required />
              </label>
              <label className="space-y-2 text-sm">
                <div className="text-slate/70">Condition</div>
                <select name="condition" className="input" defaultValue={editingRule.condition} required>
                  <option value="GT">&gt; threshold</option>
                  <option value="LT">&lt; threshold</option>
                  <option value="PCT_CHANGE">% change</option>
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <div className="text-slate/70">Threshold</div>
                <input
                  name="threshold"
                  type="number"
                  className="input"
                  defaultValue={editingRule.threshold}
                  required
                />
              </label>
              <label className="space-y-2 text-sm">
                <div className="text-slate/70">Window</div>
                <select name="window" className="input" defaultValue={editingRule.window} required>
                  <option value="TODAY">Today</option>
                  <option value="YESTERDAY">Yesterday</option>
                  <option value="LAST_7_DAYS">Last 7 days</option>
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <div className="text-slate/70">Cooldown (mins)</div>
                <input
                  name="cooldownMins"
                  type="number"
                  className="input"
                  defaultValue={editingRule.cooldownMins}
                  required
                />
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-slate/10 px-4 py-3 text-sm">
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


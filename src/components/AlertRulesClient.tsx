"use client";

import { useState } from "react";

type Project = { id: string; name: string };

type AlertRule = {
  id: string;
  metric: string;
  scope: string;
  condition: string;
  threshold: number;
  window: string;
  frequency: string;
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

  async function createRule(form: HTMLFormElement) {
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

    if (response.ok) {
      const refetch = await fetch("/api/alerts");
      if (refetch.ok) {
        const data = await refetch.json();
        setRules(data.rules);
        setMessage("Alert rule created.");
      }
    } else {
      setMessage("Failed to create alert rule.");
    }
  }

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
          <button className="btn-primary">Create</button>
        </form>
        {message ? <div className="mt-3 text-sm text-slate/60">{message}</div> : null}
      </div>

      <div className="card">
        <div className="label">Alert rules</div>
        <div className="mt-4 overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Metric</th>
                <th>Condition</th>
                <th>Threshold</th>
                <th>Window</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-t border-slate-100">
                  <td>{rule.project.name}</td>
                  <td>{rule.metric}</td>
                  <td>{rule.condition}</td>
                  <td>{rule.threshold}</td>
                  <td>{rule.window}</td>
                  <td>{rule.enabled ? "Active" : "Paused"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

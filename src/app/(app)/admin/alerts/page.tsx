import { prisma } from "@/lib/prisma";
import Table from "@/components/Table";

export default async function AdminAlertsPage() {
  const rules = await prisma.alertRule.findMany({
    include: { project: true },
    orderBy: { createdAt: "desc" }
  });
  const events = await prisma.alertEvent.findMany({
    include: { project: true, rule: true },
    orderBy: { evaluatedAt: "desc" }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Alert Control</h1>
        <p className="text-sm text-slate/60">All rules and alert events across projects.</p>
      </div>

      <Table
        headers={["Project", "Metric", "Condition", "Threshold", "Window", "Status"]}
        rows={rules.map((rule) => [
          rule.project.name,
          rule.metric,
          rule.condition,
          String(rule.threshold),
          `${rule.windowAmount} ${rule.windowUnit.toLowerCase()}`,
          rule.enabled ? "Active" : "Paused"
        ])}
      />

      <Table
        headers={["Project", "Rule", "Value", "Evaluated", "Status"]}
        rows={events.map((event) => [
          event.project.name,
          event.rule.metric,
          String(event.value),
          event.evaluatedAt.toISOString().slice(0, 10),
          event.status
        ])}
      />
    </div>
  );
}

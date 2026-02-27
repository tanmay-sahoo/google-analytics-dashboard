import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AlertRulesClient from "@/components/AlertRulesClient";

export default async function AlertsPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user;

  if (!user) {
    return null;
  }

  const projects = await prisma.project.findMany({
    where: user.role === "ADMIN" ? {} : { projectUsers: { some: { userId: user.id } } },
    orderBy: { createdAt: "desc" }
  });

  const rules = await prisma.alertRule.findMany({
    where:
      user.role === "ADMIN"
        ? {}
        : { project: { projectUsers: { some: { userId: user.id } } } },
    include: { project: true },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Alerts</h1>
        <p className="text-sm text-slate/60">Set thresholds and monitor daily changes.</p>
      </div>
      <AlertRulesClient
        projects={projects.map((project) => ({ id: project.id, name: project.name }))}
        initialRules={rules.map((rule) => ({
          id: rule.id,
          metric: rule.metric,
          scope: rule.scope,
          condition: rule.condition,
          threshold: rule.threshold,
          window: rule.window,
          frequency: rule.frequency,
          enabled: rule.enabled,
          project: { name: rule.project.name }
        }))}
      />
    </div>
  );
}

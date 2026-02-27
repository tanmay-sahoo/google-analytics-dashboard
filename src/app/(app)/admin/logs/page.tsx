import { prisma } from "@/lib/prisma";
import AdminLogsClient from "@/components/AdminLogsClient";

export default async function AdminLogsPage() {
  const [activity, runs, projectLogs] = await Promise.all([
    prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { id: true, name: true, email: true } } }
    }),
    prisma.ingestionRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 50
    }),
    prisma.ingestionProjectLog.findMany({
      orderBy: { startedAt: "desc" },
      take: 200,
      include: { project: { select: { id: true, name: true } } }
    })
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Logs</h1>
        <p className="text-sm text-slate/60">Audit activity and ingestion history.</p>
      </div>
      <AdminLogsClient
        activity={activity.map((item) => ({
          id: item.id,
          action: item.action,
          entityType: item.entityType,
          entityId: item.entityId,
          message: item.message,
          createdAt: item.createdAt.toISOString(),
          user: item.user
            ? { name: item.user.name ?? null, email: item.user.email ?? null }
            : null
        }))}
        runs={runs.map((item) => ({
          id: item.id,
          status: item.status,
          startedAt: item.startedAt.toISOString(),
          finishedAt: item.finishedAt ? item.finishedAt.toISOString() : null,
          totalProjects: item.totalProjects,
          totalGa4: item.totalGa4,
          totalAds: item.totalAds,
          error: item.error
        }))}
        projectLogs={projectLogs.map((item) => ({
          id: item.id,
          projectName: item.project.name,
          runId: item.runId,
          ga4Inserted: item.ga4Inserted,
          adsInserted: item.adsInserted,
          error: item.error,
          startedAt: item.startedAt.toISOString(),
          finishedAt: item.finishedAt ? item.finishedAt.toISOString() : null
        }))}
      />
    </div>
  );
}

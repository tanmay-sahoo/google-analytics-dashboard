import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import DashboardClient from "@/components/DashboardClient";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchGa4Realtime } from "@/lib/ga4";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user;

  if (!user) {
    redirect("/signin");
  }

  const projects = await prisma.project.findMany({
    where: user.role === "ADMIN" ? {} : { projectUsers: { some: { userId: user.id } } },
    orderBy: { createdAt: "desc" }
  });

  const project = projects[0] ?? null;
  const daily = project
    ? await prisma.metricDaily.findMany({
        where: { projectId: project.id, source: "GA4" },
        orderBy: { date: "asc" },
        take: 30
      })
    : [];
  const latest = daily.at(-1)?.metrics as
    | { sessions?: number; users?: number; conversions?: number; revenue?: number }
    | undefined;

  let realtime = { activeUsers: 0, countries: [] as { label: string; value: number }[] };
  if (project) {
    const ga4Source = await prisma.dataSourceAccount.findFirst({
      where: { projectId: project.id, type: "GA4" }
    });
    const ga4Integration = await prisma.integrationSetting.findUnique({
      where: { type: "GA4" }
    });
    if (ga4Source?.externalId && ga4Integration?.refreshToken) {
      try {
        realtime = await fetchGa4Realtime({
          propertyId: ga4Source.externalId,
          refreshToken: ga4Integration.refreshToken
        });
      } catch {
        realtime = { activeUsers: 0, countries: [] };
      }
    }
  }

  return (
    <DashboardClient
      projects={projects.map((item) => ({ id: item.id, name: item.name }))}
      initialDashboard={
        project
          ? {
              currency: project.currency ?? "INR",
              kpis: {
                users: Number(latest?.users ?? 0),
                sessions: Number(latest?.sessions ?? 0),
                conversions: Number(latest?.conversions ?? 0),
                revenue: Number(latest?.revenue ?? 0)
              },
              trend: {
                dates: daily.map((item) => item.date.toISOString().slice(0, 10)),
                users: daily.map((item) => Number((item.metrics as any).users ?? 0)),
                sessions: daily.map((item) => Number((item.metrics as any).sessions ?? 0)),
                conversions: daily.map((item) => Number((item.metrics as any).conversions ?? 0)),
                revenue: daily.map((item) => Number((item.metrics as any).revenue ?? 0))
              },
              realtime,
              highlights: {
                events: [],
                sources: [],
                landingPages: [],
                userAcquisition: [],
                sessionAcquisition: [],
                countries: []
              },
              compare: null
            }
          : null
      }
    />
  );
}

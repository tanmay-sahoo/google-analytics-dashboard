import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateShort } from "@/lib/time";
import AdsIntelligenceFilters from "@/components/AdsIntelligenceFilters";
import AdsIntelligenceContent from "./AdsIntelligenceContent";
import { resolveFiltersFromRequest } from "@/lib/resolve-filters";
import {
  KPIGridSkeleton,
  ChartCardSkeleton,
  TableSkeleton
} from "@/components/skeletons";

export default async function AdsPage({
  searchParams
}: {
  searchParams?: Promise<{
    projectId?: string;
    range?: string;
    start?: string;
    end?: string;
    refresh?: string;
    tab?: string;
  }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const session = await getServerSession(authOptions);
  const user = session?.user;
  if (!user) return null;

  const projects = await prisma.project.findMany({
    where: user.role === "ADMIN" ? {} : { projectUsers: { some: { userId: user.id } } },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true }
  });

  if (!projects.length) {
    return <div className="alert">No projects available yet.</div>;
  }

  const filters = await resolveFiltersFromRequest({
    userId: user.id,
    projects,
    searchParams: resolvedSearchParams
  });
  if (!filters) return <div className="alert">No projects available yet.</div>;

  if (user.role !== "ADMIN") {
    const access = await prisma.projectUser.findUnique({
      where: { projectId_userId: { projectId: filters.projectId, userId: user.id } }
    });
    if (!access) {
      return <div className="alert">You do not have access to this project.</div>;
    }
  }

  const forceRefresh = resolvedSearchParams?.refresh === "1";
  const suspenseKey = `${filters.projectId}|${filters.rangeKey}|${formatDateShort(filters.start)}|${formatDateShort(filters.end)}|${forceRefresh ? "1" : "0"}`;

  return (
    <div className="space-y-6">
      <AdsIntelligenceFilters
        projects={projects}
        selectedProjectId={filters.projectId}
        range={filters.rangeKey}
        start={formatDateShort(filters.start)}
        end={formatDateShort(filters.end)}
      />

      <Suspense
        key={suspenseKey}
        fallback={
          <div className="space-y-6">
            <KPIGridSkeleton count={10} columnsClass="grid gap-4 md:grid-cols-2 xl:grid-cols-5" />
            <ChartCardSkeleton height={280} />
            <TableSkeleton rows={6} columns={8} />
            <div className="grid gap-4 xl:grid-cols-2">
              <TableSkeleton rows={5} columns={4} />
              <TableSkeleton rows={5} columns={4} />
            </div>
          </div>
        }
      >
        <AdsIntelligenceContent
          projectId={filters.projectId}
          start={filters.start}
          end={filters.end}
          rangeKey={filters.rangeKey}
          forceRefresh={forceRefresh}
          requestedTab={resolvedSearchParams?.tab}
        />
      </Suspense>
    </div>
  );
}

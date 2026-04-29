import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addDays, formatDateShort } from "@/lib/time";
import ProjectDetailClient from "@/components/ProjectDetailClient";
import Tabs from "@/components/Tabs";
import ProjectLogsDateFilter from "@/components/ProjectLogsDateFilter";
import { TableSkeleton } from "@/components/skeletons";
import { StorageTab, RowsTab, IngestionTab, ActivityTab } from "./_tabs";

type ProjectDetailTab = "storage" | "rows" | "ingestion" | "activity";
const PROJECT_DETAIL_TABS: ProjectDetailTab[] = ["storage", "rows", "ingestion", "activity"];

type LogsRangeKey = "last7" | "last30" | "last90" | "month" | "custom";
const LOGS_RANGE_KEYS: LogsRangeKey[] = ["last7", "last30", "last90", "month", "custom"];

function resolveLogsRange(range: LogsRangeKey, startParam?: string, endParam?: string) {
  const end = endParam ? new Date(endParam) : new Date();
  let start = startParam ? new Date(startParam) : addDays(end, -29);
  if (range === "last7") start = addDays(end, -6);
  else if (range === "last30") start = addDays(end, -29);
  else if (range === "last90") start = addDays(end, -89);
  else if (range === "month") start = new Date(end.getFullYear(), end.getMonth(), 1);
  return { start, end };
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export default async function ProjectDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    tab?: string;
    range?: string;
    start?: string;
    end?: string;
  }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const session = await getServerSession(authOptions);
  const user = session?.user;

  if (!user) {
    return null;
  }

  const project = await prisma.project.findUnique({
    where: { id: resolvedParams.id },
    include: { dataSources: true }
  });

  if (!project) {
    return notFound();
  }

  if (user.role !== "ADMIN") {
    const access = await prisma.projectUser.findUnique({
      where: { projectId_userId: { projectId: project.id, userId: user.id } }
    });
    if (!access) {
      return notFound();
    }
  }

  const requestedRange = resolvedSearchParams?.range as LogsRangeKey | undefined;
  const rangeKey: LogsRangeKey =
    requestedRange && LOGS_RANGE_KEYS.includes(requestedRange) ? requestedRange : "last30";
  const { start: rangeStart, end: rangeEnd } = resolveLogsRange(
    rangeKey,
    resolvedSearchParams?.start,
    resolvedSearchParams?.end
  );
  const rangeStartDay = startOfDay(rangeStart);
  const rangeEndDay = endOfDay(rangeEnd);

  const ga4Source = project.dataSources.find((item) => item.type === "GA4");
  const adsSource = project.dataSources.find((item) => item.type === "ADS");
  const merchantSource = project.dataSources.find((item) => item.type === "MERCHANT");
  const ga4Id = ga4Source?.externalId;
  const adsId = adsSource?.externalId;
  const merchantId = merchantSource?.externalId;
  const assignedMerchants = await prisma.dataSourceAccount.findMany({
    where: { type: "MERCHANT", projectId: { not: project.id } },
    select: { externalId: true }
  });
  const assignedMerchantIds = Array.from(
    new Set(assignedMerchants.map((item) => item.externalId).filter(Boolean))
  );

  const requestedTab = resolvedSearchParams?.tab as ProjectDetailTab | undefined;
  const activeTab: ProjectDetailTab =
    requestedTab && PROJECT_DETAIL_TABS.includes(requestedTab) ? requestedTab : "storage";

  const filterParams = new URLSearchParams({
    range: rangeKey,
    start: formatDateShort(rangeStart),
    end: formatDateShort(rangeEnd)
  });
  const tabHref = (key: string) => {
    const params = new URLSearchParams(filterParams);
    params.set("tab", key);
    return `/projects/${project.id}?${params.toString()}`;
  };
  const tabItems = [
    { key: "storage", label: "Storage summary" },
    { key: "rows", label: "Fetched rows" },
    { key: "ingestion", label: "Ingestion logs" },
    { key: "activity", label: "API activity" }
  ];

  // Each tab uses a stable React key tied to the active tab + range so that
  // navigating between tabs (or changing the range) drops the previous Suspense
  // boundary and remounts a fresh skeleton, instead of holding the last result.
  const suspenseKey = `${activeTab}:${rangeKey}:${formatDateShort(rangeStart)}:${formatDateShort(rangeEnd)}`;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">{project.name}</h1>
        <p className="text-sm text-slate/60">{project.timezone} - {project.currency}</p>
      </div>

      <ProjectDetailClient
        projectId={project.id}
        ga4Id={ga4Id}
        adsId={adsId}
        merchantId={merchantId}
        assignedMerchantIds={assignedMerchantIds}
        projectName={project.name}
        role={user.role}
      />

      <div className="space-y-4">
        <ProjectLogsDateFilter
          projectId={project.id}
          tab={activeTab}
          range={rangeKey}
          start={formatDateShort(rangeStart)}
          end={formatDateShort(rangeEnd)}
          urlHadRange={Boolean(resolvedSearchParams?.range)}
        />
        <Tabs
          ariaLabel="Project data tables"
          items={tabItems}
          activeKey={activeTab}
          buildHref={tabHref}
        />

        {activeTab === "storage" && (
          <Suspense
            key={suspenseKey}
            fallback={<TableSkeleton rows={4} columns={4} withTitle />}
          >
            <StorageTab projectId={project.id} />
          </Suspense>
        )}

        {activeTab === "rows" && (
          <Suspense
            key={suspenseKey}
            fallback={<TableSkeleton rows={6} columns={4} withTitle />}
          >
            <RowsTab projectId={project.id} rangeStart={rangeStartDay} rangeEnd={rangeEndDay} />
          </Suspense>
        )}

        {activeTab === "ingestion" && (
          <Suspense
            key={suspenseKey}
            fallback={<TableSkeleton rows={6} columns={7} withTitle />}
          >
            <IngestionTab projectId={project.id} rangeStart={rangeStartDay} rangeEnd={rangeEndDay} />
          </Suspense>
        )}

        {activeTab === "activity" && (
          <Suspense
            key={suspenseKey}
            fallback={<TableSkeleton rows={6} columns={6} withTitle />}
          >
            <ActivityTab projectId={project.id} rangeStart={rangeStartDay} rangeEnd={rangeEndDay} />
          </Suspense>
        )}
      </div>
    </div>
  );
}

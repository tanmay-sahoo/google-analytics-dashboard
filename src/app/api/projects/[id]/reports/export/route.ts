import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth-helpers";
import { addDays, formatDateShort } from "@/lib/time";
import { fetchGa4ProjectReports } from "@/lib/ga4";

function csvEscape(value: string | number) {
  const text = String(value);
  if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { dataSources: true }
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!isAdmin(user.role)) {
    const access = await prisma.projectUser.findUnique({
      where: { projectId_userId: { projectId: project.id, userId: user.id } }
    });
    if (!access) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const ga4Source = project.dataSources.find((item) => item.type === "GA4");
  const ga4Integration = await prisma.integrationSetting.findUnique({
    where: { type: "GA4" }
  });

  if (!ga4Source?.externalId || !ga4Integration?.refreshToken) {
    return NextResponse.json({ error: "GA4 not connected" }, { status: 400 });
  }

  const end = new Date();
  const start = addDays(end, -29);
  const reports = await fetchGa4ProjectReports({
    propertyId: ga4Source.externalId,
    refreshToken: ga4Integration.refreshToken,
    startDate: formatDateShort(start),
    endDate: formatDateShort(end)
  });

  const lines: string[] = [];
  lines.push(`Project,${csvEscape(project.name)}`);
  lines.push(`Range,${formatDateShort(start)} - ${formatDateShort(end)}`);
  lines.push("");
  lines.push("Summary,Value");
  lines.push(`Active users,${reports.summary.activeUsers}`);
  lines.push(`New users,${reports.summary.newUsers}`);
  lines.push(`Returning users,${reports.summary.returningUsers}`);
  lines.push(`Sessions,${reports.summary.sessions}`);
  lines.push(`Event count,${reports.summary.eventCount}`);
  lines.push(`Total revenue,${reports.summary.totalRevenue}`);
  lines.push(`Purchase revenue,${reports.summary.purchaseRevenue}`);
  lines.push(`Ecommerce purchases,${reports.summary.ecommercePurchases}`);
  lines.push("");
  lines.push("User acquisition,New users");
  reports.acquisitionUsers.forEach((row) => {
    lines.push(`${csvEscape(row.label)},${row.value}`);
  });
  lines.push("");
  lines.push("Traffic acquisition,Sessions");
  reports.acquisitionSessions.forEach((row) => {
    lines.push(`${csvEscape(row.label)},${row.value}`);
  });
  lines.push("");
  lines.push("Top events,Event count");
  reports.topEvents.forEach((row) => {
    lines.push(`${csvEscape(row.label)},${row.value}`);
  });
  lines.push("");
  lines.push("Top pages,Views");
  reports.topPages.forEach((row) => {
    lines.push(`${csvEscape(row.label)},${row.value}`);
  });

  const csv = lines.join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename=${project.name}-ga4-report.csv`
    }
  });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth-helpers";
import { getOAuthClient } from "@/lib/google-oauth";
import { google } from "googleapis";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const startDate = searchParams.get("start");
  const endDate = searchParams.get("end");

  if (!projectId || !startDate || !endDate) {
    return NextResponse.json({ error: "Missing projectId/start/end" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { dataSources: true }
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ga4Source = project.dataSources.find((item) => item.type === "GA4");
  const ga4Integration = await prisma.integrationSetting.findUnique({
    where: { type: "GA4" }
  });

  if (!ga4Source?.externalId || !ga4Integration?.refreshToken) {
    return NextResponse.json({ error: "GA4 not connected" }, { status: 400 });
  }

  const authClient = getOAuthClient();
  authClient.setCredentials({ refresh_token: ga4Integration.refreshToken });
  const analyticsData = google.analyticsdata({ version: "v1beta", auth: authClient });

  const response = await analyticsData.properties.runReport({
    property: `properties/${String(ga4Source.externalId)}`,
    requestBody: {
      dateRanges: [{ startDate, endDate }],
      metrics: [{ name: "itemsViewed" }],
      dimensions: [{ name: "itemName" }],
      orderBys: [{ desc: true, metric: { metricName: "itemsViewed" } }],
      limit: "50"
    }
  });

  return NextResponse.json({
    projectId,
    startDate,
    endDate,
    rows: response.data.rows ?? []
  });
}

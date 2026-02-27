import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth-helpers";
import { listGa4Properties } from "@/lib/ga4-admin";

const DEFAULT_TIMEZONE = "Asia/Kolkata";
const DEFAULT_CURRENCY = "INR";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const integration = await prisma.integrationSetting.findUnique({
    where: { type: "GA4" }
  });

  if (!integration?.refreshToken) {
    return NextResponse.json({ error: "GA4 not connected" }, { status: 400 });
  }

  const properties = await listGa4Properties(integration.refreshToken);
  let requestedIds: string[] | null = null;
  try {
    const payload = await request.json();
    if (Array.isArray(payload?.propertyIds) && payload.propertyIds.length > 0) {
      requestedIds = payload.propertyIds.map((id: unknown) => String(id));
    }
  } catch {
    requestedIds = null;
  }

  const selectedProperties = requestedIds
    ? properties.filter((prop) => requestedIds!.includes(prop.id))
    : properties;
  let created = 0;
  let skipped = 0;

  for (const prop of selectedProperties) {
    const existing = await prisma.dataSourceAccount.findFirst({
      where: { type: "GA4", externalId: prop.id }
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    const project = await prisma.project.create({
      data: {
        name: prop.displayName,
        timezone: prop.timeZone ?? DEFAULT_TIMEZONE,
        currency: prop.currencyCode ?? DEFAULT_CURRENCY
      }
    });

    await prisma.dataSourceAccount.create({
      data: {
        projectId: project.id,
        type: "GA4",
        externalId: prop.id
      }
    });

    await prisma.projectUser.create({
      data: { projectId: project.id, userId: user.id }
    });

    created += 1;
  }

  return NextResponse.json({ ok: true, created, skipped });
}

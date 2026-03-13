import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth-helpers";
import { listMerchantProducts } from "@/lib/merchant";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const merchantIdParam = searchParams.get("merchantId");
  if (!projectId && !merchantIdParam) {
    return NextResponse.json({ error: "Missing projectId or merchantId" }, { status: 400 });
  }

  if (projectId && !isAdmin(user.role)) {
    const access = await prisma.projectUser.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } }
    });
    if (!access) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const project = projectId
    ? await prisma.project.findUnique({
        where: { id: projectId },
        include: { dataSources: true }
      })
    : null;

  if (projectId && !project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const merchantId =
    merchantIdParam ??
    project?.dataSources.find((item) => item.type === "MERCHANT")?.externalId ??
    null;
  if (!merchantId) {
    return NextResponse.json({ error: "Merchant not connected" }, { status: 400 });
  }

  const integration = await prisma.integrationSetting.findUnique({
    where: { type: "MERCHANT" }
  });
  if (!integration?.refreshToken) {
    return NextResponse.json({ error: "Merchant integration not connected" }, { status: 400 });
  }

  const paged = searchParams.get("paged") === "1";
  const pageToken = searchParams.get("pageToken") ?? undefined;
  if (paged) {
    const result = await listMerchantProducts({
      merchantId,
      refreshToken: integration.refreshToken,
      pageToken
    });
    return NextResponse.json({
      merchantId,
      products: result.products,
      nextPageToken: result.nextPageToken ?? null
    });
  }

  const products: Awaited<ReturnType<typeof listMerchantProducts>>["products"] = [];
  let nextPageToken: string | undefined = undefined;
  do {
    const result = await listMerchantProducts({
      merchantId,
      refreshToken: integration.refreshToken,
      pageToken: nextPageToken
    });
    products.push(...result.products);
    nextPageToken = result.nextPageToken;
  } while (nextPageToken);

  return NextResponse.json({ merchantId, products });
}

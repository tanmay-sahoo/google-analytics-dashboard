import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth-helpers";
import { logActivity } from "@/lib/logging";

const schema = z.object({
  projectId: z.string().min(1),
  merchantId: z.string().min(1),
  products: z.array(
    z.object({
      offerId: z.string().min(1),
      title: z.string().min(1),
      link: z.string().optional(),
      imageLink: z.string().optional(),
      availability: z.string().optional(),
      priceValue: z.number().optional(),
      priceCurrency: z.string().optional()
    })
  )
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (!isAdmin(user.role)) {
    const access = await prisma.projectUser.findUnique({
      where: { projectId_userId: { projectId: parsed.data.projectId, userId: user.id } }
    });
    if (!access) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const uniqueByOfferId = new Map<string, (typeof parsed.data.products)[number]>();
  for (const item of parsed.data.products) {
    uniqueByOfferId.set(item.offerId, item);
  }
  const uniqueProducts = [...uniqueByOfferId.values()];

  const existing = await prisma.merchantProduct.findMany({
    where: {
      projectId: parsed.data.projectId,
      merchantId: parsed.data.merchantId,
      offerId: { in: uniqueProducts.map((item) => item.offerId) }
    },
    select: { offerId: true }
  });
  const existingOfferIds = new Set(existing.map((item) => item.offerId));

  const newProducts = uniqueProducts.filter((item) => !existingOfferIds.has(item.offerId));
  let inserted = 0;
  if (newProducts.length > 0) {
    const result = await prisma.merchantProduct.createMany({
      data: newProducts.map((item) => ({
        projectId: parsed.data.projectId,
        merchantId: parsed.data.merchantId,
        offerId: item.offerId,
        title: item.title,
        link: item.link,
        imageLink: item.imageLink,
        availability: item.availability,
        priceValue: item.priceValue,
        priceCurrency: item.priceCurrency
      })),
      skipDuplicates: true
    });
    inserted = result.count;
  }

  const skippedExisting = uniqueProducts.length - inserted;

  await logActivity({
    userId: user.id,
    action: "IMPORT",
    entityType: "MERCHANT_PRODUCT",
    entityId: parsed.data.merchantId,
    message: `Imported ${inserted} Merchant products. Skipped ${skippedExisting} existing.`,
    metadata: { inserted, skippedExisting, submitted: parsed.data.products.length, unique: uniqueProducts.length }
  });

  return NextResponse.json({
    ok: true,
    imported: inserted,
    skippedExisting,
    submitted: parsed.data.products.length,
    unique: uniqueProducts.length
  });
}

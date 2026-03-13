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

  const count = parsed.data.products.length;
  for (const item of parsed.data.products) {
    await prisma.merchantProduct.upsert({
      where: {
        projectId_merchantId_offerId: {
          projectId: parsed.data.projectId,
          merchantId: parsed.data.merchantId,
          offerId: item.offerId
        }
      },
      update: {
        title: item.title,
        link: item.link,
        imageLink: item.imageLink,
        availability: item.availability,
        priceValue: item.priceValue,
        priceCurrency: item.priceCurrency
      },
      create: {
        projectId: parsed.data.projectId,
        merchantId: parsed.data.merchantId,
        offerId: item.offerId,
        title: item.title,
        link: item.link,
        imageLink: item.imageLink,
        availability: item.availability,
        priceValue: item.priceValue,
        priceCurrency: item.priceCurrency
      }
    });
  }

  await logActivity({
    userId: user.id,
    action: "IMPORT",
    entityType: "MERCHANT_PRODUCT",
    entityId: parsed.data.merchantId,
    message: `Imported ${count} Merchant products.`,
    metadata: { count }
  });

  return NextResponse.json({ ok: true, imported: count });
}

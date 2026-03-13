import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth-helpers";

export async function GET() {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const configs = await prisma.aiConfig.findMany({
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }]
    });
    return NextResponse.json({
      configs: configs.map((config) => ({
        id: config.id,
        provider: config.provider,
        model: config.model,
        apiKey: "",
        isDefault: config.isDefault,
        createdAt: config.createdAt.toISOString()
      }))
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Failed to load AI configs. ${error.message}. Run prisma db push.`
            : "Failed to load AI configs. Run prisma db push."
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const provider = typeof body.provider === "string" ? body.provider : "";
  const model = typeof body.model === "string" ? body.model : "";
  const apiKey = typeof body.apiKey === "string" ? body.apiKey : "";
  const isDefault = Boolean(body.isDefault);

  if (!provider || !model || !apiKey) {
    return NextResponse.json({ error: "Provider, model, and apiKey are required." }, { status: 400 });
  }

  try {
    if (isDefault) {
      await prisma.aiConfig.updateMany({ data: { isDefault: false } });
    }

    const existingCount = await prisma.aiConfig.count();
    const config = await prisma.aiConfig.create({
      data: { provider, model, apiKey, isDefault: isDefault || existingCount === 0 }
    });

    if (config.isDefault) {
      await prisma.aiConfig.updateMany({
        where: { id: { not: config.id } },
        data: { isDefault: false }
      });
    }

    return NextResponse.json({
      id: config.id,
      provider: config.provider,
      model: config.model,
      isDefault: config.isDefault
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Failed to save AI config. ${error.message}. Run prisma db push.`
            : "Failed to save AI config. Run prisma db push."
      },
      { status: 500 }
    );
  }
}

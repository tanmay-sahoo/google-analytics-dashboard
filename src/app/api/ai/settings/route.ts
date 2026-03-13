import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth-helpers";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const setting = await prisma.aiConfig.findFirst({ where: { isDefault: true } });
    return NextResponse.json({
      provider: setting?.provider ?? "",
      model: setting?.model ?? ""
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Failed to load AI settings. ${error.message}. Run prisma db push.`
            : "Failed to load AI settings. Run prisma db push."
      },
      { status: 500 }
    );
  }
}

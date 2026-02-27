import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth-helpers";

const schema = z.object({
  locale: z.enum(["en", "de"]).optional(),
  theme: z.enum(["light", "dark"]).optional()
});

export async function POST(request: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: sessionUser.id },
    data: {
      locale: parsed.data.locale ?? sessionUser.locale ?? "en",
      theme: parsed.data.theme ?? sessionUser.theme ?? "light"
    }
  });

  return NextResponse.json({ ok: true });
}

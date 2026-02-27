import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isAdmin } from "@/lib/auth-helpers";

const createSchema = z.object({
  name: z.string().min(2),
  timezone: z.string().min(2),
  currency: z.string().min(2)
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isAdmin(user.role)) {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: { projectUsers: true, dataSources: true }
    });
    return NextResponse.json({ projects });
  }

  const projects = await prisma.project.findMany({
    where: { projectUsers: { some: { userId: user.id } } },
    include: { projectUsers: true, dataSources: true }
  });

  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await request.json();
  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const project = await prisma.project.create({
    data: parsed.data
  });

  return NextResponse.json({ id: project.id });
}

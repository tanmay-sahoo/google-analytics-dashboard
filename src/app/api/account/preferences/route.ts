import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth-helpers";
import {
  filterPrefsSchema,
  mergeUserFilterPrefs,
  readUserFilterPrefs
} from "@/lib/filter-prefs";

const schema = z.object({
  locale: z.enum(["en", "de"]).optional(),
  theme: z.enum(["light", "dark"]).optional(),
  filterPrefs: filterPrefsSchema.optional()
});

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const filterPrefs = await readUserFilterPrefs(sessionUser.id);
  return NextResponse.json({
    locale: sessionUser.locale ?? "en",
    theme: sessionUser.theme ?? "light",
    filterPrefs
  });
}

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

  const updateData: { locale?: string; theme?: string } = {};
  if (parsed.data.locale) updateData.locale = parsed.data.locale;
  if (parsed.data.theme) updateData.theme = parsed.data.theme;
  if (Object.keys(updateData).length) {
    await prisma.user.update({ where: { id: sessionUser.id }, data: updateData });
  }

  let filterPrefs = undefined;
  if (parsed.data.filterPrefs) {
    filterPrefs = await mergeUserFilterPrefs(sessionUser.id, parsed.data.filterPrefs);
  }

  return NextResponse.json({ ok: true, filterPrefs });
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { exchangeCode, getUserEmail } from "@/lib/google-oauth";
import { verifyState } from "@/lib/oauth-state";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.redirect(new URL("/signin", request.url));
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const parsedState = verifyState(state);
  if (!parsedState) {
    return NextResponse.json({ error: "Invalid state" }, { status: 400 });
  }

  const { type } = parsedState;

  const tokens = await exchangeCode(code);
  const email = tokens.access_token ? await getUserEmail(tokens) : null;

  await prisma.integrationSetting.upsert({
    where: { type },
    update: {
      accessToken: tokens.access_token ?? undefined,
      refreshToken: tokens.refresh_token ?? undefined,
      tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      connectedEmail: email ?? undefined
    },
    create: {
      type,
      accessToken: tokens.access_token ?? null,
      refreshToken: tokens.refresh_token ?? null,
      tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      connectedEmail: email ?? null
    }
  });

  return NextResponse.redirect(new URL("/admin/integrations", request.url));
}

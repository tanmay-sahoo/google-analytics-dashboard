import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isAdmin } from "@/lib/auth-helpers";
import { getSmtpConfig, sendMail, verifySmtp } from "@/lib/mailer";

const schema = z.object({ to: z.string().email() });

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const config = await getSmtpConfig();
  if (!config) {
    return NextResponse.json({ error: "SMTP not configured" }, { status: 400 });
  }

  try {
    await verifySmtp(config);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "SMTP verification failed" },
      { status: 400 }
    );
  }

  const result = await sendMail({
    to: parsed.data.to,
    subject: "Test email from Marketing Data Hub",
    text: "This is a test email confirming your SMTP settings are working."
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }
  return NextResponse.json({ ok: true, messageId: result.messageId });
}

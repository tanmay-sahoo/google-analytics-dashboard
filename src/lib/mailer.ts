import nodemailer, { type Transporter } from "nodemailer";
import { prisma } from "@/lib/prisma";

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromEmail: string;
  fromName?: string | null;
  enabled: boolean;
};

export async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const setting = await prisma.smtpSetting.findUnique({ where: { key: "default" } });
  if (!setting) return null;
  return {
    host: setting.host,
    port: setting.port,
    secure: setting.secure,
    username: setting.username,
    password: setting.password,
    fromEmail: setting.fromEmail,
    fromName: setting.fromName,
    enabled: setting.enabled
  };
}

export function buildTransport(config: SmtpConfig): Transporter {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.username, pass: config.password }
  });
}

export function formatFrom(config: SmtpConfig) {
  return config.fromName ? `"${config.fromName.replace(/"/g, "")}" <${config.fromEmail}>` : config.fromEmail;
}

export async function sendMail(options: {
  to?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
}) {
  const config = await getSmtpConfig();
  if (!config || !config.enabled) {
    return { ok: false as const, reason: "SMTP not configured or disabled" };
  }
  try {
    const transport = buildTransport(config);
    const info = await transport.sendMail({
      from: formatFrom(config),
      to: options.to ? (Array.isArray(options.to) ? options.to.join(", ") : options.to) : config.fromEmail,
      bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(", ") : options.bcc) : undefined,
      subject: options.subject,
      text: options.text,
      html: options.html
    });
    return { ok: true as const, messageId: info.messageId };
  } catch (error) {
    return { ok: false as const, reason: error instanceof Error ? error.message : "Send failed" };
  }
}

export async function verifySmtp(config: SmtpConfig) {
  const transport = buildTransport(config);
  await transport.verify();
}

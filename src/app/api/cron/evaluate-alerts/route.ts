import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { getMetricField, getMetricSource } from "@/lib/metrics-catalog";
import { renderAlertEmail } from "@/lib/email-templates";
import { BASE_PATH } from "@/lib/base-path";

const UNIT_MS: Record<string, number> = {
  MINUTES: 60_000,
  HOURS: 3_600_000,
  DAYS: 86_400_000,
  WEEKS: 86_400_000 * 7,
  MONTHS: 86_400_000 * 30
};

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return 0;
}

function windowMs(amount: number, unit: string) {
  return amount * (UNIT_MS[unit] ?? UNIT_MS.DAYS);
}

function describeWindow(amount: number, unit: string) {
  const lower = unit.toLowerCase();
  return `${amount} ${amount === 1 ? lower.slice(0, -1) : lower}`;
}

export async function POST() {
  const now = new Date();
  const rules = await prisma.alertRule.findMany({
    where: { enabled: true },
    include: { project: true }
  });

  const results = [] as {
    ruleId: string;
    triggered: boolean;
    skipped?: boolean;
    emailSent?: boolean;
    emailError?: string;
    emailRecipients?: number;
  }[];

  for (const rule of rules) {
    const dueAt = rule.lastEvaluatedAt
      ? new Date(rule.lastEvaluatedAt.getTime() + rule.evaluateEveryMins * 60_000)
      : null;
    if (dueAt && dueAt > now) {
      results.push({ ruleId: rule.id, triggered: false, skipped: true });
      continue;
    }

    const source = getMetricSource(rule.metric);
    const field = getMetricField(rule.metric);
    const rangeStart = new Date(now.getTime() - windowMs(rule.windowAmount, rule.windowUnit));

    const metrics = await prisma.metricDaily.findMany({
      where: {
        projectId: rule.projectId,
        source,
        date: { gte: rangeStart }
      },
      orderBy: { date: "desc" }
    });

    await prisma.alertRule.update({
      where: { id: rule.id },
      data: { lastEvaluatedAt: now }
    });

    if (metrics.length === 0) {
      results.push({ ruleId: rule.id, triggered: false });
      continue;
    }

    const values = metrics.map((row) => toNumber((row.metrics as Record<string, unknown>)[field]));
    const latestValue = values[0];

    let aggregateValue = latestValue;
    if (rule.aggregation === "SUM") {
      aggregateValue = values.reduce((sum, v) => sum + v, 0);
    } else if (rule.aggregation === "AVG") {
      aggregateValue = values.reduce((sum, v) => sum + v, 0) / values.length;
    }

    let triggered = false;
    let comparedAgainst: number | null = null;
    if (rule.condition === "GT") {
      triggered = aggregateValue > rule.threshold;
    } else if (rule.condition === "LT") {
      triggered = aggregateValue < rule.threshold;
    } else {
      const previous = values.length > 1 ? values[values.length - 1] : 0;
      const delta = previous === 0 ? 0 : ((latestValue - previous) / previous) * 100;
      comparedAgainst = previous;
      triggered = delta > rule.threshold;
    }

    const cooldownCutoff = new Date(now.getTime() - rule.cooldownMins * 60_000);
    const recentEvent = await prisma.alertEvent.findFirst({
      where: { ruleId: rule.id, evaluatedAt: { gte: cooldownCutoff } }
    });

    if (triggered && !recentEvent) {
      const windowLabel = describeWindow(rule.windowAmount, rule.windowUnit);
      const aggLabel = rule.aggregation === "LATEST" ? "latest" : rule.aggregation.toLowerCase();
      const valueLabel = Number.isFinite(aggregateValue) ? aggregateValue.toFixed(2) : String(aggregateValue);
      const eventMessage =
        rule.condition === "PCT_CHANGE"
          ? `${rule.metric} %change vs prior ${windowLabel} exceeded ${rule.threshold}% (was ${comparedAgainst?.toFixed(2)}, now ${latestValue.toFixed(2)})`
          : `${rule.metric} (${aggLabel} over ${windowLabel}) ${rule.condition === "GT" ? ">" : "<"} ${rule.threshold} — value ${valueLabel}`;

      const event = await prisma.alertEvent.create({
        data: {
          ruleId: rule.id,
          projectId: rule.projectId,
          evaluatedAt: now,
          value: aggregateValue,
          message: eventMessage,
          status: "TRIGGERED"
        }
      });

      // In-app notifications go to every active user assigned to the project,
      // plus all active admins (admins can see everything).
      const projectMembers = await prisma.user.findMany({
        where: {
          isActive: true,
          projectUsers: { some: { projectId: rule.projectId } }
        },
        select: { id: true, email: true, role: true, notificationsEnabled: true }
      });
      const admins = await prisma.user.findMany({
        where: { isActive: true, role: "ADMIN" },
        select: { id: true, email: true, role: true, notificationsEnabled: true }
      });

      const allRecipientsById = new Map<string, { id: string; email: string; role: string; notificationsEnabled: boolean }>();
      for (const u of [...projectMembers, ...admins]) {
        if (u.email) allRecipientsById.set(u.id, u);
      }
      const allRecipients = [...allRecipientsById.values()];

      if (allRecipients.length > 0) {
        await prisma.notification.createMany({
          data: allRecipients.map((u) => ({
            userId: u.id,
            projectId: rule.projectId,
            alertEventId: event.id,
            kind: "ALERT" as const,
            title: `Alert: ${rule.project.name} — ${rule.metric}`,
            body: eventMessage,
            href: "/alerts"
          }))
        });
      }

      // Email recipients: every admin (always) + non-admin users with
      // notificationsEnabled=true who are assigned to this project. Rule-level
      // channels.email still gates whether email goes out at all.
      const channels = (rule.channels as { email?: boolean } | null) ?? null;
      if (channels?.email) {
        const emailRecipients = allRecipients.filter(
          (u) => u.role === "ADMIN" || u.notificationsEnabled
        );
        if (emailRecipients.length > 0) {
          // APP_BASE_URL / NEXTAUTH_URL on the server usually already include
          // the basePath segment — strip a trailing slash and BASE_PATH suffix
          // so we don't end up with /analytics-app/analytics-app/alerts.
          const rawBase = (process.env.APP_BASE_URL || process.env.NEXTAUTH_URL || "").replace(/\/$/, "");
          const origin = BASE_PATH && rawBase.endsWith(BASE_PATH) ? rawBase.slice(0, -BASE_PATH.length) : rawBase;
          const alertsUrl = `${origin}${BASE_PATH}/alerts`;
          const { subject, html, text } = renderAlertEmail({
            projectName: rule.project.name,
            metric: rule.metric,
            condition: rule.condition as "GT" | "LT" | "PCT_CHANGE",
            threshold: rule.threshold,
            aggregation: aggLabel,
            windowLabel,
            message: eventMessage,
            value: aggregateValue,
            comparedAgainst,
            evaluatedAt: now,
            alertsUrl
          });
          // Use BCC so recipients don't see each other's addresses. The SMTP
          // sender's own address goes in `to` (set by the mailer when omitted).
          const mailResult = await sendMail({
            bcc: emailRecipients.map((u) => u.email),
            subject,
            html,
            text
          });
          if (mailResult.ok) {
            await prisma.alertEvent.update({
              where: { id: event.id },
              data: { status: "DELIVERED", deliveredAt: new Date() }
            });
            results.push({
              ruleId: rule.id,
              triggered: true,
              emailSent: true,
              emailRecipients: emailRecipients.length
            });
            continue;
          }
          console.error("[evaluate-alerts] sendMail failed:", mailResult.reason);
          results.push({
            ruleId: rule.id,
            triggered: true,
            emailSent: false,
            emailError: mailResult.reason,
            emailRecipients: emailRecipients.length
          });
          continue;
        }
      }
    }

    results.push({ ruleId: rule.id, triggered });
  }

  return NextResponse.json({ ok: true, results });
}

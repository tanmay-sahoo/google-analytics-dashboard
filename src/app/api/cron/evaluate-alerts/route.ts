import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { getMetricField, getMetricSource } from "@/lib/metrics-catalog";

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

  const results = [] as { ruleId: string; triggered: boolean; skipped?: boolean }[];

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

      const recipients = await prisma.projectUser.findMany({
        where: { projectId: rule.projectId },
        include: { user: { select: { id: true, email: true, isActive: true } } }
      });
      const activeUsers = recipients.filter((row) => row.user?.isActive !== false && row.user?.email);

      if (activeUsers.length > 0) {
        await prisma.notification.createMany({
          data: activeUsers.map((row) => ({
            userId: row.user!.id,
            projectId: rule.projectId,
            alertEventId: event.id,
            kind: "ALERT" as const,
            title: `Alert: ${rule.project.name} — ${rule.metric}`,
            body: eventMessage,
            href: "/alerts"
          }))
        });
      }

      const channels = (rule.channels as { email?: boolean } | null) ?? null;
      if (channels?.email && activeUsers.length > 0) {
        const subject = `[Alert] ${rule.project.name}: ${rule.metric}`;
        const text = `Alert "${rule.metric}" triggered for project "${rule.project.name}".

${eventMessage}

Window: ${windowLabel}
Aggregation: ${aggLabel}
Evaluated at: ${now.toISOString()}`;
        const mailResult = await sendMail({
          to: activeUsers.map((row) => row.user!.email),
          subject,
          text
        });
        if (mailResult.ok) {
          await prisma.alertEvent.update({
            where: { id: event.id },
            data: { status: "DELIVERED", deliveredAt: new Date() }
          });
        }
      }
    }

    results.push({ ruleId: rule.id, triggered });
  }

  return NextResponse.json({ ok: true, results });
}

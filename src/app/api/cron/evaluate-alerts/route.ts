import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ga4Metrics = new Set(["sessions", "users", "conversions", "revenue"]);
const adsMetrics = new Set(["spend", "clicks", "impressions", "roas"]);

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return 0;
}

export async function POST() {
  const rules = await prisma.alertRule.findMany({
    where: { enabled: true },
    include: { project: true }
  });

  const results = [] as { ruleId: string; triggered: boolean }[];

  for (const rule of rules) {
    const source = ga4Metrics.has(rule.metric) ? "GA4" : "ADS";
    const metrics = await prisma.metricDaily.findMany({
      where: { projectId: rule.projectId, source },
      orderBy: { date: "desc" },
      take: rule.window === "LAST_7_DAYS" ? 7 : 2
    });

    if (metrics.length === 0) {
      results.push({ ruleId: rule.id, triggered: false });
      continue;
    }

    const latest = metrics[0];
    const latestValue = toNumber((latest.metrics as Record<string, unknown>)[rule.metric]);

    let comparisonValue = latestValue;
    if (rule.window === "YESTERDAY" && metrics[1]) {
      comparisonValue = toNumber((metrics[1].metrics as Record<string, unknown>)[rule.metric]);
    }
    if (rule.window === "LAST_7_DAYS") {
      const avg =
        metrics.reduce((sum, item) => {
          return sum + toNumber((item.metrics as Record<string, unknown>)[rule.metric]);
        }, 0) / metrics.length;
      comparisonValue = avg;
    }

    let triggered = false;
    if (rule.condition === "GT") {
      triggered = latestValue > rule.threshold;
    } else if (rule.condition === "LT") {
      triggered = latestValue < rule.threshold;
    } else {
      const delta = comparisonValue === 0 ? 0 : ((latestValue - comparisonValue) / comparisonValue) * 100;
      triggered = delta > rule.threshold;
    }

    const cooldownCutoff = new Date(Date.now() - rule.cooldownMins * 60 * 1000);
    const recentEvent = await prisma.alertEvent.findFirst({
      where: {
        ruleId: rule.id,
        evaluatedAt: { gte: cooldownCutoff }
      }
    });

    if (triggered && !recentEvent) {
      await prisma.alertEvent.create({
        data: {
          ruleId: rule.id,
          projectId: rule.projectId,
          evaluatedAt: new Date(),
          value: latestValue,
          message: `${rule.metric} breached ${rule.condition} ${rule.threshold}`,
          status: "TRIGGERED"
        }
      });
    }

    results.push({ ruleId: rule.id, triggered });
  }

  return NextResponse.json({ ok: true, results });
}

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const baseUrl = process.env.APP_BASE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
const cronSecret = process.env.CRON_SECRET || "";
const pollIntervalMs = 60 * 1000;
const alertPollIntervalMs = Number(process.env.ALERT_EVAL_INTERVAL_MS) || 5 * 60 * 1000;

async function shouldRun(setting) {
  if (!setting?.enabled) {
    return false;
  }
  if (!setting.lastRunAt) {
    return true;
  }
  const next = new Date(setting.lastRunAt.getTime() + setting.intervalMins * 60 * 1000);
  return new Date() >= next;
}

async function callCron(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: cronSecret ? { "x-cron-secret": cronSecret } : undefined
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Failed to call ${path}`);
  }
  return response.json().catch(() => ({}));
}

async function ingestionTick() {
  try {
    const setting = await prisma.ingestionSetting.findUnique({ where: { key: "default" } });
    if (await shouldRun(setting)) {
      await callCron("/api/cron/ingest-metrics");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[ingestion-worker]", message);
  }
}

async function alertTick() {
  try {
    await callCron("/api/cron/evaluate-alerts");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[alert-worker]", message);
  }
}

async function main() {
  if (!cronSecret) {
    console.warn("[ingestion-worker] CRON_SECRET is not set. Endpoint may reject requests.");
  }
  await ingestionTick();
  await alertTick();
  const ingestionTimer = setInterval(() => void ingestionTick(), pollIntervalMs);
  const alertTimer = setInterval(() => void alertTick(), alertPollIntervalMs);

  const shutdown = async () => {
    clearInterval(ingestionTimer);
    clearInterval(alertTimer);
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();

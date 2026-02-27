const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const baseUrl = process.env.APP_BASE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
const cronSecret = process.env.CRON_SECRET || "";
const pollIntervalMs = 60 * 1000;

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

async function triggerIngestion() {
  const response = await fetch(`${baseUrl}/api/cron/ingest-metrics`, {
    method: "POST",
    headers: cronSecret ? { "x-cron-secret": cronSecret } : undefined
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Failed to run ingestion.");
  }
  return response.json().catch(() => ({}));
}

async function tick() {
  try {
    const setting = await prisma.ingestionSetting.findUnique({
      where: { key: "default" }
    });
    if (await shouldRun(setting)) {
      await triggerIngestion();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[ingestion-worker]", message);
  }
}

async function main() {
  if (!cronSecret) {
    console.warn("[ingestion-worker] CRON_SECRET is not set. Endpoint may reject requests.");
  }
  await tick();
  const timer = setInterval(() => {
    void tick();
  }, pollIntervalMs);

  const shutdown = async () => {
    clearInterval(timer);
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();

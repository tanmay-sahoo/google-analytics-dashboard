const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

function run(command, args, name, extraEnv = {}) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...extraEnv }
  });

  child.on("exit", (code) => {
    if (code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
    }
  });

  return child;
}

const isDev = process.argv.includes("--dev");
const distDir = isDev ? ".next-dev" : ".next";
if (isDev && process.env.CLEAN_NEXT_DEV_CACHE !== "0") {
  const devDir = path.join(process.cwd(), distDir);
  try {
    fs.rmSync(devDir, { recursive: true, force: true });
  } catch (error) {
    // Ignore cache cleanup failures; Next can still start.
  }
}
const app = run("next", [isDev ? "dev" : "start"], "app", {
  NEXT_DIST_DIR: distDir
});

const startWorker = (process.env.START_WORKER ?? "true").toLowerCase() !== "false";
const worker = startWorker ? run("node", ["scripts/ingestion-worker.js"], "worker") : null;
if (!startWorker) {
  console.log("[start-with-worker] START_WORKER=false — skipping in-process worker.");
}

const shutdown = () => {
  app.kill("SIGTERM");
  if (worker) worker.kill("SIGTERM");
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

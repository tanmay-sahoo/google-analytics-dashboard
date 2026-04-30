const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const exitCodes = {};
const children = [];

function run(name, command, args, extraEnv = {}) {
  console.log(`[start-with-worker] starting ${name}: ${command} ${args.join(" ")}`);
  const child = spawn(command, args, {
    stdio: "inherit",
    env: { ...process.env, ...extraEnv }
  });

  child.on("error", (error) => {
    console.error(`[${name}] failed to spawn:`, error);
    exitCodes[name] = 1;
    shutdown();
  });

  child.on("exit", (code, signal) => {
    console.error(
      `[${name}] exited with code=${code} signal=${signal ?? "none"}`
    );
    exitCodes[name] = code ?? (signal ? 1 : 0);
    // If any child dies, take the whole container down so Docker can restart
    // it and the log shows the real reason instead of a silent code-0 exit.
    shutdown();
  });

  children.push({ name, child });
  return child;
}

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const { child } of children) {
    if (!child.killed) {
      try { child.kill("SIGTERM"); } catch { /* noop */ }
    }
  }
  // Give children a moment to clean up, then exit with the worst code seen.
  setTimeout(() => {
    const worst = Math.max(0, ...Object.values(exitCodes));
    process.exit(worst || 1);
  }, 1500).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Resolve next's binary by module path — avoids relying on $PATH inside the
// container where node_modules/.bin is not on PATH.
let nextBin;
try {
  nextBin = require.resolve("next/dist/bin/next");
} catch (error) {
  console.error("[start-with-worker] could not resolve `next` binary:", error);
  process.exit(1);
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

run("app", process.execPath, [nextBin, isDev ? "dev" : "start"], {
  NEXT_DIST_DIR: distDir
});

const startWorker = (process.env.START_WORKER ?? "true").toLowerCase() !== "false";
if (startWorker) {
  run("worker", process.execPath, ["scripts/ingestion-worker.js"]);
} else {
  console.log("[start-with-worker] START_WORKER=false — skipping in-process worker.");
}

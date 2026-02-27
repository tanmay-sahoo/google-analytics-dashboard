const { spawn } = require("child_process");

function run(command, args, name) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: true
  });

  child.on("exit", (code) => {
    if (code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
    }
  });

  return child;
}

const isDev = process.argv.includes("--dev");
const app = run("next", [isDev ? "dev" : "start"], "app");
const worker = run("node", ["scripts/ingestion-worker.js"], "worker");

const shutdown = () => {
  app.kill("SIGTERM");
  worker.kill("SIGTERM");
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

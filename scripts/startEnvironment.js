import { spawn } from "node:child_process";

const allowedEnvironments = new Set(["dev", "preprod", "prod"]);
const appEnv = process.argv[2];
const watch = process.argv.includes("--watch");

if (!allowedEnvironments.has(appEnv)) {
  process.stderr.write("Usage: node scripts/startEnvironment.js <dev|preprod|prod> [--watch]\n");
  process.exit(1);
}

const executable = watch
  ? process.platform === "win32"
    ? "nodemon.cmd"
    : "nodemon"
  : process.execPath;
const args = watch ? ["server.js"] : ["server.js"];

const child = spawn(executable, args, {
  cwd: process.cwd(),
  env: {
    ...process.env,
    APP_ENV: appEnv,
    NODE_ENV: appEnv === "dev" ? "development" : "production",
  },
  stdio: "inherit",
  shell: watch,
});

child.on("error", (error) => {
  process.stderr.write(`Impossible de démarrer le backend : ${error.message}\n`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

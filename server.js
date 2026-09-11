import fastify from "./app.js";
import { config } from "./Config/env.js";
import { closeDatabase } from "./database/pool.js";
import logger from "./Services/logging/logger.js";
import {
  startAlertMonitoring,
  stopAlertMonitoring,
} from "./Services/alerting/alertService.js";
import {
  startRuntimeProbes,
  stopRuntimeProbes,
} from "./Services/monitoring/monitoringService.js";

const PORT = config.PORT;
const HOST = "0.0.0.0";

let closing = false;

const close = async (signal) => {
  if (closing) return;
  closing = true;
  try {
    stopAlertMonitoring();
    stopRuntimeProbes();
    await fastify.close();
    await closeDatabase().catch(() => {});
    if (signal === "SIGUSR2") {
      process.kill(process.pid, "SIGUSR2");
      return;
    }
    process.exit(0);
  } catch (e) {
    logger.error({ err: e?.message }, "Fermeture serveur");
    process.exit(1);
  }
};

process.on("SIGINT", () => close("SIGINT"));
process.on("SIGTERM", () => close("SIGTERM"));
process.once("SIGUSR2", () => close("SIGUSR2"));

try {
  startRuntimeProbes();
  startAlertMonitoring();
  await fastify.listen({ port: PORT, host: HOST });
  logger.info({ port: PORT, host: HOST }, "App backend démarré");
} catch (err) {
  logger.error({ err: err?.message }, "Démarrage serveur");
  process.exit(1);
}
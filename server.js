import fastify from "./app.js";
import { config } from "./Config/env.js";
import mongoose from "mongoose";
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

const close = async () => {
  try {
    stopAlertMonitoring();
    stopRuntimeProbes();
    await fastify.close();
    await mongoose.connection.close();
    process.exit(0);
  } catch (e) {
    logger.error({ err: e?.message }, "Fermeture serveur");
    process.exit(1);
  }
};

process.on("SIGINT", close);
process.on("SIGTERM", close);

try {
  startRuntimeProbes();
  startAlertMonitoring();
  await fastify.listen({ port: PORT, host: HOST });
  logger.info({ port: PORT, host: HOST }, "App backend démarré");
} catch (err) {
  logger.error({ err: err?.message }, "Démarrage serveur");
  process.exit(1);
}
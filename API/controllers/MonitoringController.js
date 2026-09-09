import logger from "../../Services/logging/logger.js";
import {
  getFullSnapshot,
  getMetricsPayload,
} from "../../Services/monitoring/monitoringService.js";
import { getRecentAlerts } from "../../Services/alerting/alertService.js";

/**
 * Snapshot d'observabilité backend (admin).
 */
export class MonitoringController {
  /**
   * GET /api/monitoring
   */
  static async getSnapshot(request, reply) {
    try {
      const data = await getFullSnapshot();
      return reply.code(200).send({ success: true, data });
    } catch (error) {
      logger.error({ err: error?.message }, "Erreur snapshot monitoring");
      return reply.code(500).send({
        error: true,
        message: "Erreur lors de la recuperation du monitoring",
      });
    }
  }

  /**
   * GET /api/monitoring/metrics
   */
  static async getMetrics(request, reply) {
    try {
      return reply.code(200).send({
        success: true,
        data: getMetricsPayload(),
      });
    } catch (error) {
      logger.error({ err: error?.message }, "Erreur metriques monitoring");
      return reply.code(500).send({
        error: true,
        message: "Erreur lors de la recuperation des metriques",
      });
    }
  }

  /**
   * GET /api/monitoring/alerts
   */
  static async getAlerts(request, reply) {
    try {
      const raw = request.query?.limit;
      const limit = raw != null ? Number(raw) : 20;
      return reply.code(200).send({
        success: true,
        data: {
          alerts: getRecentAlerts(Number.isFinite(limit) ? limit : 20),
        },
      });
    } catch (error) {
      logger.error({ err: error?.message }, "Erreur alertes monitoring");
      return reply.code(500).send({
        error: true,
        message: "Erreur lors de la recuperation des alertes",
      });
    }
  }
}

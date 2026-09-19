import * as DashboardNotification from "../../models/pg/DashboardNotification.js";
import { withTenant } from "../../database/transaction.js";
import logger from "../../Services/logging/logger.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toClient(row) {
  const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
  const details = payload.details && typeof payload.details === "object" ? { ...payload.details } : {};
  if (details.appointmentType === "reservation" && details.orderId && !details.reservationId) {
    details.reservationId = details.orderId;
  }
  return {
    id: row.id,
    notificationType: row.notificationType,
    title: payload.title || "Notification",
    message: payload.message || "",
    priority: payload.priority || "info",
    details,
    hasOrder: payload.hasOrder === true,
    timestamp: row.createdAt,
    read: Boolean(row.readAt),
  };
}

export class DashboardNotificationController {
  static async listUnread(request, reply) {
    try {
      const tenantId = request.tenant?.id;
      const rows = await withTenant(tenantId, (client) =>
        DashboardNotification.listUnread(client, tenantId)
      );
      const data = rows.map(toClient);
      logger.info(
        { tenantId, unreadCount: data.length },
        "GET /api/notifications"
      );
      return reply.send({ success: true, data });
    } catch (error) {
      logger.error({ err: error?.message }, "Erreur listNotifications");
      return reply.code(500).send({ success: false, error: "Erreur interne du serveur" });
    }
  }

  static async markRead(request, reply) {
    const id = request.params?.id;
    if (!UUID_PATTERN.test(String(id || ""))) {
      return reply.code(400).send({ success: false, error: "Identifiant invalide" });
    }
    try {
      const tenantId = request.tenant?.id;
      const row = await withTenant(tenantId, (client) =>
        DashboardNotification.markRead(client, tenantId, id)
      );
      if (!row) {
        return reply.code(404).send({ success: false, error: "Notification introuvable" });
      }
      return reply.send({ success: true, data: { id: row.id } });
    } catch (error) {
      logger.error({ err: error?.message }, "Erreur markNotificationRead");
      return reply.code(500).send({ success: false, error: "Erreur interne du serveur" });
    }
  }

  static async markAllRead(request, reply) {
    try {
      const tenantId = request.tenant?.id;
      const updated = await withTenant(tenantId, (client) =>
        DashboardNotification.markAllRead(client, tenantId)
      );
      return reply.send({ success: true, data: { updated } });
    } catch (error) {
      logger.error({ err: error?.message }, "Erreur markAllNotificationsRead");
      return reply.code(500).send({ success: false, error: "Erreur interne du serveur" });
    }
  }
}

import { DashboardNotificationController } from "../../API/controllers/DashboardNotificationController.js";
import { requireTenantAccess } from "../../middleware/tenantAccess.js";

export default async function notificationInboxRoutes(fastify) {
  fastify.addHook("preHandler", requireTenantAccess);

  fastify.get("/notifications", {
    schema: {
      tags: ["Notifications"],
      summary: "Notifications non lues du restaurant",
    },
  }, DashboardNotificationController.listUnread);

  fastify.patch("/notifications/:id/read", {
    schema: {
      tags: ["Notifications"],
      summary: "Marquer une notification comme lue",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", format: "uuid" } },
      },
    },
  }, DashboardNotificationController.markRead);

  fastify.post("/notifications/read-all", {
    schema: {
      tags: ["Notifications"],
      summary: "Marquer toutes les notifications comme lues",
    },
  }, DashboardNotificationController.markAllRead);
}

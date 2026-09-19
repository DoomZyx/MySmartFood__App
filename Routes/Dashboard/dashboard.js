import { requireTenantAccess } from "../../middleware/tenantAccess.js";
import { getToday, getVenue } from "../../API/controllers/RestaurantDashboardController.js";

export default async function dashboardRoutes(fastify) {
  fastify.addHook("preHandler", requireTenantAccess);

  fastify.get("/dashboard/today", {
    schema: {
      tags: ["Dashboard"],
      summary: "Synthèse du service en cours (commandes, réservations, capacité)",
    },
  }, getToday);

  fastify.get("/dashboard/venue", {
    schema: {
      tags: ["Dashboard"],
      summary: "Horaires et capacité, sans le menu",
    },
  }, getVenue);
}

import {
  getDashboardToday,
  getDashboardVenue,
} from "../../Business/services/RestaurantDashboardService.js";
import logger from "../../Services/logging/logger.js";

function tenantIdOf(request) {
  return request.tenant?.id || request.instanceId;
}

export async function getToday(request, reply) {
  try {
    const data = await getDashboardToday(tenantIdOf(request));
    return reply.send({ success: true, data });
  } catch (error) {
    logger.error({ err: error?.message }, "Erreur dashboard today");
    return reply.code(500).send({
      success: false,
      error: "Erreur interne du serveur",
    });
  }
}

export async function getVenue(request, reply) {
  try {
    const data = await getDashboardVenue(tenantIdOf(request));
    return reply.send({ success: true, data });
  } catch (error) {
    logger.error({ err: error?.message }, "Erreur dashboard venue");
    return reply.code(500).send({
      success: false,
      error: "Erreur interne du serveur",
    });
  }
}

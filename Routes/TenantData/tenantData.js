import { requireAuth } from "../../middleware/sessionAuth.js";
import {
  requireActiveSubscription,
  requireRole,
  resolveTenant,
} from "../../middleware/tenantContext.js";
import * as TenantData from "../../Business/services/TenantDataService.js";

export default async function tenantDataRoutes(fastify) {
  const guards = [requireAuth, resolveTenant, requireActiveSubscription];

  fastify.get("/clients", {
    preHandler: guards,
    handler: async (request) => ({ clients: await TenantData.listClients(request.tenant.id) }),
  });

  fastify.get("/orders", {
    preHandler: guards,
    handler: async (request) => ({ orders: await TenantData.listOrders(request.tenant.id) }),
  });

  fastify.post("/orders", {
    preHandler: [...guards, requireRole("owner", "admin", "member")],
    handler: async (request) => {
      const order = await TenantData.createOrder(request.tenant.id, request.body || {});
      return { order };
    },
  });

  fastify.get("/reservations", {
    preHandler: guards,
    handler: async (request) => ({ reservations: await TenantData.listReservations(request.tenant.id) }),
  });

  fastify.post("/reservations", {
    preHandler: guards,
    handler: async (request) => {
      const reservation = await TenantData.createReservation(request.tenant.id, request.body || {});
      return { reservation };
    },
  });
}

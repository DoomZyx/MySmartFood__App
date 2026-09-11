import { requireTenantAccess } from "../../middleware/tenantAccess.js";
import { withTenant } from "../../database/transaction.js";
import * as Client from "../../models/pg/Client.js";
import * as Order from "../../models/pg/Order.js";
import * as Reservation from "../../models/pg/Reservation.js";
import * as MongoImport from "../../models/pg/MongoImport.js";
import { clientToLegacy } from "../../Business/mappers/orderMapper.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function callClientRoutes(fastify) {
  fastify.get("/calls/:id/client", {
    preHandler: [requireTenantAccess],
    handler: async (request, reply) => {
      const tenantId = request.tenant.id;
      const rawId = request.params.id;
      const clientInfo = await withTenant(tenantId, async (db) => {
        let clientId = UUID_PATTERN.test(rawId) ? rawId : null;
        if (!clientId) {
          clientId =
            (await MongoImport.findRef(db, tenantId, "clients", rawId)) ||
            (await MongoImport.findRef(db, tenantId, "call_sessions", rawId));
        }
        let client = clientId ? await Client.findById(db, tenantId, clientId) : null;
        if (!client) {
          const orders = await Order.list(db, tenantId, { limit: 50 });
          const match = orders.rows.find(
            (row) => row.relatedCall === rawId || row.id === rawId
          );
          if (match?.clientId) client = await Client.findById(db, tenantId, match.clientId);
          if (!client && match?.guestPhone) {
            client = await Client.findByPhone(db, tenantId, match.guestPhone);
          }
        }
        if (!client) {
          const reservations = await Reservation.list(db, tenantId, { limit: 50 });
          const match = reservations.rows.find(
            (row) => row.relatedCall === rawId || row.id === rawId
          );
          if (match?.clientId) client = await Client.findById(db, tenantId, match.clientId);
          if (!client && match?.guestPhone) {
            client = await Client.findByPhone(db, tenantId, match.guestPhone);
          }
        }
        return client;
      });
      if (!clientInfo) {
        return reply.code(404).send({ error: "Client non trouvé" });
      }
      return { success: true, data: clientToLegacy(clientInfo) };
    },
  });
}

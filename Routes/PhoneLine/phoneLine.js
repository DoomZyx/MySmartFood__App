import { PhoneLineController } from "../../API/controllers/PhoneLineController.js";
import { requireTenantAccess } from "../../middleware/tenantAccess.js";

export default async function phoneLineRoutes(fastify) {
  fastify.addHook("preHandler", requireTenantAccess);
  fastify.get("/phone-line", {
    schema: {
      tags: ["PhoneLine"],
      summary: "État de la ligne téléphonique",
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: { phoneLineEnabled: { type: "boolean" } }
            }
          }
        }
      }
    }
  }, PhoneLineController.getStatus);

  fastify.patch("/phone-line", {
    schema: {
      tags: ["PhoneLine"],
      summary: "Activer ou désactiver la ligne téléphonique",
      body: {
        type: "object",
        required: ["enabled"],
        properties: {
          enabled: { type: "boolean" }
        },
        additionalProperties: true
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: { type: "object" },
            message: { type: "string" }
          }
        }
      }
    }
  }, PhoneLineController.updateStatus);
}

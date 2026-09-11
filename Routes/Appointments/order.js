import { requireTenantAccess } from "../../middleware/tenantAccess.js";
import {
  createOrder,
  getOrders,
  getTodayOrders,
  getOrderById,
  updateOrder,
  updateOrderStatus,
  deleteOrder,
  checkAvailability,
  getAvailableSlots,
  createOrderFromAI,
} from "../../Controller/orderController.js";

const idParam = {
  type: "string",
  minLength: 8,
  maxLength: 36,
};

export default async function orderRoutes(fastify) {
  fastify.addHook("preHandler", requireTenantAccess);

  fastify.post("/orders", {
    schema: {
      body: {
        type: "object",
        required: ["date", "heure", "type"],
        properties: {
          client: { type: "string", minLength: 24, maxLength: 24 },
          nom: { type: "string", minLength: 1, maxLength: 120 },
          date: { type: "string", format: "date" },
          heure: {
            type: "string",
            pattern: "^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$",
          },
          duree: { type: "integer", minimum: 30, maximum: 180 },
          type: {
            type: "string",
            enum: ["Commande à emporter", "Réservation de table"],
          },
          modalite: {
            type: "string",
            enum: ["Sur place", "À emporter", "Livraison"],
          },
          nombrePersonnes: { type: "integer", minimum: 1, maximum: 100 },
          description: { type: "string", maxLength: 500 },
          notes_internes: { type: "string", maxLength: 1000 },
          commandes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                produitId: { type: "string" },
                nom: { type: "string" },
                categorie: { type: "string" },
                quantite: { type: "integer", minimum: 1 },
                prixUnitaire: { type: "number" },
                composition: { type: "string", maxLength: 200 },
              },
            },
          },
        },
      },
    },
    handler: createOrder,
  });

  fastify.get("/orders", {
    schema: {
      querystring: {
        type: "object",
        properties: {
          date: { type: "string", format: "date" },
          statut: {
            type: "string",
            enum: [
              "planifie",
              "confirme",
              "en_cours",
              "termine",
              "annule",
              "reporte",
            ],
          },
          type: {
            type: "string",
            enum: ["Commande à emporter", "Réservation de table"],
          },
          modalite: {
            type: "string",
            enum: ["Sur place", "À emporter", "Livraison"],
          },
          page: { type: "integer", minimum: 1 },
          limit: { type: "integer", minimum: 1, maximum: 100 },
        },
      },
    },
    handler: getOrders,
  });

  fastify.get("/orders/today", getTodayOrders);

  fastify.get("/orders/availability", {
    schema: {
      querystring: {
        type: "object",
        required: ["date", "heure", "duree"],
        properties: {
          date: { type: "string", format: "date" },
          heure: {
            type: "string",
            pattern: "^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$",
          },
          duree: { type: "integer", minimum: 30, maximum: 180 },
        },
      },
    },
    handler: checkAvailability,
  });

  fastify.get("/orders/:id", {
    schema: {
      params: {
        type: "object",
        properties: {
          id: idParam,
        },
        required: ["id"],
      },
    },
    handler: getOrderById,
  });

  fastify.put("/orders/:id", {
    schema: {
      params: {
        type: "object",
        properties: {
          id: idParam,
        },
        required: ["id"],
      },
      body: {
        type: "object",
        properties: {
          date: { type: "string", format: "date" },
          heure: {
            type: "string",
            pattern: "^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$",
          },
          duree: { type: "integer", minimum: 30, maximum: 180 },
          type: {
            type: "string",
            enum: ["Commande à emporter", "Réservation de table"],
          },
          modalite: {
            type: "string",
            enum: ["Sur place", "À emporter", "Livraison"],
          },
          nombrePersonnes: { type: "integer", minimum: 1, maximum: 100 },
          description: { type: "string", maxLength: 500 },
          notes_internes: { type: "string", maxLength: 1000 },
          statut: {
            type: "string",
            enum: [
              "planifie",
              "confirme",
              "en_cours",
              "termine",
              "annule",
              "reporte",
            ],
          },
        },
      },
    },
    handler: updateOrder,
  });

  fastify.patch("/orders/:id/status", {
    schema: {
      params: {
        type: "object",
        properties: {
          id: idParam,
        },
        required: ["id"],
      },
      body: {
        type: "object",
        properties: {
          statut: {
            type: "string",
            enum: [
              "planifie",
              "confirme",
              "en_cours",
              "termine",
              "annule",
              "reporte",
            ],
          },
        },
        required: ["statut"],
      },
    },
    handler: updateOrderStatus,
  });

  fastify.delete("/orders/:id", {
    schema: {
      params: {
        type: "object",
        properties: {
          id: idParam,
        },
        required: ["id"],
      },
    },
    handler: deleteOrder,
  });

  fastify.get("/orders/ai/available-slots", {
    schema: {
      querystring: {
        type: "object",
        required: ["date"],
        properties: {
          date: { type: "string", format: "date" },
        },
      },
    },
    handler: getAvailableSlots,
  });

  fastify.post("/orders/ai/create", {
    schema: {
      body: {
        type: "object",
        required: ["telephone", "date", "time"],
        properties: {
          telephone: { type: "string", minLength: 1 },
          date: { type: "string", minLength: 1 },
          time: { type: "string", minLength: 1 },
          type: { type: "string", enum: ["Commande à emporter"] },
          description: { type: "string", maxLength: 500 },
          commandes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                produitId: { type: "string" },
                nom: { type: "string" },
                categorie: { type: "string" },
                quantite: { type: "integer", minimum: 1 },
                prixUnitaire: { type: "number" },
                composition: { type: "string", maxLength: 200 },
                options: { type: "object" },
              },
            },
          },
        },
      },
    },
    handler: createOrderFromAI,
  });
}

import { PricingController } from "../../API/controllers/PricingController.js";
import { requireTenantAccess } from "../../middleware/tenantAccess.js";

export default async function pricingRoutes(fastify) {
  fastify.addHook("preHandler", requireTenantAccess);

  fastify.get("/pricing", PricingController.getPricing);

  // Créer ou mettre à jour la configuration des tarifs
  fastify.put("/pricing", {
    schema: {
      tags: ["Pricing"],
      summary: "Créer ou mettre à jour la configuration des tarifs",
      body: {
        type: "object",
        properties: {
          restaurantInfo: { type: "object" },
          menuPricing: { type: "object" }
        }
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
  }, PricingController.createOrUpdatePricing);

  // Récupérer les produits disponibles par catégorie
  fastify.get("/pricing/products/:categorie", {
    schema: {
      tags: ["Pricing"],
      summary: "Récupérer les produits disponibles par catégorie",
      params: {
        type: "object",
        properties: {
          categorie: { type: "string" }
        },
        required: ["categorie"]
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: { type: "object" }
          }
        }
      }
    }
  }, PricingController.getAvailableProducts);

  // Vérifier la disponibilité du restaurant
  fastify.get("/pricing/availability", {
    schema: {
      tags: ["Pricing"],
      summary: "Vérifier la disponibilité du restaurant",
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: { type: "object" }
          }
        }
      }
    }
  }, PricingController.checkRestaurantAvailability);

  // Ajouter un nouveau produit
  fastify.post("/pricing/products", {
    schema: {
      tags: ["Pricing"],
      summary: "Ajouter un nouveau produit",
      body: {
        type: "object",
        properties: {
          categorie: { type: "string" },
          produit: {
            type: "object",
            properties: {
              nom: { type: "string" },
              description: { type: "string" },
              prixBase: { type: "number" },
              disponible: { type: "boolean" },
              options: { type: "object" },
              composition: { type: "object" },
              boissonsDisponibles: { type: "array", items: { type: "string" } }
            },
            required: ["nom", "prixBase"],
            additionalProperties: true
          }
        },
        required: ["categorie", "produit"]
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
  }, PricingController.addProduct);

  // Mettre à jour un produit
  fastify.put("/pricing/products", {
    schema: {
      tags: ["Pricing"],
      summary: "Mettre à jour un produit",
      body: {
        type: "object",
        properties: {
          categorie: { type: "string" },
          produitId: { type: "string" },
          produitData: { type: "object" }
        },
        required: ["categorie", "produitId", "produitData"]
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
  }, PricingController.updateProduct);

  // Supprimer un produit
  fastify.delete("/pricing/products/:categorie/:produitId", {
    schema: {
      tags: ["Pricing"],
      summary: "Supprimer un produit",
      params: {
        type: "object",
        properties: {
          categorie: { type: "string" },
          produitId: { type: "string" }
        },
        required: ["categorie", "produitId"]
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" }
          }
        }
      }
    }
  }, PricingController.deleteProduct);

  // Récupérer la configuration pour GPT (format simplifié)
  fastify.get("/pricing/gpt", PricingController.getPricingForGPT);
}

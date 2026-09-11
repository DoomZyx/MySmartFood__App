import { PricingService } from "../../Business/services/PricingService.js";
import { ProductService } from "../../Business/services/ProductService.js";
import { PricingTransformer } from "../../Business/transformers/PricingTransformer.js";
import logger from "../../Services/logging/logger.js";

/**
 * Controller de gestion des tarifs et du menu
 */
export class PricingController {
  /**
   * Récupère la configuration des tarifs
   * GET /api/pricing
   */
  static async getPricing(request, reply) {
    try {
      const instanceId = request.tenant?.id || request.instanceId;
      const pricing = await PricingService.getPricing(instanceId);

      return reply.send(
        PricingTransformer.successResponse(pricing)
      );
    } catch (error) {
      logger.error({ err: error?.message }, "Erreur getPricing");

      return reply.code(500).send(
        PricingTransformer.errorResponse(
          "Erreur interne du serveur",
          error.message
        )
      );
    }
  }

  /**
   * Crée ou met à jour la configuration des tarifs
   * POST/PUT /api/pricing
   */
  static async createOrUpdatePricing(request, reply) {
    try {
      const instanceId = request.tenant?.id || request.instanceId;
      const pricing = await PricingService.createOrUpdatePricing(request.body, instanceId);

      return reply.send(
        PricingTransformer.successResponse(
          pricing,
          "Configuration des tarifs mise à jour avec succès"
        )
      );
    } catch (error) {
      logger.error({ err: error?.message }, "Erreur createOrUpdatePricing");

      return reply.code(500).send(
        PricingTransformer.errorResponse(
          "Erreur interne du serveur",
          error.message
        )
      );
    }
  }

  /**
   * Récupère les produits disponibles d'une catégorie
   * GET /api/pricing/products/:categorie
   */
  static async getAvailableProducts(request, reply) {
    try {
      const { categorie } = request.params;
      const instanceId = request.tenant?.id || request.instanceId;
      const products = await PricingService.getAvailableProducts(categorie, instanceId);

      return reply.send(
        PricingTransformer.successResponse(products)
      );
    } catch (error) {
      logger.error({ err: error?.message }, "Erreur getAvailableProducts");

      if (error.message.includes("non trouvée")) {
        return reply.code(404).send(
          PricingTransformer.errorResponse(error.message)
        );
      }

      return reply.code(500).send(
        PricingTransformer.errorResponse(
          "Erreur interne du serveur",
          error.message
        )
      );
    }
  }

  /**
   * Vérifie la disponibilité du restaurant
   * GET /api/pricing/availability
   */
  static async checkRestaurantAvailability(request, reply) {
    try {
      const instanceId = request.tenant?.id || request.instanceId;
      const availability = await PricingService.checkAvailability(instanceId);

      return reply.send(
        PricingTransformer.successResponse(availability)
      );
    } catch (error) {
      logger.error({ err: error?.message }, "Erreur checkRestaurantAvailability");

      if (error.message.includes("non trouvée")) {
        return reply.code(404).send(
          PricingTransformer.errorResponse(error.message)
        );
      }

      return reply.code(500).send(
        PricingTransformer.errorResponse(
          "Erreur interne du serveur",
          error.message
        )
      );
    }
  }

  /**
   * Ajoute un nouveau produit
   * POST /api/pricing/products
   */
  static async addProduct(request, reply) {
    try {
      const { categorie, produit } = request.body;
      const instanceId = request.tenant?.id || request.instanceId;
      const product = await ProductService.addProduct(categorie, produit, instanceId);

      return reply.send(
        PricingTransformer.successResponse(
          { product },
          "Produit ajouté avec succès"
        )
      );
    } catch (error) {
      logger.error({ err: error?.message }, "Erreur addProduct");

      if (error.message.includes("non trouvée")) {
        return reply.code(404).send(
          PricingTransformer.errorResponse(error.message)
        );
      }

      if (error.message.includes("obligatoire") || 
          error.message.includes("invalide") ||
          error.message.includes("supérieur")) {
        return reply.code(400).send(
          PricingTransformer.errorResponse(error.message)
        );
      }

      return reply.code(500).send(
        PricingTransformer.errorResponse(
          "Erreur interne du serveur",
          error.message
        )
      );
    }
  }

  /**
   * Met à jour un produit existant
   * PUT /api/pricing/products
   */
  static async updateProduct(request, reply) {
    try {
      const { categorie, produitId, produitData } = request.body;
      const instanceId = request.tenant?.id || request.instanceId;
      const product = await ProductService.updateProduct(categorie, produitId, produitData, instanceId);

      return reply.send(
        PricingTransformer.successResponse(
          product,
          "Produit mis à jour avec succès"
        )
      );
    } catch (error) {
      logger.error({ err: error?.message }, "Erreur updateProduct");

      if (error.message.includes("non trouvé")) {
        return reply.code(404).send(
          PricingTransformer.errorResponse(error.message)
        );
      }

      if (error.message.includes("invalide")) {
        return reply.code(400).send(
          PricingTransformer.errorResponse(error.message)
        );
      }

      return reply.code(500).send(
        PricingTransformer.errorResponse(
          "Erreur interne du serveur",
          error.message
        )
      );
    }
  }

  /**
   * Supprime un produit
   * DELETE /api/pricing/products/:categorie/:produitId
   */
  static async deleteProduct(request, reply) {
    try {
      const { categorie, produitId } = request.params;
      const instanceId = request.tenant?.id || request.instanceId;
      await ProductService.deleteProduct(categorie, produitId, instanceId);

      return reply.send(
        PricingTransformer.successResponse(
          null,
          "Produit supprimé avec succès"
        )
      );
    } catch (error) {
      logger.error({ err: error?.message }, "Erreur deleteProduct");

      if (error.message.includes("non trouvé")) {
        return reply.code(404).send(
          PricingTransformer.errorResponse(error.message)
        );
      }

      return reply.code(500).send(
        PricingTransformer.errorResponse(
          "Erreur interne du serveur",
          error.message
        )
      );
    }
  }

  /**
   * Récupère la configuration pour GPT
   * GET /api/pricing/gpt
   */
  static async getPricingForGPT(request, reply) {
    try {
      const instanceId = request.tenant?.id || request.instanceId;
      const gptData = await PricingService.getPricingForGPT(instanceId);

      return reply.send(
        PricingTransformer.successResponse(gptData)
      );
    } catch (error) {
      logger.error({ err: error?.message }, "Erreur getPricingForGPT");

      if (error.message.includes("non trouvée")) {
        return reply.code(404).send(
          PricingTransformer.errorResponse(error.message)
        );
      }

      return reply.code(500).send(
        PricingTransformer.errorResponse(
          "Erreur interne du serveur",
          error.message
        )
      );
    }
  }
}


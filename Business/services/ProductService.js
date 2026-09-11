import { addProduct, deleteProduct, updateProduct } from "./MenuCatalogService.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function resolveTenantId(instanceId) {
  const id = instanceId != null ? String(instanceId).trim() : "";
  if (!UUID_PATTERN.test(id)) {
    throw new Error("Identifiant d'établissement invalide");
  }
  return id;
}

export class ProductService {
  static async addProduct(category, productData, instanceId) {
    return addProduct(resolveTenantId(instanceId), category, productData);
  }

  static async updateProduct(category, productId, productData, instanceId) {
    return updateProduct(resolveTenantId(instanceId), category, productId, productData);
  }

  static async deleteProduct(category, productId, instanceId) {
    return deleteProduct(resolveTenantId(instanceId), productId);
  }
}

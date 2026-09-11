import { apiFetch } from "../http.js";

const jsonHeaders = { "Content-Type": "application/json" };

export async function fetchPricing() {
  const res = await apiFetch("api/pricing", { headers: jsonHeaders });
  if (!res.ok) throw new Error("Erreur API");
  return res.json();
}

export async function updatePricing(pricingData) {
  const res = await apiFetch("api/pricing", {
    method: "PUT",
    headers: jsonHeaders,
    body: JSON.stringify(pricingData),
  });
  if (!res.ok) throw new Error("Erreur lors de la mise à jour des tarifs");
  return res.json();
}

export async function calculateDeliveryFees(distance) {
  const params = new URLSearchParams({ distance: distance.toString() });
  const res = await apiFetch(`api/pricing/delivery/calculate?${params}`, {
    headers: jsonHeaders,
  });
  if (!res.ok) throw new Error("Erreur lors du calcul des frais");
  return res.json();
}

export async function fetchAvailableProducts(categorie) {
  const res = await apiFetch(`api/pricing/products/${categorie}`, {
    headers: jsonHeaders,
  });
  if (!res.ok) throw new Error("Erreur API");
  return res.json();
}

export async function checkRestaurantAvailability() {
  const res = await apiFetch("api/pricing/availability", { headers: jsonHeaders });
  if (!res.ok) throw new Error("Erreur API");
  return res.json();
}

export async function addProduct(categorie, produit) {
  const res = await apiFetch("api/pricing/products", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ categorie, produit }),
  });
  if (!res.ok) throw new Error("Erreur lors de l'ajout du produit");
  return res.json();
}

export async function updateProduct(categorie, produitId, produitData) {
  const res = await apiFetch("api/pricing/products", {
    method: "PUT",
    headers: jsonHeaders,
    body: JSON.stringify({ categorie, produitId, produitData }),
  });
  if (!res.ok) throw new Error("Erreur lors de la mise à jour du produit");
  return res.json();
}

export async function deleteProduct(categorie, produitId) {
  const res = await apiFetch(`api/pricing/products/${categorie}/${produitId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Erreur lors de la suppression du produit");
  return res.json();
}

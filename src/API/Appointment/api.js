import { apiFetch, sessionHeaders } from "../http.js";

const defaultHeaders = () => sessionHeaders({ "Content-Type": "application/json" });

// --- Réservations (collection séparée) ---

export async function fetchReservations(page = 1, limit = 50, filters = {}) {
  const params = new URLSearchParams();
  params.append("page", page.toString());
  params.append("limit", limit.toString());
  if (filters.date) params.append("date", filters.date);
  if (filters.statut) params.append("statut", filters.statut);

  const res = await apiFetch(`api/reservations?${params.toString()}`, {
    headers: defaultHeaders(),
  });
  if (!res.ok) throw new Error("Erreur API");
  return res.json();
}

export async function fetchTodayReservations() {
  const res = await apiFetch("api/reservations/today", {
    headers: defaultHeaders(),
  });
  if (!res.ok) throw new Error("Erreur API");
  return res.json();
}

export async function fetchReservation(id) {
  if (!id) throw new Error("ID manquant pour la requête");
  const res = await apiFetch(`api/reservations/${id}`, {
    headers: defaultHeaders(),
  });
  if (!res.ok) throw new Error("Erreur API");
  return res.json();
}

export async function createReservation(data) {
  const res = await apiFetch("api/reservations", {
    method: "POST",
    headers: defaultHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(`Erreur ${res.status}: ${errorData.message || errorData.error || res.statusText}`);
  }
  return res.json();
}

export async function updateReservation(id, data) {
  const res = await apiFetch(`api/reservations/${id}`, {
    method: "PUT",
    headers: defaultHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Erreur lors de la mise à jour de la réservation");
  return res.json();
}

export async function updateReservationStatus(id, statut) {
  const res = await apiFetch(`api/reservations/${id}/status`, {
    method: "PATCH",
    headers: defaultHeaders(),
    body: JSON.stringify({ statut }),
  });
  if (!res.ok) throw new Error("Erreur lors de la mise à jour du statut");
  return res.json();
}

export async function deleteReservation(id) {
  const res = await apiFetch(`api/reservations/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Erreur lors de la suppression de la réservation");
  return res.json();
}

export async function checkReservationAvailability(date, heure, duree) {
  const params = new URLSearchParams({ date, heure, duree: duree.toString() });
  const res = await apiFetch(`api/reservations/availability?${params.toString()}`, {
    headers: defaultHeaders(),
  });
  if (!res.ok) throw new Error("Erreur lors de la vérification de disponibilité");
  return res.json();
}

export async function fetchReservationAvailableSlots(date) {
  const params = new URLSearchParams({ date });
  const res = await apiFetch(`api/reservations/ai/available-slots?${params.toString()}`, {
    headers: defaultHeaders(),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || "Erreur lors de la récupération des créneaux");
  }
  return res.json();
}

// --- Commandes à emporter (orders) ---

export async function fetchOrders(page = 1, limit = 50, filters = {}) {
  const params = new URLSearchParams();
  params.append("page", page.toString());
  params.append("limit", limit.toString());
  if (filters.date) params.append("date", filters.date);
  if (filters.statut) params.append("statut", filters.statut);
  if (filters.type) params.append("type", filters.type);
  if (filters.modalite) params.append("modalite", filters.modalite);

  const res = await apiFetch(`api/orders?${params.toString()}`, {
    headers: defaultHeaders(),
  });
  if (!res.ok) throw new Error("Erreur API");
  return res.json();
}

export async function fetchTodayOrders() {
  const res = await apiFetch("api/orders/today", {
    headers: defaultHeaders(),
  });
  if (!res.ok) throw new Error("Erreur API");
  return res.json();
}

export async function fetchOrder(id) {
  if (!id) throw new Error("ID manquant pour la requête");
  const res = await apiFetch(`api/orders/${id}`, {
    headers: defaultHeaders(),
  });
  if (!res.ok) throw new Error("Erreur API");
  return res.json();
}

export async function createOrder(data) {
  const res = await apiFetch("api/orders", {
    method: "POST",
    headers: defaultHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(`Erreur ${res.status}: ${errorData.message || errorData.error || res.statusText}`);
  }
  return res.json();
}

export async function updateOrder(id, data) {
  const res = await apiFetch(`api/orders/${id}`, {
    method: "PUT",
    headers: defaultHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Erreur lors de la mise à jour de la commande");
  return res.json();
}

export async function updateOrderStatus(id, statut) {
  const res = await apiFetch(`api/orders/${id}/status`, {
    method: "PATCH",
    headers: defaultHeaders(),
    body: JSON.stringify({ statut }),
  });
  if (!res.ok) throw new Error("Erreur lors de la mise à jour du statut");
  return res.json();
}

export async function deleteOrder(id) {
  const res = await apiFetch(`api/orders/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Erreur lors de la suppression de la commande");
  return res.json();
}

export async function checkOrderAvailability(date, heure, duree) {
  const params = new URLSearchParams({ date, heure, duree: duree.toString() });
  const res = await apiFetch(`api/orders/availability?${params.toString()}`, {
    headers: defaultHeaders(),
  });
  if (!res.ok) throw new Error("Erreur lors de la vérification de disponibilité");
  return res.json();
}

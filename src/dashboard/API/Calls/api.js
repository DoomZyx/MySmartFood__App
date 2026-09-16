import { apiFetch } from "../http.js";

const jsonHeaders = { "Content-Type": "application/json" };

export async function fetchCalls(page = 1, limit = 10, filters = {}) {
  const params = new URLSearchParams();
  params.append("page", page.toString());
  params.append("limit", limit.toString());
  if (filters.date) params.append("date", filters.date);
  if (filters.nom) params.append("nom", filters.nom);
  if (filters.telephone) params.append("telephone", filters.telephone);

  const res = await apiFetch(`api/calls?${params.toString()}`, {
    headers: jsonHeaders,
  });
  if (!res.ok) throw new Error("Erreur API");
  return res.json();
}

export async function fetchCallsByDate() {
  const res = await apiFetch("api/calls/dates");
  if (!res.ok) throw new Error("Erreur API");
  return res.json();
}

export async function fetchCall(id) {
  if (!id) throw new Error("ID manquant pour la requête");
  const res = await apiFetch(`api/calls/${id}`, { headers: jsonHeaders });
  if (!res.ok) throw new Error("Erreur API");
  return res.json();
}

export async function createCall(callData) {
  const res = await apiFetch("api/callsdata", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(callData),
  });
  if (!res.ok) throw new Error("Erreur lors de la création de l'appel");
  return res.json();
}

export async function updateCallStatus(id, status) {
  if (!id) throw new Error("ID manquant pour la mise à jour");
  if (!status) throw new Error("Statut manquant");

  const res = await apiFetch(`api/calls/${id}/status`, {
    method: "PATCH",
    headers: jsonHeaders,
    body: JSON.stringify({ statut: status }),
  });

  if (!res.ok) {
    throw new Error(
      `Erreur lors de la mise à jour du statut: ${res.status} ${res.statusText}`
    );
  }

  return res.json();
}

export async function deleteCall(id) {
  if (!id) throw new Error("ID manquant pour la suppression");
  const res = await apiFetch(`api/calls/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`Erreur lors de la suppression: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

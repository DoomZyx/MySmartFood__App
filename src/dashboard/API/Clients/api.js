import { apiFetch } from "../http.js";

export async function updateClient(id, clientData) {
  if (!id) throw new Error("ID manquant pour la mise à jour");
  if (!clientData) throw new Error("Données client manquantes");

  const res = await apiFetch(`api/calls/${id}/client`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(clientData),
  });
  if (!res.ok) throw new Error("Erreur lors de la mise à jour du client");
  return res.json();
}

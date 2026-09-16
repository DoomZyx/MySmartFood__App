import { isAuthenticated } from "../API/auth";
import { apiFetch } from "../API/http.js";

export async function fetchLlmUsage({ limit = 50, signal } = {}) {
  if (!isAuthenticated()) {
    throw new Error("Session expirée, veuillez vous reconnecter.");
  }

  const params = new URLSearchParams({ limit: String(limit) });
  const response = await apiFetch(`api/usage?${params}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
  });

  if (!response.ok) {
    throw new Error("Impossible de récupérer l'usage LLM.");
  }

  return response.json();
}

import { apiFetch, sessionHeaders } from "../http.js";

export async function fetchDashboardToday() {
  const res = await apiFetch("api/dashboard/today", {
    headers: sessionHeaders({ "Content-Type": "application/json" }),
  });
  if (!res.ok) throw new Error("Erreur API");
  return res.json();
}

export async function fetchDashboardVenue() {
  const res = await apiFetch("api/dashboard/venue", {
    headers: sessionHeaders({ "Content-Type": "application/json" }),
  });
  if (!res.ok) throw new Error("Erreur API");
  return res.json();
}

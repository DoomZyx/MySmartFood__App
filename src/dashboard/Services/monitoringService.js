import { isAuthenticated } from "../API/auth";
import { apiFetch } from "../API/http.js";

export async function getMonitoring({ signal } = {}) {
  if (!isAuthenticated()) {
    throw new Error("monitoring.errors.unauthenticated");
  }

  const response = await apiFetch("api/monitoring", {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(
      typeof payload?.error === "string"
        ? payload.error
        : "monitoring.errors.fetchFailed",
    );
    error.status = response.status;
    throw error;
  }

  return response.json();
}

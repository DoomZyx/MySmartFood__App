import { apiFetch } from "../http.js";

const jsonHeaders = { "Content-Type": "application/json" };

async function readJson(res) {
  return res.json().catch(() => ({}));
}

export async function listUnreadNotifications() {
  const res = await apiFetch("api/notifications", { headers: jsonHeaders });
  const body = await readJson(res);
  if (!res.ok) {
    throw new Error(body.error || body.message || "Impossible de charger les notifications");
  }
  const raw = Array.isArray(body.data)
    ? body.data
    : Array.isArray(body.notifications)
      ? body.notifications
      : Array.isArray(body)
        ? body
        : [];
  if (typeof import.meta !== "undefined" && import.meta.env?.DEV) {
    console.log("[NOTIF] GET /api/notifications count=" + raw.length);
  }
  return raw;
}

export async function markNotificationRead(id) {
  if (!id) return;
  const res = await apiFetch(`api/notifications/${id}/read`, {
    method: "PATCH",
    headers: jsonHeaders,
  });
  if (!res.ok && res.status !== 404) {
    const body = await readJson(res);
    throw new Error(body.error || body.message || "Impossible de marquer la notification lue");
  }
}

export async function markAllNotificationsRead() {
  const res = await apiFetch("api/notifications/read-all", {
    method: "POST",
    headers: jsonHeaders,
  });
  if (!res.ok) {
    const body = await readJson(res);
    throw new Error(body.error || body.message || "Impossible de vider les notifications");
  }
}

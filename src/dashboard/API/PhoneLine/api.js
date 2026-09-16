import { apiFetch } from "../http.js";

const jsonHeaders = { "Content-Type": "application/json" };

async function readErrorBody(res) {
  try {
    const body = await res.json();
    return body?.error ?? body?.message ?? res.statusText ?? "Erreur inconnue";
  } catch {
    return res.statusText || "Erreur inconnue";
  }
}

export async function getPhoneLineStatus() {
  const res = await apiFetch("api/phone-line", { headers: jsonHeaders });
  if (!res.ok) {
    const msg = await readErrorBody(res);
    throw new Error(msg);
  }
  return res.json();
}

export async function updatePhoneLineEnabled(enabled) {
  const res = await apiFetch("api/phone-line", {
    method: "PATCH",
    headers: jsonHeaders,
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) {
    const msg = await readErrorBody(res);
    throw new Error(msg);
  }
  return res.json();
}

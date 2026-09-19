const PREPROD_DB = "mysmartfood_preprod";
const PREPROD_CWD_SUFFIX = "/mysmartfood-preprod/backend";

export function databaseNameFromUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).pathname.replace(/^\//, "").split("?")[0];
  } catch {
    return raw.split("/").pop()?.split("?")[0] || "";
  }
}

export function assertPreprodDatabaseName(url) {
  const name = databaseNameFromUrl(url);
  if (name !== PREPROD_DB) {
    throw new Error(
      `Cible preprod refusee: base '${name || "inconnue"}' (attendu ${PREPROD_DB})`
    );
  }
}

export function assertPreprodCwd(cwd) {
  const path = String(cwd || "").replace(/\/+$/, "");
  if (!path.endsWith(PREPROD_CWD_SUFFIX)) {
    throw new Error(`CWD preprod refuse: ${cwd}`);
  }
}

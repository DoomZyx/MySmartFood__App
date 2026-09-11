import { getPool } from "./pool.js";

/** Nom du réglage PostgreSQL lu par les politiques RLS du plan de données. */
export const TENANT_SETTING = "app.tenant_id";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function runInTransaction(client, fn) {
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    // Le ROLLBACK peut échouer si la connexion est déjà perdue : ne pas masquer l'erreur d'origine.
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Transaction sur le plan de contrôle (tables globales, sans RLS).
 * @param {(client: import("pg").PoolClient) => Promise<unknown>} fn
 */
export async function withTransaction(fn) {
  const client = await getPool().connect();
  return runInTransaction(client, fn);
}

/**
 * Transaction sur le plan de données, avec contexte tenant.
 *
 * Le troisième argument `true` de set_config rend le réglage local à la transaction :
 * il est automatiquement effacé au COMMIT ou au ROLLBACK et ne fuit donc jamais vers
 * la requête suivante qui réutilisera cette connexion du pool.
 *
 * @param {string} tenantId - UUID du tenant, résolu côté serveur, jamais fourni par le client
 * @param {(client: import("pg").PoolClient) => Promise<unknown>} fn
 */
export async function withTenant(tenantId, fn) {
  if (typeof tenantId !== "string" || !UUID_PATTERN.test(tenantId)) {
    throw new Error("withTenant: tenantId doit être un UUID valide");
  }
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config($1, $2, true)", [TENANT_SETTING, tenantId]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

import { getPool } from "./pool.js";

const REQUIRED_RELATIONS = ["twilio_bundles", "llm_usage_events"];

/**
 * Échoue au démarrage si le schéma attendu n'est pas présent.
 * Ne lance pas les migrations : le rôle applicatif n'a pas le droit DDL.
 */
export async function assertRequiredSchema() {
  const pool = getPool();
  const checks = REQUIRED_RELATIONS.map((name) => `to_regclass('public.${name}') AS ${name}`);
  const { rows } = await pool.query(`SELECT ${checks.join(", ")}`);
  const row = rows[0] || {};
  const missing = REQUIRED_RELATIONS.filter((name) => !row[name]);
  if (missing.length === 0) {
    return;
  }
  throw new Error(
    `Tables PostgreSQL manquantes : ${missing.join(", ")}. ` +
      "Sur le serveur, depuis backend : APP_ENV=prod pnpm db:migrate " +
      "(DATABASE_URL et DATABASE_URL_OWNER doivent viser la même base)."
  );
}

import fs from "node:fs";
import pg from "pg";
import logger from "#logger";

const { Pool } = pg;

/** Pool unique pour tout le service. Aucun `new Pool` ailleurs dans le code. */
let pool = null;

/**
 * Configuration SSL de la connexion PostgreSQL.
 * La vérification du certificat n'est jamais désactivée implicitement : il faut
 * DATABASE_SSL=disable, refusé en production.
 */
export function buildSslConfig() {
  const mode = (process.env.DATABASE_SSL || "").trim().toLowerCase();
  const isProduction = process.env.NODE_ENV === "production";

  if (mode === "disable") {
    if (isProduction) {
      throw new Error("DATABASE_SSL=disable est interdit en production");
    }
    return false;
  }

  // Hors production et sans consigne explicite : PostgreSQL local sans TLS.
  if (!mode && !isProduction) {
    return false;
  }

  const rawCa = process.env.DATABASE_SSL_CA;
  if (!rawCa) {
    return { rejectUnauthorized: true };
  }
  const ca = rawCa.includes("-----BEGIN") ? rawCa : fs.readFileSync(rawCa, "utf8");
  return { rejectUnauthorized: true, ca };
}

export function buildPoolConfig(connectionString) {
  return {
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX) || 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: buildSslConfig(),
  };
}

/**
 * Ouvre le pool applicatif et vérifie la connexion.
 * DATABASE_URL doit pointer sur le rôle applicatif (non propriétaire, sans BYPASSRLS).
 */
export async function connectDatabase() {
  if (pool) {
    return pool;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL manquant");
  }

  const candidate = new Pool(buildPoolConfig(connectionString));
  candidate.on("error", (err) => {
    logger.error("Client PostgreSQL inactif en erreur", { err: err.message });
  });

  const client = await candidate.connect();
  try {
    await client.query("SELECT 1");
  } finally {
    client.release();
  }

  pool = candidate;
  logger.info("PostgreSQL connecté", { poolMax: candidate.options.max });
  return pool;
}

export function getPool() {
  if (!pool) {
    throw new Error("Pool PostgreSQL non initialisé. Appeler connectDatabase() au démarrage.");
  }
  return pool;
}

export async function closeDatabase() {
  if (!pool) {
    return;
  }
  const current = pool;
  pool = null;
  await current.end();
}

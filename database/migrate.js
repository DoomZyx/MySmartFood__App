import "../Config/env.js";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { buildSslConfig } from "./pool.js";

const { Client } = pg;

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");
const ROLE_NAME_PATTERN = /^[a-z_][a-z0-9_]*$/;

/** Les migrations s'exécutent avec le rôle propriétaire, jamais avec le rôle applicatif. */
function getOwnerConnectionString() {
  const connectionString = process.env.DATABASE_URL_OWNER || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL_OWNER ou DATABASE_URL requis pour les migrations");
  }
  return connectionString;
}

export function getRuntimeRole() {
  const role = (process.env.APP_DB_RUNTIME_ROLE || "app_runtime").trim();
  if (!ROLE_NAME_PATTERN.test(role)) {
    throw new Error(`Nom de rôle applicatif invalide : ${role}`);
  }
  return role;
}

function checksumOf(sql) {
  return crypto.createHash("sha256").update(sql).digest("hex");
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function readMigrations() {
  const entries = await fs.readdir(MIGRATIONS_DIR);
  const files = entries.filter((name) => name.endsWith(".sql")).sort();
  const migrations = [];
  for (const name of files) {
    const sql = await fs.readFile(path.join(MIGRATIONS_DIR, name), "utf8");
    migrations.push({ name, sql, checksum: checksumOf(sql) });
  }
  return migrations;
}

/**
 * Refuse de migrer si le rôle applicatif peut contourner RLS : dans ce cas
 * toutes les politiques d'isolation seraient décoratives.
 */
async function assertRuntimeRoleIsSafe(client, role) {
  const { rows } = await client.query(
    "SELECT rolbypassrls, rolsuper FROM pg_roles WHERE rolname = $1",
    [role]
  );
  if (rows.length === 0) {
    throw new Error(`Rôle applicatif ${role} inexistant. Lancer d'abord: node database/bootstrapRoles.js`);
  }
  if (rows[0].rolbypassrls || rows[0].rolsuper) {
    throw new Error(
      `Rôle applicatif ${role} possède BYPASSRLS ou SUPERUSER : l'isolation multi-tenant serait inopérante`
    );
  }
}

/**
 * Privilèges du rôle applicatif : DML uniquement, aucun DDL.
 * Rejoué après chaque migration pour couvrir les tables nouvellement créées.
 */
async function applyRuntimeGrants(client, role) {
  await client.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
  await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${role}`);
  await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${role}`);
  await client.query(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${role}`
  );
  await client.query(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${role}`
  );
}

/**
 * Applique les migrations non encore jouées, dans l'ordre alphabétique des fichiers.
 * @returns {Promise<string[]>} noms des migrations appliquées lors de cet appel
 */
export async function runMigrations() {
  const client = new Client({
    connectionString: getOwnerConnectionString(),
    ssl: buildSslConfig(),
  });
  await client.connect();

  try {
    const role = getRuntimeRole();
    await assertRuntimeRoleIsSafe(client, role);
    await ensureMigrationsTable(client);

    const migrations = await readMigrations();
    const { rows } = await client.query("SELECT name, checksum FROM schema_migrations");
    const applied = new Map(rows.map((row) => [row.name, row.checksum]));

    const executed = [];
    for (const migration of migrations) {
      const previousChecksum = applied.get(migration.name);
      if (previousChecksum) {
        if (previousChecksum !== migration.checksum) {
          throw new Error(
            `Migration ${migration.name} modifiée après application. Créer une nouvelle migration au lieu de l'éditer.`
          );
        }
        continue;
      }

      await client.query("BEGIN");
      try {
        await client.query(migration.sql);
        await client.query("INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)", [
          migration.name,
          migration.checksum,
        ]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        throw new Error(`Migration ${migration.name} échouée : ${err.message}`);
      }
      executed.push(migration.name);
    }

    await applyRuntimeGrants(client, role);
    return executed;
  } finally {
    await client.end();
  }
}

const isDirectRun =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  runMigrations()
    .then((executed) => {
      const message =
        executed.length === 0
          ? "Aucune migration à appliquer.\n"
          : `Migrations appliquées : ${executed.join(", ")}\n`;
      process.stdout.write(message);
    })
    .catch((err) => {
      process.stderr.write(`${err.message}\n`);
      process.exit(1);
    });
}

import "../Config/env.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { buildSslConfig } from "./pool.js";
import { getRuntimeRole } from "./migrate.js";

const { Client } = pg;

/**
 * Crée le rôle applicatif PostgreSQL, à lancer une fois par environnement avec un
 * compte administrateur, avant la première migration.
 *
 * Le rôle est volontairement dépourvu de BYPASSRLS et de SUPERUSER, et ne possède
 * aucune table : ce sont les trois conditions pour que Row-Level Security s'applique
 * réellement aux requêtes de l'application.
 */
export async function bootstrapRoles() {
  const connectionString = process.env.DATABASE_URL_ADMIN || process.env.DATABASE_URL_OWNER;
  if (!connectionString) {
    throw new Error("DATABASE_URL_ADMIN ou DATABASE_URL_OWNER requis pour créer les rôles");
  }

  const password = process.env.APP_DB_RUNTIME_PASSWORD;
  if (!password || typeof password !== "string" || password.length < 16) {
    throw new Error("APP_DB_RUNTIME_PASSWORD requis (16 caractères minimum)");
  }

  const role = getRuntimeRole();
  const client = new Client({ connectionString, ssl: buildSslConfig() });
  await client.connect();

  try {
    const created = await client.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [role]);
    if (created.rowCount === 0) {
      await client.query(`CREATE ROLE ${role} LOGIN`);
    }

    // Les mots de passe et les identifiants ne peuvent pas être passés en paramètres liés.
    await client.query(
      `ALTER ROLE ${role} WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD ${client.escapeLiteral(password)}`
    );

    const { rows } = await client.query("SELECT current_database() AS name");
    await client.query(
      `GRANT CONNECT ON DATABASE ${client.escapeIdentifier(rows[0].name)} TO ${role}`
    );

    return { role, database: rows[0].name };
  } finally {
    await client.end();
  }
}

const isDirectRun =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  bootstrapRoles()
    .then(({ role, database }) => {
      process.stdout.write(`Rôle applicatif ${role} prêt sur la base ${database}.\n`);
    })
    .catch((err) => {
      process.stderr.write(`${err.message}\n`);
      process.exit(1);
    });
}

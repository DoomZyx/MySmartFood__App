import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";
import { buildSslConfig, closeDatabase, connectDatabase, getPool } from "./pool.js";
import { withTenant } from "./transaction.js";
import { runMigrations } from "./migrate.js";
import { bootstrapRoles } from "./bootstrapRoles.js";

const { Client } = pg;

/**
 * Tests d'isolation multi-tenant sur une vraie base PostgreSQL.
 *
 * Deux modes :
 *  - TEST_DATABASE_URL fourni : la base cible est utilisée telle quelle. Elle doit être
 *    jetable et vide. Avec TEST_DATABASE_RESET=true, le schéma public est réinitialisé
 *    avant chaque exécution, ce qui rend la suite rejouable.
 *  - sinon : un cluster PostgreSQL embarqué est démarré pour la durée des tests
 *
 * PostgreSQL refuse de démarrer sous l'utilisateur root : dans ce cas, fournir
 * TEST_DATABASE_URL ou lancer la suite avec un compte non privilégié.
 */

// Paramètres de test isolés du .env applicatif.
dotenv.config({ path: path.join(process.cwd(), ".env.test"), quiet: true });

/** Doit rester synchronisé avec la liste du bloc RLS de 002_tenant_plane.sql. */
const TENANT_TABLES = [
  "tenant_settings",
  "menu_categories",
  "menu_items",
  "opening_hours",
  "clients",
  "orders",
  "order_items",
  "reservations",
  "call_quotas",
  "call_sessions",
  "failed_extractions",
  "tenant_amenities",
  "menu_option_groups",
  "menu_options",
  "menu_item_option_groups",
  "menu_compositions",
  "order_item_options",
  "mongo_import_refs",
  "migration_rejections",
];

const RUNTIME_ROLE = "app_runtime_test";
const RUNTIME_PASSWORD = "isolation_test_password_0123456789";
const TEST_DATABASE_NAME = "mysmartfood_isolation_test";

let embedded = null;
let ownerClient = null;
let tenantA = null;
let tenantB = null;
let clientAId = null;

/** Démarrage d'un cluster PostgreSQL puis migrations : prévoir une marge large. */
const SETUP_TIMEOUT_MS = 180000;

function buildRuntimeUrl(ownerUrl) {
  const url = new URL(ownerUrl);
  url.username = RUNTIME_ROLE;
  url.password = RUNTIME_PASSWORD;
  return url.toString();
}

async function startEmbeddedPostgres() {
  const { default: EmbeddedPostgres } = await import("embedded-postgres");
  const port = Number(process.env.TEST_PG_PORT) || 54329;
  const instance = new EmbeddedPostgres({
    databaseDir: path.join(process.cwd(), ".tmp", "rls-test-cluster"),
    user: "pgowner",
    password: "pgowner_password",
    port,
    persistent: false,
  });

  try {
    await instance.initialise();
    await instance.start();
  } catch (err) {
    throw new Error(
      "Impossible de démarrer le cluster PostgreSQL de test : " +
        `${err.message}\n` +
        "PostgreSQL refuse de s'exécuter sous root. Lancer la suite avec un compte non " +
        "privilégié, ou fournir TEST_DATABASE_URL pointant sur une base jetable dont " +
        "l'utilisateur possède le droit CREATEROLE."
    );
  }

  embedded = instance;
  return `postgres://pgowner:pgowner_password@localhost:${port}/postgres`;
}

/**
 * Réinitialise le schéma public de la base de test.
 * Destructif par nature : réservé à une base jetable, via TEST_DATABASE_RESET=true.
 */
async function resetPublicSchema(ownerUrl) {
  const client = new Client({ connectionString: ownerUrl, ssl: buildSslConfig() });
  await client.connect();
  try {
    await client.query("DROP SCHEMA IF EXISTS public CASCADE");
    await client.query("CREATE SCHEMA public");
  } finally {
    await client.end();
  }
}

/** Prépare une base vierge et renvoie l'URL de connexion propriétaire. */
async function prepareOwnerDatabase() {
  if (process.env.TEST_DATABASE_URL) {
    const ownerUrl = process.env.TEST_DATABASE_URL;
    if (process.env.TEST_DATABASE_RESET === "true") {
      await resetPublicSchema(ownerUrl);
    }
    return ownerUrl;
  }

  const adminUrl = await startEmbeddedPostgres();
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${TEST_DATABASE_NAME}`);
    await admin.query(`CREATE DATABASE ${TEST_DATABASE_NAME}`);
  } finally {
    await admin.end();
  }

  const url = new URL(adminUrl);
  url.pathname = `/${TEST_DATABASE_NAME}`;
  return url.toString();
}

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  // Une base distante exige TLS : renseigner DATABASE_SSL dans .env.test le cas échéant.
  if (!process.env.DATABASE_SSL) {
    process.env.DATABASE_SSL = "disable";
  }

  const ownerUrl = await prepareOwnerDatabase();

  process.env.APP_DB_RUNTIME_ROLE = RUNTIME_ROLE;
  process.env.APP_DB_RUNTIME_PASSWORD = RUNTIME_PASSWORD;
  process.env.DATABASE_URL_ADMIN = ownerUrl;
  process.env.DATABASE_URL_OWNER = ownerUrl;
  process.env.DATABASE_URL = buildRuntimeUrl(ownerUrl);

  await bootstrapRoles();
  await runMigrations();
  await connectDatabase();

  ownerClient = new Client({ connectionString: ownerUrl });
  await ownerClient.connect();

  // Le plan de contrôle n'est pas soumis à RLS : les tenants de test y sont créés directement.
  const owner = await ownerClient.query(
    "INSERT INTO users (email, email_verified) VALUES ($1, TRUE) RETURNING id",
    ["isolation@example.test"]
  );
  const ownerUserId = owner.rows[0].id;

  const inserted = await ownerClient.query(
    `INSERT INTO tenants (slug, name, owner_user_id)
     VALUES ('tenant-a', 'Tenant A', $1), ('tenant-b', 'Tenant B', $1)
     RETURNING id, slug`,
    [ownerUserId]
  );
  tenantA = inserted.rows.find((row) => row.slug === "tenant-a").id;
  tenantB = inserted.rows.find((row) => row.slug === "tenant-b").id;

  const seededA = await withTenant(tenantA, (client) =>
    client.query(
      "INSERT INTO clients (tenant_id, phone, name) VALUES ($1, $2, $3) RETURNING id",
      [tenantA, "+33100000001", "Client A"]
    )
  );
  clientAId = seededA.rows[0].id;

  await withTenant(tenantB, (client) =>
    client.query("INSERT INTO clients (tenant_id, phone, name) VALUES ($1, $2, $3)", [
      tenantB,
      "+33100000002",
      "Client B",
    ])
  );
}, SETUP_TIMEOUT_MS);

afterAll(async () => {
  if (ownerClient) {
    await ownerClient.end();
  }
  await closeDatabase();
  if (embedded) {
    await embedded.stop();
  }
}, SETUP_TIMEOUT_MS);

describe("configuration du rôle applicatif", () => {
  test("le rôle applicatif ne peut pas contourner RLS", async () => {
    const { rows } = await ownerClient.query(
      "SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = $1",
      [RUNTIME_ROLE]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].rolsuper).toBe(false);
    expect(rows[0].rolbypassrls).toBe(false);
  });

  test("le rôle applicatif ne possède aucune table du plan de données", async () => {
    const { rows } = await ownerClient.query(
      `SELECT c.relname
         FROM pg_class c
         JOIN pg_roles r ON r.oid = c.relowner
        WHERE c.relname = ANY($1::text[]) AND r.rolname = $2`,
      [TENANT_TABLES, RUNTIME_ROLE]
    );
    expect(rows).toEqual([]);
  });
});

describe("activation de Row-Level Security", () => {
  test("chaque table du plan de données a RLS activée et forcée", async () => {
    const { rows } = await ownerClient.query(
      `SELECT relname, relrowsecurity, relforcerowsecurity
         FROM pg_class
        WHERE relname = ANY($1::text[])`,
      [TENANT_TABLES]
    );

    expect(rows).toHaveLength(TENANT_TABLES.length);
    const notProtected = rows.filter(
      (row) => !row.relrowsecurity || !row.relforcerowsecurity
    );
    expect(notProtected).toEqual([]);
  });

  test("chaque table du plan de données porte la politique tenant_isolation", async () => {
    const { rows } = await ownerClient.query(
      "SELECT tablename FROM pg_policies WHERE policyname = 'tenant_isolation'"
    );
    const covered = rows.map((row) => row.tablename).sort();
    expect(covered).toEqual([...TENANT_TABLES].sort());
  });
});

describe("cloisonnement des lectures", () => {
  test("un tenant ne voit que ses propres lignes", async () => {
    const fromA = await withTenant(tenantA, (client) =>
      client.query("SELECT tenant_id, phone FROM clients")
    );
    expect(fromA.rows).toHaveLength(1);
    expect(fromA.rows[0].tenant_id).toBe(tenantA);

    const fromB = await withTenant(tenantB, (client) =>
      client.query("SELECT tenant_id, phone FROM clients")
    );
    expect(fromB.rows).toHaveLength(1);
    expect(fromB.rows[0].tenant_id).toBe(tenantB);
  });

  test("une lecture ciblant explicitement un autre tenant ne renvoie rien", async () => {
    const result = await withTenant(tenantB, (client) =>
      client.query("SELECT id FROM clients WHERE tenant_id = $1", [tenantA])
    );
    expect(result.rows).toEqual([]);
  });

  test("sans contexte tenant, aucune ligne n'est visible", async () => {
    // Requête hors withTenant : app.tenant_id n'est pas positionné, la politique échoue en fermeture.
    const result = await getPool().query("SELECT id FROM clients");
    expect(result.rows).toEqual([]);
  });
});

describe("cloisonnement des écritures", () => {
  test("écrire dans le périmètre d'un autre tenant est refusé", async () => {
    await expect(
      withTenant(tenantB, (client) =>
        client.query("INSERT INTO clients (tenant_id, phone) VALUES ($1, $2)", [
          tenantA,
          "+33100000003",
        ])
      )
    ).rejects.toMatchObject({ code: "42501" });
  });

  test("modifier la ligne d'un autre tenant n'affecte aucune ligne", async () => {
    const updated = await withTenant(tenantB, (client) =>
      client.query("UPDATE clients SET name = $1 WHERE tenant_id = $2", ["Detourne", tenantA])
    );
    expect(updated.rowCount).toBe(0);

    const check = await withTenant(tenantA, (client) =>
      client.query("SELECT name FROM clients WHERE tenant_id = $1", [tenantA])
    );
    expect(check.rows[0].name).toBe("Client A");
  });

  test("supprimer la ligne d'un autre tenant n'affecte aucune ligne", async () => {
    const deleted = await withTenant(tenantB, (client) =>
      client.query("DELETE FROM clients WHERE tenant_id = $1", [tenantA])
    );
    expect(deleted.rowCount).toBe(0);

    const check = await withTenant(tenantA, (client) =>
      client.query("SELECT COUNT(*)::int AS total FROM clients")
    );
    expect(check.rows[0].total).toBe(1);
  });

  test("une clé étrangère ne peut pas pointer vers la ligne d'un autre tenant", async () => {
    // Les contrôles d'intégrité contournent RLS : c'est la clé composée qui bloque ici.
    await expect(
      withTenant(tenantB, (client) =>
        client.query("INSERT INTO orders (tenant_id, client_id) VALUES ($1, $2)", [
          tenantB,
          clientAId,
        ])
      )
    ).rejects.toMatchObject({ code: "23503" });
  });
});

describe("étanchéité du contexte tenant", () => {
  test("le contexte ne fuit pas vers la requête suivante du pool", async () => {
    await withTenant(tenantA, (client) => client.query("SELECT 1"));

    // set_config local à la transaction : la connexion rendue au pool n'a plus de contexte.
    const result = await getPool().query(
      "SELECT current_setting('app.tenant_id', true) AS tenant_id"
    );
    expect(result.rows[0].tenant_id === null || result.rows[0].tenant_id === "").toBe(
      true
    );
  });

  test("withTenant refuse un identifiant qui n'est pas un UUID", async () => {
    await expect(withTenant("' OR 1=1 --", async () => null)).rejects.toThrow(
      "tenantId doit être un UUID valide"
    );
  });
});

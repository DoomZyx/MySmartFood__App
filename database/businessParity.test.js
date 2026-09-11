import path from "node:path";
import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import pg from "pg";
import { buildSslConfig, closeDatabase, connectDatabase } from "./pool.js";
import { withTenant } from "./transaction.js";
import { runMigrations } from "./migrate.js";
import { bootstrapRoles } from "./bootstrapRoles.js";
import { importTenantDocuments } from "../scripts/mongoImport/importEngine.js";
import { OrderService } from "../Business/services/OrderService.js";
import { loadLegacyPricing } from "../Business/services/MenuCatalogService.js";
import { orderToLegacy } from "../Business/mappers/orderMapper.js";

dotenv.config({ path: path.join(process.cwd(), ".env.test"), quiet: true });

const { Client } = pg;
const SETUP_TIMEOUT_MS = 180000;
const RUNTIME_ROLE = "app_runtime_parity";
const RUNTIME_PASSWORD = "parity_test_password_0123456789";

const describeIf = process.env.TEST_DATABASE_URL ? describe : describe.skip;

let ownerClient;
let tenantId;
let ownerUserId;

function buildRuntimeUrl(ownerUrl) {
  const url = new URL(ownerUrl);
  url.username = RUNTIME_ROLE;
  url.password = RUNTIME_PASSWORD;
  return url.toString();
}

describeIf("parité métier PostgreSQL", () => {
  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    if (!process.env.DATABASE_SSL) process.env.DATABASE_SSL = "disable";
    const ownerUrl = process.env.TEST_DATABASE_URL;
    if (process.env.TEST_DATABASE_RESET === "true") {
      const reset = new Client({ connectionString: ownerUrl, ssl: buildSslConfig() });
      await reset.connect();
      await reset.query("DROP SCHEMA IF EXISTS public CASCADE");
      await reset.query("CREATE SCHEMA public");
      await reset.end();
    }
    process.env.APP_DB_RUNTIME_ROLE = RUNTIME_ROLE;
    process.env.APP_DB_RUNTIME_PASSWORD = RUNTIME_PASSWORD;
    process.env.DATABASE_URL_ADMIN = ownerUrl;
    process.env.DATABASE_URL_OWNER = ownerUrl;
    process.env.DATABASE_URL = buildRuntimeUrl(ownerUrl);
    await bootstrapRoles();
    await runMigrations();
    await connectDatabase();
    ownerClient = new Client({ connectionString: ownerUrl, ssl: buildSslConfig() });
    await ownerClient.connect();
    const owner = await ownerClient.query(
      "INSERT INTO users (email, email_verified) VALUES ($1, TRUE) RETURNING id",
      ["parity@example.test"]
    );
    ownerUserId = owner.rows[0].id;
    const tenant = await ownerClient.query(
      `INSERT INTO tenants (slug, name, owner_user_id, status)
       VALUES ('parity', 'Parity', $1, 'active') RETURNING id`,
      [ownerUserId]
    );
    tenantId = tenant.rows[0].id;
  }, SETUP_TIMEOUT_MS);

  afterAll(async () => {
    if (ownerClient) await ownerClient.end();
    await closeDatabase();
  }, SETUP_TIMEOUT_MS);

  test("import apply idempotent et règles métier", async () => {
    const fixture = JSON.parse(
      await readFile(path.join(process.cwd(), "scripts/mongoImport/fixtures/parity-sample.json"), "utf8")
    );
    const first = await withTenant(tenantId, (client) =>
      importTenantDocuments(client, tenantId, fixture, { apply: true })
    );
    const second = await withTenant(tenantId, (client) =>
      importTenantDocuments(client, tenantId, fixture, { apply: true })
    );
    expect(first.pg.orders).toBe(1);
    expect(second.pg.orders).toBe(1);
    expect(first.pg.orderItems).toBe(1);
    expect(second.samples[0]?.pgId).toBe(first.samples[0]?.pgId);

    const pricing = await loadLegacyPricing(tenantId);
    expect(pricing.menuPricing.tacos.produits[0].options.viandes.choix).toContain("Poulet");
    expect(pricing.restaurantInfo.horairesOuverture.mardi.ouvert).toBe(false);
    expect(pricing.amenities.find((item) => item.slug === "pmr").status).toBe("unknown");

    const created = await OrderService.createOrder(tenantId, {
      nom: "Bob",
      telephone: "0699887766",
      date: "2026-03-02",
      heure: "12:00",
      statut: "confirme",
      createdBy: "manual",
      commandes: [{ nom: "Tacos M", quantite: 1 }],
    });
    expect(created.commandes[0].prixUnitaire).toBe(8.5);

    await expect(
      OrderService.createReservation(tenantId, {
        nom: "Groupe",
        telephone: "0611223344",
        date: "2026-03-02",
        heure: "19:30",
        nombrePersonnes: 99,
        statut: "confirme",
      })
    ).rejects.toMatchObject({ statusCode: 409 });

    const other = await ownerClient.query(
      `INSERT INTO tenants (slug, name, owner_user_id, status)
       VALUES ('other', 'Other', $1, 'active') RETURNING id`,
      [ownerUserId]
    );
    const otherId = other.rows[0].id;
    const leaked = await withTenant(otherId, (client) =>
      client.query("SELECT id FROM orders")
    );
    expect(leaked.rows).toEqual([]);
    expect(orderToLegacy({ ...created, items: [] })._id).toBe(created._id);
  });
});

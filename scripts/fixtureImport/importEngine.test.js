import { readFile } from "node:fs/promises";
import path from "node:path";
import { hasBlockingDelta, importTenantDocuments, parseArgs } from "./importEngine.js";

const fixturePath = path.join(process.cwd(), "scripts/mongoImport/fixtures/parity-sample.json");

function dryClient() {
  return { query: async () => ({ rows: [], rowCount: 0 }) };
}

describe("import Mongo", () => {
  test("dry-run par défaut, apply seulement si explicite", () => {
    expect(parseArgs([]).dryRun).toBe(true);
    expect(parseArgs(["--apply"]).apply).toBe(true);
    expect(parseArgs(["--apply", "--dry-run"]).apply).toBe(false);
  });

  test("conserve les lignes de commande et détecte un rejet", async () => {
    const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
    const report = await importTenantDocuments(
      dryClient(),
      "11111111-1111-1111-1111-111111111111",
      {
        instanceId: fixture.instanceId,
        pricing: fixture.pricing,
        clients: fixture.clients,
        orders: fixture.orders,
        reservations: fixture.reservations,
        quotas: [],
        calls: [],
        failedExtractions: [],
      },
      { apply: false }
    );
    expect(report.totals.mongoOrderLines).toBe(1);
    expect(report.imported.orders).toBe(1);
    expect(report.imported.reservations).toBe(1);
    expect(report.rejected).toEqual([]);

    const rejected = await importTenantDocuments(
      dryClient(),
      "11111111-1111-1111-1111-111111111111",
      {
        instanceId: "inst_default",
        pricing: null,
        clients: [],
        orders: [{ _id: "bad", commandes: [] }],
        reservations: [],
        quotas: [],
        calls: [],
        failedExtractions: [],
      },
      { apply: false }
    );
    expect(rejected.rejected[0].reason).toMatch(/date ou heure/);
    expect(hasBlockingDelta([rejected])).toBe(true);
  });
});

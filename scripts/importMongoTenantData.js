import "../Config/env.js";
import fs from "node:fs/promises";
import mongoose from "mongoose";
import { connectDatabase, closeDatabase } from "../database/pool.js";
import { withTenant } from "../database/transaction.js";
import {
  hasBlockingDelta,
  importTenantDocuments,
  loadMongoDocuments,
  parseArgs,
  parseTenantMap,
} from "./mongoImport/importEngine.js";

/**
 * Import Mongo -> PostgreSQL.
 * Défaut : --dry-run (aucune écriture).
 * Écriture : --apply
 *
 * Bascule contrôlée :
 * 1. Sauvegarde Mongo
 * 2. node scripts/importMongoTenantData.js
 * 3. Corriger les rejets
 * 4. node scripts/importMongoTenantData.js --apply
 * 5. Valider dashboard et voix
 * 6. Mongo en lecture seule jusqu'à acceptation ; ne pas retirer mongoose avant
 */
async function main() {
  const args = parseArgs();
  const tenantMap = parseTenantMap();
  if (tenantMap.size === 0 && !args.fixturesPath) {
    throw new Error("TENANT_MAP requis, ex. inst_default:<uuid>");
  }

  await connectDatabase();
  const reports = [];

  if (args.fixturesPath) {
    const fixtures = JSON.parse(await fs.readFile(args.fixturesPath, "utf8"));
    const docsList = Array.isArray(fixtures) ? fixtures : [fixtures];
    for (const docs of docsList) {
      const tenantId = docs.tenantId || tenantMap.get(docs.instanceId);
      if (!tenantId) throw new Error(`Pas de tenant pour ${docs.instanceId}`);
      if (args.apply) {
        const report = await withTenant(tenantId, (client) =>
          importTenantDocuments(client, tenantId, normalizeDocs(docs), { apply: true })
        );
        reports.push(report);
      } else {
        const report = await importTenantDocuments(
          dryRunClient(),
          tenantId,
          normalizeDocs(docs),
          { apply: false }
        );
        reports.push(report);
      }
    }
  } else {
    if (!process.env.MONGO_URI) throw new Error("MONGO_URI requis");
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;
    for (const [instanceId, tenantId] of tenantMap.entries()) {
      const docs = await loadMongoDocuments(db, instanceId);
      if (args.apply) {
        const report = await withTenant(tenantId, (client) =>
          importTenantDocuments(client, tenantId, docs, { apply: true })
        );
        reports.push(report);
      } else {
        reports.push(
          await importTenantDocuments(dryRunClient(), tenantId, docs, { apply: false })
        );
      }
    }
    await mongoose.connection.close();
  }

  await closeDatabase();
  process.stdout.write(`${JSON.stringify({ mode: args.apply ? "apply" : "dry-run", reports }, null, 2)}\n`);
  const emptySource = reports.every((report) =>
    Object.values(report.mongo || {}).every((value) => !value)
  );
  if (emptySource) {
    process.stderr.write(
      "Aucune donnée métier trouvée pour ce TENANT_MAP. Vérifier le nom de base dans MONGO_URI et les instanceId.\n"
    );
    process.exitCode = 1;
    return;
  }
  if (hasBlockingDelta(reports)) {
    process.exitCode = 1;
  }
}

function normalizeDocs(docs) {
  return {
    instanceId: docs.instanceId,
    pricing: docs.pricing || null,
    clients: docs.clients || [],
    orders: docs.orders || [],
    reservations: docs.reservations || [],
    quotas: docs.quotas || [],
    calls: docs.calls || [],
    failedExtractions: docs.failedExtractions || [],
  };
}

function dryRunClient() {
  return {
    query: async () => ({ rows: [], rowCount: 0 }),
  };
}

const isDirect = process.argv[1] && process.argv[1].endsWith("importMongoTenantData.js");
if (isDirect) {
  main().catch((err) => {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  });
}

export { main };

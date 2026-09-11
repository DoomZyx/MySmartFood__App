import "../Config/env.js";

/**
 * Bascule contrôlée Mongo -> PostgreSQL.
 * N'applique aucune écriture et ne retire pas mongoose.
 *
 * Étapes :
 * 1. Sauvegarde Mongo
 * 2. Dry-run : pnpm db:import-mongo
 * 3. Corriger les rejets listés dans le rapport
 * 4. Import : pnpm db:import-mongo -- --apply
 * 5. Valider dashboard et voix
 * 6. Laisser Mongo en lecture seule jusqu'à acceptation du rapport
 */
function main() {
  const ready = Boolean(process.env.MONGO_URI && process.env.TENANT_MAP && process.env.DATABASE_URL);
  const message = {
    mongoRemoved: false,
    mongooseKept: true,
    importDefaultMode: "dry-run",
    readyForDryRun: ready,
    nextCommand: ready
      ? "node scripts/importMongoTenantData.js"
      : "Renseigner MONGO_URI, TENANT_MAP et DATABASE_URL puis relancer le dry-run",
  };
  process.stdout.write(`${JSON.stringify(message, null, 2)}\n`);
  if (!ready) process.exitCode = 0;
}

main();

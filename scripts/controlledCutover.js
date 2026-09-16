import "../Config/env.js";

/**
 * Contrôle post-bascule : le runtime n'utilise plus Mongo.
 * L'import one-shot reste disponible via pnpm db:import-mongo.
 */
function main() {
  const pgReady = Boolean(process.env.DATABASE_URL);
  const message = {
    mongoRemovedFromRuntime: true,
    mongooseKeptForImportScript: true,
    importDefaultMode: "dry-run",
    postgresReady: pgReady,
    nextCommand: pgReady
      ? "Le backend lit uniquement PostgreSQL. Import historique : pnpm db:import-mongo"
      : "Renseigner DATABASE_URL",
  };
  process.stdout.write(`${JSON.stringify(message, null, 2)}\n`);
}

main();

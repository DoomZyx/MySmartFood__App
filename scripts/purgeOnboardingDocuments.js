import "../Config/env.js";
import { connectDatabase, closeDatabase } from "../database/pool.js";
import { purgeExpiredDocuments } from "../Business/services/DocumentComplianceService.js";

connectDatabase()
  .then(() => purgeExpiredDocuments())
  .then((count) => {
    process.stdout.write(`${count} document(s) purgé(s).\n`);
    return closeDatabase();
  })
  .catch((err) => {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  });

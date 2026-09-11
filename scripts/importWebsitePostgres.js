import "../Config/env.js";
import pg from "pg";
import { connectDatabase, closeDatabase, buildSslConfig } from "../database/pool.js";
import { getPool } from "../database/pool.js";
import { encryptGoogleId, hashGoogleId } from "../utils/accountIdentifierCrypto.js";

/**
 * Importe users, contacts, demos et profils depuis l'ancienne base site.
 * Usage : SOURCE_DATABASE_URL=postgres://... node scripts/importWebsitePostgres.js
 */
async function main() {
  const sourceUrl = process.env.SOURCE_DATABASE_URL;
  if (!sourceUrl) {
    throw new Error("SOURCE_DATABASE_URL requis (base site existante, lecture seule)");
  }
  await connectDatabase();
  const source = new pg.Client({ connectionString: sourceUrl, ssl: buildSslConfig() });
  await source.connect();
  const dest = getPool();
  const report = { users: 0, contacts: 0, demos: 0, profiles: 0, skipped: [] };

  const users = await source.query(
    `SELECT id, email, name, google_id, password_hash, avatar, created_at FROM users`
  );
  const userIdMap = new Map();
  for (const row of users.rows) {
    const existing = await dest.query(
      `SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [row.email]
    );
    if (existing.rows[0]) {
      userIdMap.set(row.id, existing.rows[0].id);
      continue;
    }
    const encryptedGoogleId = row.google_id ? encryptGoogleId(row.google_id) : null;
    const googleIdHash = row.google_id ? hashGoogleId(row.google_id) : null;
    const inserted = await dest.query(
      `INSERT INTO users (
         email, name, google_id, google_id_hash, password_hash,
         avatar_url, email_verified, created_at
       )
       VALUES (LOWER($1), $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        row.email,
        row.name,
        encryptedGoogleId,
        googleIdHash,
        row.password_hash,
        row.avatar,
        Boolean(row.google_id),
        row.created_at,
      ]
    );
    userIdMap.set(row.id, inserted.rows[0].id);
    report.users += 1;
  }

  const contacts = await source.query(`SELECT name, email, company, subject, message, status, created_at FROM contacts`);
  for (const row of contacts.rows) {
    const status = ["nouveau", "en_cours", "traite", "archive"].includes(row.status)
      ? row.status
      : "nouveau";
    await dest.query(
      `INSERT INTO contacts (name, email, company, subject, message, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [row.name, row.email, row.company, row.subject, row.message, status, row.created_at]
    );
    report.contacts += 1;
  }

  try {
    const demos = await source.query(`SELECT name, email, company, team_size, needs, preferred_time, duration, created_at FROM demos`);
    for (const row of demos.rows) {
      await dest.query(
        `INSERT INTO demos (name, email, company, team_size, needs, preferred_time, duration, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [row.name, row.email, row.company, row.team_size, row.needs, row.preferred_time, row.duration, row.created_at]
      );
      report.demos += 1;
    }
  } catch (err) {
    report.skipped.push(`demos: ${err.message}`);
  }

  try {
    const profiles = await source.query(
      `SELECT user_id, nom_etablissement, adresse, code_postal, ville, pays, telephone, email, nombre_couverts, type_cuisine, twilio_number_usage FROM restaurateur_profiles`
    );
    report.skipped.push(
      `profils lus=${profiles.rowCount} : non importés automatiquement (nécessitent un tenant). Relier manuellement après création des tenants.`
    );
    report.profiles = profiles.rowCount;
  } catch (err) {
    report.skipped.push(`profiles: ${err.message}`);
  }

  await source.end();
  await closeDatabase();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((err) => {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
});

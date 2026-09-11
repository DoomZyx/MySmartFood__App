import "../Config/env.js";
import { closeDatabase, connectDatabase, getPool } from "../database/pool.js";
import {
  decryptGoogleId,
  encryptGoogleId,
  hashGoogleId,
} from "../utils/accountIdentifierCrypto.js";

async function main() {
  await connectDatabase();
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT id, google_id AS "googleId"
         FROM users
        WHERE google_id IS NOT NULL
          AND google_id_hash IS NULL
        FOR UPDATE`
    );

    for (const row of rows) {
      const plainGoogleId = row.googleId.startsWith("v1:")
        ? decryptGoogleId(row.googleId)
        : row.googleId;
      await client.query(
        `UPDATE users
            SET google_id = $2, google_id_hash = $3
          WHERE id = $1`,
        [row.id, encryptGoogleId(plainGoogleId), hashGoogleId(plainGoogleId)]
      );
    }

    const challenges = await client.query(
      `SELECT id, google_id AS "googleId"
         FROM oauth_link_challenges
        WHERE google_id NOT LIKE 'v1:%'
        FOR UPDATE`
    );
    for (const challenge of challenges.rows) {
      await client.query(
        `UPDATE oauth_link_challenges
            SET google_id = $2
          WHERE id = $1`,
        [challenge.id, encryptGoogleId(challenge.googleId)]
      );
    }

    await client.query("COMMIT");
    process.stdout.write(
      `${rows.length} compte(s) et ${challenges.rowCount} challenge(s) OAuth chiffré(s).\n`
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
    await closeDatabase();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});

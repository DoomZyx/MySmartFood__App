import { getPool } from "../../database/pool.js";
import { toCamelCase, mapRows } from "../../utils/rowMapper.js";

const STATUSES = ["nouveau", "en_cours", "traite", "archive"];

export function isValidStatus(status) {
  return STATUSES.includes(status);
}

export async function create(data) {
  const result = await getPool().query(
    `INSERT INTO contacts (name, email, company, subject, message)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING id, name, email, company, subject, message, status, created_at AS "createdAt"`,
    [data.name, data.email, data.company || null, data.subject, data.message]
  );
  return toCamelCase(result.rows[0]);
}

export async function findWithFilter({ status, limit, offset }) {
  const params = [];
  let where = "";
  if (status && isValidStatus(status)) {
    params.push(status);
    where = "WHERE status = $1";
  }
  const result = await getPool().query(
    `SELECT id, name, email, company, subject, message, status, created_at AS "createdAt"
       FROM contacts ${where}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  return mapRows(result.rows);
}

export async function countFilter(status) {
  const params = [];
  let where = "";
  if (status && isValidStatus(status)) {
    params.push(status);
    where = "WHERE status = $1";
  }
  const result = await getPool().query(`SELECT COUNT(*)::int AS total FROM contacts ${where}`, params);
  return result.rows[0].total;
}

export async function findById(id) {
  const result = await getPool().query(
    `SELECT id, name, email, company, subject, message, status, created_at AS "createdAt"
       FROM contacts WHERE id = $1`,
    [id]
  );
  return result.rows[0] ? toCamelCase(result.rows[0]) : null;
}

export async function updateStatus(id, status) {
  if (!isValidStatus(status)) return null;
  const result = await getPool().query(
    `UPDATE contacts SET status = $2 WHERE id = $1
     RETURNING id, name, email, company, subject, message, status`,
    [id, status]
  );
  return result.rows[0] ? toCamelCase(result.rows[0]) : null;
}

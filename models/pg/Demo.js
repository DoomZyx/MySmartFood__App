import { getPool } from "../../database/pool.js";
import { toCamelCase, mapRows } from "../../utils/rowMapper.js";

export async function create(data) {
  const result = await getPool().query(
    `INSERT INTO demos (name, email, company, team_size, needs, preferred_time, duration)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id, name, email, company, team_size AS "teamSize", needs,
               preferred_time AS "preferredTime", duration, status, created_at AS "createdAt"`,
    [data.name, data.email, data.company, data.teamSize, data.needs, data.preferredTime, data.duration]
  );
  return toCamelCase(result.rows[0]);
}

const STATUSES = ["nouveau", "en_cours", "traite", "archive"];

export function isValidStatus(status) {
  return STATUSES.includes(status);
}

export async function findAll() {
  const result = await getPool().query(
    `SELECT id, name, email, company, team_size AS "teamSize", needs,
            preferred_time AS "preferredTime", duration, status, created_at AS "createdAt"
       FROM demos ORDER BY created_at DESC`
  );
  return mapRows(result.rows);
}

export async function findWithFilter({ status, statuses, limit = 50 } = {}) {
  const params = [];
  let where = "";
  const list = Array.isArray(statuses) ? statuses.filter(isValidStatus) : [];
  if (list.length) {
    params.push(list);
    where = "WHERE status = ANY($1::text[])";
  } else if (status && isValidStatus(status)) {
    params.push(status);
    where = "WHERE status = $1";
  }
  const cap = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const result = await getPool().query(
    `SELECT id, name, email, company, team_size AS "teamSize", needs,
            preferred_time AS "preferredTime", duration, status, created_at AS "createdAt"
       FROM demos ${where}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1}`,
    [...params, cap]
  );
  return mapRows(result.rows);
}

export async function updateStatus(id, status) {
  if (!isValidStatus(status)) return null;
  const result = await getPool().query(
    `UPDATE demos SET status = $2 WHERE id = $1
     RETURNING id, name, email, company, team_size AS "teamSize", needs,
               preferred_time AS "preferredTime", duration, status, created_at AS "createdAt"`,
    [id, status]
  );
  return result.rows[0] ? toCamelCase(result.rows[0]) : null;
}

export async function findById(id) {
  const result = await getPool().query(
    `SELECT id, name, email, company, team_size AS "teamSize", needs,
            preferred_time AS "preferredTime", duration, status, created_at AS "createdAt"
       FROM demos WHERE id = $1`,
    [id]
  );
  return result.rows[0] ? toCamelCase(result.rows[0]) : null;
}

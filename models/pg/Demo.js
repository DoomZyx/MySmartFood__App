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

export async function findAll() {
  const result = await getPool().query(
    `SELECT id, name, email, company, team_size AS "teamSize", needs,
            preferred_time AS "preferredTime", duration, status, created_at AS "createdAt"
       FROM demos ORDER BY created_at DESC`
  );
  return mapRows(result.rows);
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

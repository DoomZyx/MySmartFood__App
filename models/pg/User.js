import bcrypt from "bcryptjs";
import { getPool } from "../../database/pool.js";
import { toCamelCase } from "../../utils/rowMapper.js";
import { encryptGoogleId, hashGoogleId } from "../../utils/accountIdentifierCrypto.js";

const SALT_ROUNDS = 12;

const USER_COLUMNS = `
  id, email, email_verified AS "emailVerified", name, avatar_url AS "avatarUrl",
  google_id_hash AS "googleIdHash", is_platform_admin AS "isPlatformAdmin",
  last_login_at AS "lastLoginAt", dashboard_unlocked_at AS "dashboardUnlockedAt",
  created_at AS "createdAt", updated_at AS "updatedAt"
`;

function mapUser(row) {
  if (!row) return null;
  const user = toCamelCase(row);
  user.hasGoogleId = Boolean(user.googleIdHash);
  return user;
}

export async function findById(id) {
  const result = await getPool().query(
    `SELECT ${USER_COLUMNS} FROM users WHERE id = $1`,
    [id]
  );
  return mapUser(result.rows[0]);
}

export async function findByEmail(email) {
  if (!email) return null;
  const result = await getPool().query(
    `SELECT ${USER_COLUMNS} FROM users WHERE LOWER(email) = LOWER(TRIM($1)) LIMIT 1`,
    [email]
  );
  return mapUser(result.rows[0]);
}

export async function listByTenantId(tenantId) {
  const result = await getPool().query(
    `SELECT u.id, u.email, u.email_verified AS "emailVerified", u.name,
            u.avatar_url AS "avatarUrl", u.is_platform_admin AS "isPlatformAdmin",
            u.last_login_at AS "lastLoginAt", u.created_at AS "createdAt",
            m.role AS "membershipRole", m.phone, m.job_title AS "jobTitle",
            m.department
       FROM users u
       JOIN tenant_memberships m ON m.user_id = u.id
      WHERE m.tenant_id = $1
      ORDER BY m.created_at ASC`,
    [tenantId]
  );
  return result.rows.map((row) => toCamelCase(row));
}

export async function findByGoogleId(googleId) {
  if (!googleId) return null;
  const result = await getPool().query(
    `SELECT ${USER_COLUMNS} FROM users WHERE google_id_hash = $1 LIMIT 1`,
    [hashGoogleId(googleId)]
  );
  return mapUser(result.rows[0]);
}

export async function create({
  email,
  name,
  googleId,
  avatarUrl,
  emailVerified = false,
  password,
  isPlatformAdmin = false,
}) {
  const passwordHash = password
    ? await bcrypt.hash(String(password).trim(), SALT_ROUNDS)
    : null;
  const encryptedGoogleId = googleId ? encryptGoogleId(googleId) : null;
  const googleIdHash = googleId ? hashGoogleId(googleId) : null;
  const result = await getPool().query(
    `INSERT INTO users (
       email, name, google_id, google_id_hash, avatar_url,
       email_verified, password_hash, is_platform_admin
     )
     VALUES (LOWER(TRIM($1)), $2, $3, $4, $5, $6, $7, $8)
     RETURNING ${USER_COLUMNS}`,
    [
      email,
      name || null,
      encryptedGoogleId,
      googleIdHash,
      avatarUrl || null,
      Boolean(emailVerified),
      passwordHash,
      Boolean(isPlatformAdmin),
    ]
  );
  return mapUser(result.rows[0]);
}

export async function updateEmail(userId, email) {
  const result = await getPool().query(
    `UPDATE users SET email = LOWER(TRIM($2)), email_verified = TRUE WHERE id = $1 RETURNING ${USER_COLUMNS}`,
    [userId, email]
  );
  return mapUser(result.rows[0]);
}

export async function setPlatformAdmin(userId, enabled) {
  const result = await getPool().query(
    `UPDATE users SET is_platform_admin = $2 WHERE id = $1 RETURNING ${USER_COLUMNS}`,
    [userId, Boolean(enabled)]
  );
  return mapUser(result.rows[0]);
}

export async function setPassword(userId, plainPassword) {
  const trimmed = String(plainPassword).trim();
  if (trimmed.length < 8) return false;
  const hash = await bcrypt.hash(trimmed, SALT_ROUNDS);
  await getPool().query(
    `UPDATE users SET password_hash = $2 WHERE id = $1`,
    [userId, hash]
  );
  return true;
}

export async function verifyPassword(userId, plainPassword) {
  const result = await getPool().query(
    `SELECT password_hash FROM users WHERE id = $1 AND password_hash IS NOT NULL`,
    [userId]
  );
  const hash = result.rows[0]?.password_hash;
  if (!hash) return false;
  return bcrypt.compare(String(plainPassword).trim(), hash);
}

export async function linkGoogle(userId, { googleId, avatarUrl, name }) {
  const encryptedGoogleId = encryptGoogleId(googleId);
  const googleIdHash = hashGoogleId(googleId);
  const result = await getPool().query(
    `UPDATE users
        SET google_id = $2,
            google_id_hash = $3,
            avatar_url = COALESCE($4, avatar_url),
            name = COALESCE($5, name),
            email_verified = TRUE
      WHERE id = $1
      RETURNING ${USER_COLUMNS}`,
    [userId, encryptedGoogleId, googleIdHash, avatarUrl || null, name || null]
  );
  return mapUser(result.rows[0]);
}

export async function touchLastLogin(userId) {
  await getPool().query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [userId]);
}

export async function markDashboardUnlocked(userId) {
  await getPool().query(
    `UPDATE users SET dashboard_unlocked_at = COALESCE(dashboard_unlocked_at, NOW()) WHERE id = $1`,
    [userId]
  );
}

export async function updateAccount(userId, { name, email, avatarUrl }) {
  const current = await findById(userId);
  if (!current) return null;
  const nextEmail = email != null ? String(email).trim().toLowerCase() : current.email;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
    throw new Error("Adresse e-mail invalide");
  }
  if (nextEmail !== current.email) {
    const taken = await findByEmail(nextEmail);
    if (taken && taken.id !== userId) {
      throw new Error("Cet email est déjà utilisé");
    }
  }
  const nextName =
    name != null ? String(name).trim().slice(0, 80) || null : current.name;
  const nextAvatar = avatarUrl !== undefined ? avatarUrl : current.avatarUrl;
  const result = await getPool().query(
    `UPDATE users
        SET name = $2, email = $3, avatar_url = $4
      WHERE id = $1
      RETURNING ${USER_COLUMNS}`,
    [userId, nextName, nextEmail, nextAvatar]
  );
  return mapUser(result.rows[0]);
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    emailVerified: user.emailVerified,
    isPlatformAdmin: user.isPlatformAdmin,
    dashboardUnlockedAt: user.dashboardUnlockedAt || null,
    createdAt: user.createdAt,
  };
}

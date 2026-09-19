import bcrypt from "bcryptjs";
import { getPool } from "../../database/pool.js";
import { toCamelCase } from "../../utils/rowMapper.js";
import { encryptGoogleId, hashGoogleId } from "../../utils/accountIdentifierCrypto.js";

const SALT_ROUNDS = 12;

const USER_COLUMNS = `
  id, email, email_verified AS "emailVerified", name, avatar_url AS "avatarUrl",
  google_id_hash AS "googleIdHash", is_platform_admin AS "isPlatformAdmin",
  is_platform_owner AS "isPlatformOwner",
  platform_role AS "platformRole",
  last_login_at AS "lastLoginAt", dashboard_unlocked_at AS "dashboardUnlockedAt",
  session_version AS "sessionVersion",
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
  platformRole = null,
}) {
  const passwordHash = password
    ? await bcrypt.hash(String(password).trim(), SALT_ROUNDS)
    : null;
  const encryptedGoogleId = googleId ? encryptGoogleId(googleId) : null;
  const googleIdHash = googleId ? hashGoogleId(googleId) : null;
  const nextRole = isPlatformAdmin ? platformRole || "ops" : null;
  const result = await getPool().query(
    `INSERT INTO users (
       email, name, google_id, google_id_hash, avatar_url,
       email_verified, password_hash, is_platform_admin, platform_role
     )
     VALUES (LOWER(TRIM($1)), $2, $3, $4, $5, $6, $7, $8, $9)
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
      nextRole,
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
    `UPDATE users
        SET is_platform_admin = $2,
            platform_role = CASE
              WHEN $2 = FALSE THEN NULL
              WHEN is_platform_owner THEN 'owner'
              ELSE COALESCE(platform_role, 'ops')
            END
      WHERE id = $1
      RETURNING ${USER_COLUMNS}`,
    [userId, Boolean(enabled)]
  );
  return mapUser(result.rows[0]);
}

export async function setPlatformOwner(userId, enabled) {
  const result = await getPool().query(
    `UPDATE users
        SET is_platform_admin = TRUE,
            is_platform_owner = $2,
            platform_role = CASE
              WHEN $2 THEN 'owner'
              ELSE COALESCE(NULLIF(platform_role, 'owner'), 'ops')
            END
      WHERE id = $1
      RETURNING ${USER_COLUMNS}`,
    [userId, Boolean(enabled)]
  );
  return mapUser(result.rows[0]);
}

export async function setPlatformRole(userId, role) {
  const result = await getPool().query(
    `UPDATE users
        SET platform_role = $2
      WHERE id = $1
        AND is_platform_admin = TRUE
        AND is_platform_owner = FALSE
      RETURNING ${USER_COLUMNS}`,
    [userId, role]
  );
  return mapUser(result.rows[0]);
}

export async function listPlatformAdmins() {
  const result = await getPool().query(
    `SELECT ${USER_COLUMNS}
       FROM users
      WHERE is_platform_admin = TRUE
      ORDER BY is_platform_owner DESC, created_at ASC`
  );
  return result.rows.map((row) => mapUser(row));
}

function mapPlatformUserRow(row) {
  if (!row) return null;
  const user = toCamelCase(row);
  user.hasGoogleId = Boolean(user.googleIdHash);
  delete user.googleIdHash;
  let tenants = user.tenants;
  if (typeof tenants === "string") {
    try {
      tenants = JSON.parse(tenants);
    } catch {
      tenants = [];
    }
  }
  user.tenants = Array.isArray(tenants) ? tenants : [];
  return user;
}

const PLATFORM_USER_SELECT = `
  SELECT u.id, u.email, u.email_verified AS "emailVerified", u.name,
          u.avatar_url AS "avatarUrl",
          u.google_id_hash AS "googleIdHash",
          u.is_platform_admin AS "isPlatformAdmin",
          u.is_platform_owner AS "isPlatformOwner",
          u.platform_role AS "platformRole",
          u.last_login_at AS "lastLoginAt",
          u.dashboard_unlocked_at AS "dashboardUnlockedAt",
          u.created_at AS "createdAt",
          COALESCE(
            json_agg(
              json_build_object(
                'id', t.id,
                'name', t.name,
                'slug', t.slug,
                'status', t.status,
                'ownerUserId', t.owner_user_id,
                'role', m.role,
                'phone', m.phone,
                'jobTitle', m.job_title,
                'department', m.department,
                'businessName', ep.business_name,
                'restaurantPhone', ep.phone,
                'restaurantEmail', ep.email,
                'addressLine', ep.address_line,
                'postalCode', ep.postal_code,
                'city', ep.city,
                'siret', ep.siret,
                'inboundPhone', b.phone_number,
                'planSlug', p.slug,
                'planName', p.name,
                'subscriptionStatus', s.status,
                'stripeCustomerId', s.stripe_customer_id,
                'stripeSubscriptionId', s.stripe_subscription_id,
                'onboardedBy', t.onboarded_by,
                'dossierComplete', NULL
              )
              ORDER BY m.created_at ASC
            ) FILTER (WHERE t.id IS NOT NULL),
            '[]'::json
          ) AS tenants
     FROM users u
     LEFT JOIN tenant_memberships m ON m.user_id = u.id
     LEFT JOIN tenants t ON t.id = m.tenant_id
     LEFT JOIN establishment_profiles ep ON ep.tenant_id = t.id
     LEFT JOIN LATERAL (
    SELECT plan_id, status, stripe_customer_id, stripe_subscription_id
      FROM subscriptions
     WHERE tenant_id = t.id
     ORDER BY created_at DESC
     LIMIT 1
     ) s ON TRUE
     LEFT JOIN plans p ON p.id = s.plan_id
     LEFT JOIN LATERAL (
       SELECT phone_number
         FROM twilio_bundles
        WHERE tenant_id = t.id
        ORDER BY (phone_number IS NOT NULL) DESC, updated_at DESC
        LIMIT 1
     ) b ON TRUE
`;

export async function listForPlatform({ search = "", limit = 200, offset = 0 } = {}) {
  const q = String(search || "").trim();
  const lim = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const off = Math.max(Number(offset) || 0, 0);
  const params = [];
  let where = "";
  if (q) {
    params.push(`%${q}%`);
    where = `WHERE u.email ILIKE $1
      OR COALESCE(u.name, '') ILIKE $1
      OR EXISTS (
        SELECT 1
          FROM tenant_memberships mx
          JOIN tenants tx ON tx.id = mx.tenant_id
          LEFT JOIN establishment_profiles epx ON epx.tenant_id = tx.id
         WHERE mx.user_id = u.id
           AND (
             COALESCE(tx.name, '') ILIKE $1
             OR COALESCE(epx.business_name, '') ILIKE $1
             OR COALESCE(epx.phone, '') ILIKE $1
             OR COALESCE(epx.siret, '') ILIKE $1
             OR COALESCE(epx.siren, '') ILIKE $1
             OR EXISTS (
               SELECT 1
                 FROM twilio_bundles tb
                WHERE tb.tenant_id = tx.id
                  AND COALESCE(tb.phone_number, '') ILIKE $1
             )
           )
      )`;
  }
  const countResult = await getPool().query(
    `SELECT COUNT(*)::int AS count FROM users u ${where}`,
    q ? [params[0]] : []
  );
  params.push(lim, off);
  const result = await getPool().query(
    `${PLATFORM_USER_SELECT}
      ${where}
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return {
    total: countResult.rows[0]?.count || 0,
    users: result.rows.map(mapPlatformUserRow),
  };
}

export async function findForPlatform(userId) {
  const result = await getPool().query(
    `${PLATFORM_USER_SELECT}
      WHERE u.id = $1
      GROUP BY u.id`,
    [userId]
  );
  return mapPlatformUserRow(result.rows[0]);
}

export async function remove(id) {
  const result = await getPool().query(
    `DELETE FROM users WHERE id = $1 RETURNING id`,
    [id]
  );
  return result.rowCount > 0;
}

export async function setPassword(userId, plainPassword) {
  const trimmed = String(plainPassword).trim();
  if (trimmed.length < 8) return false;
  const hash = await bcrypt.hash(trimmed, SALT_ROUNDS);
  await getPool().query(
    `UPDATE users
        SET password_hash = $2,
            session_version = COALESCE(session_version, 1) + 1
      WHERE id = $1`,
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
  const result = await getPool().query(
    `UPDATE users SET dashboard_unlocked_at = COALESCE(dashboard_unlocked_at, NOW()) WHERE id = $1
     RETURNING ${USER_COLUMNS}`,
    [userId]
  );
  return mapUser(result.rows[0]);
}

export async function findDossierNoticePendingAt(userId) {
  try {
    const result = await getPool().query(
      `SELECT dossier_notice_pending_at AS "dossierNoticePendingAt"
         FROM users WHERE id = $1`,
      [userId]
    );
    return result.rows[0]?.dossierNoticePendingAt || null;
  } catch (error) {
    if (error.code === "42703") return null;
    throw error;
  }
}

export async function markDossierNoticePending(userId) {
  try {
    await getPool().query(
      `UPDATE users SET dossier_notice_pending_at = NOW() WHERE id = $1`,
      [userId]
    );
  } catch (error) {
    if (error.code === "42703") return null;
    throw error;
  }
  return findById(userId);
}

export async function clearDossierNoticePending(userId) {
  try {
    await getPool().query(
      `UPDATE users SET dossier_notice_pending_at = NULL WHERE id = $1`,
      [userId]
    );
  } catch (error) {
    if (error.code === "42703") return findById(userId);
    throw error;
  }
  return findById(userId);
}

export async function setEmailVerified(userId, verified) {
  const result = await getPool().query(
    `UPDATE users SET email_verified = $2 WHERE id = $1 RETURNING ${USER_COLUMNS}`,
    [userId, Boolean(verified)]
  );
  return mapUser(result.rows[0]);
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

export async function findPlatformTotp(userId) {
  try {
    const result = await getPool().query(
      `SELECT platform_totp_secret AS "secret",
              platform_totp_enabled_at AS "enabledAt",
              platform_totp_last_step AS "lastStep"
         FROM users WHERE id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  } catch (error) {
    if (error.code === "42703") {
      const err = new Error("Migration 2FA manquante. Dans backend lancer: pnpm db:migrate");
      err.statusCode = 503;
      throw err;
    }
    throw error;
  }
}

export async function savePlatformTotpSecret(userId, encryptedSecret) {
  await getPool().query(
    `UPDATE users
        SET platform_totp_secret = $2,
            platform_totp_enabled_at = NULL,
            platform_totp_last_step = NULL
      WHERE id = $1`,
    [userId, encryptedSecret]
  );
}

export async function enablePlatformTotp(userId, lastStep) {
  await getPool().query(
    `UPDATE users
        SET platform_totp_enabled_at = NOW(),
            platform_totp_last_step = $2
      WHERE id = $1`,
    [userId, lastStep]
  );
}

export async function touchPlatformTotpStep(userId, lastStep) {
  await getPool().query(
    `UPDATE users SET platform_totp_last_step = $2 WHERE id = $1`,
    [userId, lastStep]
  );
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
    isPlatformOwner: Boolean(user.isPlatformOwner),
    platformRole: user.isPlatformAdmin
      ? user.isPlatformOwner
        ? "owner"
        : user.platformRole || "ops"
      : null,
    dashboardUnlockedAt: user.dashboardUnlockedAt || null,
    dossierNoticePending: Boolean(user.dossierNoticePendingAt),
    createdAt: user.createdAt,
  };
}

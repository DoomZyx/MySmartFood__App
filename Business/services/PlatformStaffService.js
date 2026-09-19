import * as User from "../../models/pg/User.js";
import { recordPlatformAudit } from "./PlatformAuditService.js";
import { normalizeStaffRole } from "./PlatformAccess.js";

function httpError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  throw err;
}

function serializeStaff(user) {
  const publicUser = User.publicUser(user);
  return {
    id: publicUser.id,
    email: publicUser.email,
    name: publicUser.name,
    emailVerified: publicUser.emailVerified,
    isPlatformAdmin: publicUser.isPlatformAdmin,
    isPlatformOwner: publicUser.isPlatformOwner,
    platformRole: publicUser.platformRole,
    lastLoginAt: user.lastLoginAt || null,
    createdAt: publicUser.createdAt,
  };
}

export async function listPlatformStaff() {
  const users = await User.listPlatformAdmins();
  return users.map(serializeStaff);
}

export async function createPlatformStaff({ email, password, name, role } = {}) {
  const emailNorm = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
    httpError("Adresse e-mail invalide", 400);
  }
  if (!password || String(password).trim().length < 8) {
    httpError("Le mot de passe doit contenir au moins 8 caractères", 400);
  }

  const existing = await User.findByEmail(emailNorm);
  if (existing?.isPlatformAdmin) {
    httpError("Ce compte a déjà accès au back-office", 409);
  }

  const platformRole = normalizeStaffRole(role);
  if (!platformRole) {
    httpError("Rôle back-office invalide", 400);
  }

  if (existing) {
    await User.setPassword(existing.id, password);
    await User.setPlatformAdmin(existing.id, true);
    const promoted = await User.setPlatformRole(existing.id, platformRole);
    return serializeStaff(promoted);
  }

  const created = await User.create({
    email: emailNorm,
    name: name ? String(name).trim() : null,
    password,
    emailVerified: true,
    isPlatformAdmin: true,
    platformRole,
  });
  await recordPlatformAudit({
    action: "staff.create",
    targetType: "user",
    targetId: created.id,
    metadata: { promoted: false },
  });
  return serializeStaff(created);
}

export async function updatePlatformStaff(targetUserId, { name, email, password, role } = {}) {
  const target = await User.findById(targetUserId);
  if (!target?.isPlatformAdmin) {
    httpError("Compte back-office introuvable", 404);
  }

  const nextName = name !== undefined ? String(name).trim().slice(0, 120) : undefined;
  const nextEmail = email !== undefined ? String(email).trim().toLowerCase() : undefined;
  const nextPassword = String(password || "").trim();
  const nextRole = role !== undefined ? normalizeStaffRole(role, { fallback: null }) : undefined;
  if (role !== undefined && !nextRole) {
    httpError("Rôle back-office invalide", 400);
  }
  if (
    nextName === undefined &&
    nextEmail === undefined &&
    !nextPassword &&
    nextRole === undefined
  ) {
    httpError("Aucun champ à modifier", 400);
  }
  if (nextEmail !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
    httpError("Adresse e-mail invalide", 400);
  }

  if (nextName !== undefined || nextEmail !== undefined) {
    try {
      await User.updateAccount(targetUserId, {
        name: nextName,
        email: nextEmail,
      });
    } catch (error) {
      if (/déjà utilisé/i.test(error.message)) httpError(error.message, 409);
      if (/invalide/i.test(error.message)) httpError(error.message, 400);
      throw error;
    }
  }
  if (nextPassword) {
    if (nextPassword.length < 8) {
      httpError("Le mot de passe doit contenir au moins 8 caractères", 400);
    }
    await User.setPassword(targetUserId, nextPassword);
  }
  if (nextRole) {
    if (target.isPlatformOwner) {
      httpError("Le rôle du propriétaire ne peut pas être modifié", 403);
    }
    await User.setPlatformRole(targetUserId, nextRole);
  }

  const updated = await User.findById(targetUserId);
  return serializeStaff(updated);
}

export async function revokePlatformStaff(actorId, targetUserId) {
  if (actorId === targetUserId) {
    httpError("Vous ne pouvez pas retirer votre propre accès", 400);
  }

  const target = await User.findById(targetUserId);
  if (!target?.isPlatformAdmin) {
    httpError("Compte back-office introuvable", 404);
  }
  if (target.isPlatformOwner) {
    httpError("Le propriétaire des comptes ne peut pas être retiré", 403);
  }

  const revoked = await User.setPlatformAdmin(target.id, false);
  await recordPlatformAudit({
    actorId,
    action: "staff.revoke",
    targetType: "user",
    targetId: targetUserId,
  });
  return serializeStaff(revoked);
}

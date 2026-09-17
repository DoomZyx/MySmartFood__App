import * as User from "../../models/pg/User.js";

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
    lastLoginAt: user.lastLoginAt || null,
    createdAt: publicUser.createdAt,
  };
}

export async function listPlatformStaff() {
  const users = await User.listPlatformAdmins();
  return users.map(serializeStaff);
}

export async function createPlatformStaff({ email, password, name }) {
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

  if (existing) {
    await User.setPassword(existing.id, password);
    const promoted = await User.setPlatformAdmin(existing.id, true);
    return serializeStaff(promoted);
  }

  const created = await User.create({
    email: emailNorm,
    name: name ? String(name).trim() : null,
    password,
    emailVerified: true,
    isPlatformAdmin: true,
  });
  return serializeStaff(created);
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
  return serializeStaff(revoked);
}

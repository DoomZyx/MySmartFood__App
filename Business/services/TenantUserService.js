import * as User from "../../models/pg/User.js";
import * as Membership from "../../models/pg/Membership.js";
import { AccountAuthError } from "./AccountAuthService.js";

function toUiRole(membershipRole) {
  return membershipRole === "member" ? "user" : "admin";
}

function toMembershipRole(uiRole) {
  if (uiRole === "admin" || uiRole === "owner") return uiRole === "owner" ? "owner" : "admin";
  return "member";
}

function toAdminUser(row) {
  return {
    id: row.id,
    username: row.name || row.email,
    email: row.email,
    role: toUiRole(row.membershipRole),
    isActive: true,
    lastLogin: row.lastLoginAt,
    createdAt: row.createdAt,
    isPlatformAdmin: Boolean(row.isPlatformAdmin),
  };
}

export class TenantUserService {
  static async list(tenantId) {
    const rows = await User.listByTenantId(tenantId);
    return rows.map(toAdminUser);
  }

  static async create(tenantId, { username, email, password, role }) {
    const emailNorm = String(email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      throw new AccountAuthError("Adresse e-mail invalide", 400);
    }
    const name = String(username || "").trim();
    if (name.length < 2) {
      throw new AccountAuthError("Le nom doit contenir au moins 2 caractères", 400);
    }
    const membershipRole = toMembershipRole(role);
    if (membershipRole === "owner") {
      throw new AccountAuthError("Impossible de créer un propriétaire depuis ce formulaire", 400);
    }

    let user = await User.findByEmail(emailNorm);
    if (!user) {
      if (!password || String(password).trim().length < 8) {
        throw new AccountAuthError("Le mot de passe doit contenir au moins 8 caractères", 400);
      }
      user = await User.create({
        email: emailNorm,
        name,
        password,
        emailVerified: false,
      });
    }

    const existing = await Membership.findMembership(user.id, tenantId);
    if (existing) {
      throw new AccountAuthError("Cet utilisateur appartient déjà à l'établissement", 409);
    }
    await Membership.createMembership(null, {
      tenantId,
      userId: user.id,
      role: membershipRole,
    });
    const rows = await User.listByTenantId(tenantId);
    return toAdminUser(rows.find((row) => row.id === user.id));
  }

  static async update(tenantId, userId, { username, email, role }, actorUserId) {
    const target = await Membership.findMembership(userId, tenantId);
    if (!target) {
      throw new AccountAuthError("Utilisateur non trouvé", 404);
    }
    if (username != null || email != null) {
      await User.updateAccount(userId, {
        name: username,
        email,
      });
    }
    if (role !== undefined) {
      let nextRole = toMembershipRole(role);
      if (target.role === "owner" && nextRole === "admin") {
        nextRole = "owner";
      }
      if (target.role === "owner" && nextRole !== "owner") {
        const owners = await Membership.countOwners(tenantId);
        if (owners <= 1) {
          throw new AccountAuthError("Impossible de retirer le dernier propriétaire", 400);
        }
      }
      if (nextRole === "owner" && actorUserId === userId) {
        // ok
      }
      if (nextRole !== "owner") {
        await Membership.updateRole(userId, tenantId, nextRole);
      }
    }
    const rows = await User.listByTenantId(tenantId);
    const row = rows.find((item) => item.id === userId);
    if (!row) throw new AccountAuthError("Utilisateur non trouvé", 404);
    return toAdminUser(row);
  }

  static async remove(tenantId, userId, actorUserId) {
    if (userId === actorUserId) {
      throw new AccountAuthError("Vous ne pouvez pas supprimer votre propre compte", 400);
    }
    const target = await Membership.findMembership(userId, tenantId);
    if (!target) {
      throw new AccountAuthError("Utilisateur non trouvé", 404);
    }
    if (target.role === "owner") {
      const owners = await Membership.countOwners(tenantId);
      if (owners <= 1) {
        throw new AccountAuthError("Impossible de supprimer le dernier propriétaire", 400);
      }
    }
    await Membership.removeMembership(userId, tenantId);
  }
}

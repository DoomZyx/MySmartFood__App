import * as User from "../../models/pg/User.js";
import * as Membership from "../../models/pg/Membership.js";
import { UserTransformer } from "../transformers/UserTransformer.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
  extractPublicIdFromUrl,
} from "../../Config/cloudinary.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function emptyToNull(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

async function resolveMembership(userId, tenantIdHint) {
  const memberships = await Membership.listByUserId(userId);
  if (!memberships.length) return { membership: null, memberships };
  const hint = String(tenantIdHint || "").trim();
  if (UUID_PATTERN.test(hint)) {
    const match = memberships.find((item) => item.tenantId === hint);
    if (match) return { membership: match, memberships };
  }
  return { membership: memberships[0], memberships };
}

function toProfileUser(user, membership) {
  return {
    id: user.id,
    username: user.name || "",
    email: user.email,
    avatar: user.avatarUrl || null,
    telephone: membership?.phone || "",
    poste: membership?.jobTitle || "",
    departement: membership?.department || "",
    tenantId: membership?.tenantId || null,
    tenantName: membership?.name || null,
    role: membership?.role || (user.isPlatformAdmin ? "admin" : "user"),
    createdAt: user.createdAt,
    lastLogin: user.lastLoginAt,
    updatedAt: user.updatedAt,
  };
}

export class AccountProfileService {
  static async getAccount(userId, tenantIdHint) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("Utilisateur non trouvé");
    }
    const { membership } = await resolveMembership(userId, tenantIdHint);
    return UserTransformer.profileResponse(toProfileUser(user, membership));
  }

  static async updateAccount(userId, updates, tenantIdHint) {
    const name = updates.username ?? updates.name;
    if (name != null && String(name).trim().length < 2) {
      throw new Error("Le nom doit contenir au moins 2 caractères");
    }

    let user = await User.updateAccount(userId, {
      name,
      email: updates.email,
    });
    if (!user) {
      throw new Error("Utilisateur non trouvé");
    }

    const { membership } = await resolveMembership(userId, tenantIdHint);
    let currentMembership = membership;
    if (currentMembership) {
      currentMembership = await Membership.updateProfile(userId, currentMembership.tenantId, {
        phone: updates.telephone !== undefined ? emptyToNull(updates.telephone) : currentMembership.phone,
        jobTitle: updates.poste !== undefined ? emptyToNull(updates.poste) : currentMembership.jobTitle,
        department: updates.departement !== undefined ? emptyToNull(updates.departement) : currentMembership.department,
      });
    }

    user = await User.findById(userId);
    return UserTransformer.profileUpdateResponse(toProfileUser(user, currentMembership));
  }

  static async uploadAvatar(userId, file) {
    if (!file) {
      throw new Error("Aucun fichier uploadé");
    }
    const mimetype = file.mimetype || "";
    if (!mimetype.startsWith("image/")) {
      throw new Error("Type de fichier invalide. Seules les images sont acceptées.");
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error("Utilisateur non trouvé");
    }

    if (user.avatarUrl) {
      const oldPublicId = extractPublicIdFromUrl(user.avatarUrl);
      if (oldPublicId) {
        try {
          await deleteFromCloudinary(oldPublicId);
        } catch {
          // L'avatar local reste prioritaire même si l'ancien fichier cloud n'est pas supprimé.
        }
      }
    }

    const buffer = await file.toBuffer();
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const result = await uploadToCloudinary(buffer, {
      folder: "restaurant-app/avatars",
      public_id: `avatar_${userId}_${uniqueSuffix}`,
    });
    const updated = await User.updateAccount(userId, { avatarUrl: result.secure_url });
    const { membership } = await resolveMembership(userId, null);
    return UserTransformer.avatarUploadResponse(result.secure_url, toProfileUser(updated, membership));
  }
}

import {
  AccountAuthError,
  confirmGoogleLink,
  login,
  register,
  sessionPayload,
} from "../../Business/services/AccountAuthService.js";
import {
  redeemDashboardAccessToken,
  resendDashboardAccessToken,
} from "../../Business/services/DashboardAccessService.js";
import {
  clearSessionCookie,
  requireAuth,
  setSessionCookie,
} from "../../middleware/sessionAuth.js";
import * as User from "../../models/pg/User.js";
import * as Membership from "../../models/pg/Membership.js";
import * as EstablishmentProfile from "../../models/pg/EstablishmentProfile.js";
import { saveProfile, submitOnboardingDossier } from "../../Business/services/DocumentComplianceService.js";
import { profileToWebsite } from "../../Business/mappers/websiteProfile.js";
import { AccountProfileService } from "../../Business/services/AccountProfileService.js";

async function firstTenantId(userId) {
  const memberships = await Membership.listByUserId(userId);
  return memberships[0]?.tenantId || null;
}

function handleAuthError(error, reply) {
  if (error instanceof AccountAuthError) {
    return reply.code(error.statusCode).send({ error: error.message, message: error.message });
  }
  logger.error({ err: error.message }, "Erreur auth compte");
  return reply.code(500).send({ error: "Erreur serveur" });
}

export const AccountAuthController = {
  async register(request, reply) {
    try {
      const user = await register(request.body || {});
      setSessionCookie(reply, user);
      return reply.code(201).send(await sessionPayload(user));
    } catch (error) {
      return handleAuthError(error, reply);
    }
  },

  async login(request, reply) {
    try {
      const user = await login(request.body || {});
      setSessionCookie(reply, user);
      return reply.code(200).send(await sessionPayload(user));
    } catch (error) {
      return handleAuthError(error, reply);
    }
  },

  async me(request, reply) {
    const payload = await sessionPayload(request.user);
    return reply.send({ ...payload.user, ...payload });
  },

  async logout(_request, reply) {
    clearSessionCookie(reply);
    return reply.code(204).send();
  },

  async redeemAccess(request, reply) {
    try {
      const user = await redeemDashboardAccessToken(request.body?.token);
      setSessionCookie(reply, user);
      return reply.send(await sessionPayload(user));
    } catch (error) {
      return handleAuthError(error, reply);
    }
  },

  async resendAccess(request, reply) {
    try {
      await resendDashboardAccessToken(request.user.id);
      return reply.send({ ok: true });
    } catch (error) {
      return handleAuthError(error, reply);
    }
  },

  async confirmGoogleLink(request, reply) {
    try {
      await requireAuth(request, reply);
      if (reply.sent) return;
      const token = request.body?.token;
      if (!token) {
        return reply.code(400).send({ error: "Jeton de confirmation requis" });
      }
      const user = await confirmGoogleLink({ userId: request.user.id, token });
      setSessionCookie(reply, user);
      return reply.send(await sessionPayload(user));
    } catch (error) {
      return handleAuthError(error, reply);
    }
  },

  async setPassword(request, reply) {
    const password = request.body?.password;
    if (!password || String(password).trim().length < 8) {
      return reply.code(400).send({ error: "Le mot de passe doit contenir au moins 8 caractères" });
    }
    const ok = await User.setPassword(request.user.id, password);
    if (!ok) {
      return reply.code(400).send({ error: "Mot de passe invalide" });
    }
    return reply.code(204).send();
  },

  async getWebsiteProfile(request, reply) {
    const tenantId = await firstTenantId(request.user.id);
    if (!tenantId) return reply.send({});
    const profile = await EstablishmentProfile.findByTenantId(tenantId);
    return reply.send(profileToWebsite(profile));
  },

  async updateWebsiteProfile(request, reply) {
    const tenantId = await firstTenantId(request.user.id);
    if (!tenantId) {
      return reply.code(409).send({
        error: "Aucun établissement : souscrivez un abonnement d'abord",
        message: "Aucun établissement : souscrivez un abonnement d'abord",
      });
    }
    try {
      const profile = await saveProfile(tenantId, request.body || {});
      return reply.send(profileToWebsite(profile));
    } catch (error) {
      return reply.code(error.statusCode || 500).send({
        error: error.message,
        message: error.message,
      });
    }
  },

  async submitWebsiteOnboarding(request, reply) {
    const tenantId = await firstTenantId(request.user.id);
    if (!tenantId) {
      return reply.code(409).send({
        error: "Aucun établissement : souscrivez un abonnement d'abord",
        message: "Aucun établissement : souscrivez un abonnement d'abord",
      });
    }
    try {
      const files = {};
      const body = {};
      const parts = request.parts();
      for await (const part of parts) {
        if (part.file) {
          const chunks = [];
          for await (const chunk of part.file) chunks.push(chunk);
          files[part.fieldname] = {
            buffer: Buffer.concat(chunks),
            mimetype: part.mimetype,
            originalname: part.filename,
          };
        } else {
          body[part.fieldname] = part.value;
        }
      }
      const result = await submitOnboardingDossier({
        tenantId,
        userId: request.user.id,
        body,
        files,
      });
      return reply.code(201).send(result);
    } catch (error) {
      return reply.code(error.statusCode || 500).send({
        error: error.message,
        message: error.message,
      });
    }
  },

  async getAccount(request, reply) {
    try {
      const payload = await AccountProfileService.getAccount(
        request.user.id,
        request.headers["x-tenant-id"]
      );
      return reply.send(payload);
    } catch (error) {
      const status = error.message === "Utilisateur non trouvé" ? 404 : 500;
      return reply.code(status).send({ error: error.message, success: false });
    }
  },

  async updateAccount(request, reply) {
    try {
      const payload = await AccountProfileService.updateAccount(
        request.user.id,
        request.body || {},
        request.headers["x-tenant-id"]
      );
      return reply.send(payload);
    } catch (error) {
      const status =
        error.message === "Utilisateur non trouvé"
          ? 404
          : error.message.includes("déjà") || error.message.includes("invalide") || error.message.includes("caractères")
            ? 400
            : 500;
      return reply.code(status).send({ error: error.message, success: false });
    }
  },

  async uploadAccountAvatar(request, reply) {
    try {
      const file = await request.file();
      const payload = await AccountProfileService.uploadAvatar(request.user.id, file);
      return reply.send(payload);
    } catch (error) {
      const status =
        error.message === "Utilisateur non trouvé"
          ? 404
          : error.message.includes("fichier") || error.message.includes("Type") || error.message.includes("image")
            ? 400
            : error.message.includes("Cloudinary")
              ? 503
              : 500;
      return reply.code(status).send({ error: error.message, success: false });
    }
  },
};

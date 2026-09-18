import {
  confirmPlatformTotp,
  isDevPlatformBypass,
  loginPlatformAdmin,
  setupPlatformTotp,
  verifyPlatformTotp,
} from "../../Business/services/PlatformAdminAuthService.js";
import { sessionPayload } from "../../Business/services/AccountAuthService.js";
import {
  clearPlatformPendingCookie,
  clearPlatformSessionCookie,
  setPlatformPendingCookie,
  setPlatformSessionCookie,
  setSessionCookie,
} from "../../middleware/sessionAuth.js";
import * as User from "../../models/pg/User.js";
import logger from "../../Services/logging/logger.js";

function handleError(error, reply) {
  const status = error.statusCode || 500;
  if (status >= 500) {
    logger.error({ err: error.message }, "Auth back-office");
  }
  return reply.code(status).send({
    error: error.message || "Erreur serveur",
    message: error.message || "Erreur serveur",
  });
}

async function completePlatform(reply, user) {
  clearPlatformPendingCookie(reply);
  setSessionCookie(reply, user);
  setPlatformSessionCookie(reply, user);
  const payload = await sessionPayload(user);
  return {
    ...payload,
    user: payload.user,
    platformVerified: true,
  };
}

export const PlatformAdminAuthController = {
  async login(request, reply) {
    try {
      const { user, totpStep, bypassTotp } = await loginPlatformAdmin(request.body || {});
      if (bypassTotp) {
        return reply.send(await completePlatform(reply, user));
      }
      setSessionCookie(reply, user);
      setPlatformPendingCookie(reply, user, totpStep);
      return reply.send({
        user: User.publicUser(user),
        platformVerified: false,
        totpStep,
        needsTotpEnrollment: totpStep === "enroll",
        needsTotp: totpStep === "verify",
      });
    } catch (error) {
      return handleError(error, reply);
    }
  },

  async devElevate(request, reply) {
    if (!isDevPlatformBypass()) {
      return reply.code(404).send({ error: "Not found" });
    }
    if (!request.user?.isPlatformAdmin) {
      return reply.code(403).send({ error: "Accès refusé" });
    }
    return reply.send(await completePlatform(reply, request.user));
  },

  async challenge(request, reply) {
    return reply.send({
      totpStep: request.platformPendingStep,
      needsTotpEnrollment: request.platformPendingStep === "enroll",
      needsTotp: request.platformPendingStep === "verify",
      user: User.publicUser(request.user),
    });
  },

  async totpSetup(request, reply) {
    try {
      return reply.send(await setupPlatformTotp(request.user));
    } catch (error) {
      return handleError(error, reply);
    }
  },

  async totpConfirm(request, reply) {
    try {
      const user = await confirmPlatformTotp(request.user, request.body?.token);
      return reply.send(await completePlatform(reply, user));
    } catch (error) {
      return handleError(error, reply);
    }
  },

  async totpVerify(request, reply) {
    try {
      const user = await verifyPlatformTotp(request.user, request.body?.token);
      return reply.send(await completePlatform(reply, user));
    } catch (error) {
      return handleError(error, reply);
    }
  },

  async session(request, reply) {
    const payload = await sessionPayload(request.user);
    return reply.send({
      ...payload,
      platformVerified: true,
    });
  },

  async logout(_request, reply) {
    clearPlatformSessionCookie(reply);
    clearPlatformPendingCookie(reply);
    return reply.code(204).send();
  },
};

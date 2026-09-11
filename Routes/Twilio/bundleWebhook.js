import querystring from "node:querystring";
import { handleBundleStatusWebhook, validateTwilioSignature } from "../../Business/services/TwilioProvisioningService.js";
import logger from "../../Services/logging/logger.js";

export default async function twilioBundleWebhookRoutes(fastify) {
  fastify.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (req, body, done) => {
    done(null, body);
  });

  fastify.post("/api/twilio/bundle-status", async (request, reply) => {
    const raw = typeof request.body === "string" ? request.body : "";
    const params = querystring.parse(raw);
    const proto = request.headers["x-forwarded-proto"] || request.protocol;
    const host = request.headers["x-forwarded-host"] || request.headers.host;
    const url = `${proto}://${host}${request.url}`;
    const signature = request.headers["x-twilio-signature"];

    if (!validateTwilioSignature(url, params, signature)) {
      return reply.code(403).send({ error: "Signature Twilio invalide" });
    }

    try {
      const result = await handleBundleStatusWebhook({
        bundleSid: params.BundleSid || params.bundle_sid,
        status: params.Status || params.status,
        failureReason: params.FailureReason || params.failure_reason,
      });
      return result;
    } catch (err) {
      logger.error({ err: err.message }, "Webhook bundle Twilio");
      return reply.code(500).send({ error: "Erreur serveur" });
    }
  });
}

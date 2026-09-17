import twilio from "twilio";
import {
  generateTwiml,
  generateTwimlTransferToRestaurant,
} from "../../Services/twilioServices/twilioServices.js";
import { withTenant } from "../../database/transaction.js";
import {
  voicePublicHostname,
  voiceStreamHost,
} from "../../utils/voiceWebhookUrl.js";
import {
  createStreamToken,
} from "../../utils/streamToken.js";
import { routeVoiceConnection } from "../Ws/ws.js";
import * as TwilioBundle from "../../models/pg/TwilioBundle.js";
import { recordCallFlow } from "../../Services/monitoring/callFlowTrace.js";

function publicWebhookUrl(request) {
  const protocol = request.headers["x-forwarded-proto"] || "https";
  const host =
    voicePublicHostname(request.headers["x-forwarded-host"]) ||
    voicePublicHostname(request.headers.host) ||
    voicePublicHostname(process.env.VOICE_GATEWAY_PUBLIC_HOST) ||
    voicePublicHostname(process.env.PUBLIC_HOST);
  const path = request.raw?.url || request.url || "";
  return `${protocol}://${host}${path}`;
}

function isValidTwilioWebhook(request) {
  const signature = request.headers["x-twilio-signature"];
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!signature || !authToken) return false;
  return twilio.validateRequest(
    authToken,
    signature,
    publicWebhookUrl(request),
    request.body || {},
  );
}

function callMeta(request) {
  const body = request.body || {};
  return {
    callSid: body.CallSid || null,
    from: body.From || null,
    to: body.To || body.Called || null,
  };
}

async function handleIncomingCall(request, reply) {
  const meta = callMeta(request);
  if (!isValidTwilioWebhook(request)) {
    recordCallFlow({
      ...meta,
      stage: "webhook",
      outcome: "hangup",
      detail: `signature invalide (${publicWebhookUrl(request)})`,
    });
    return reply.code(403).send({ error: "Signature Twilio invalide" });
  }

  const tenant = await TwilioBundle.findTenantForInboundCall({
    phoneNumber: meta.to,
  });
  if (!tenant) {
    recordCallFlow({
      ...meta,
      stage: "tenant",
      outcome: "hangup",
      detail: "aucun restaurant pour ce numero ou ce slug",
    });
    return reply.code(404).send({ error: "Instance non trouvée" });
  }
  if (tenant.status !== "active") {
    recordCallFlow({
      ...meta,
      tenantId: tenant.id,
      slug: tenant.slug,
      stage: "tenant",
      outcome: "hangup",
      detail: `restaurant ${tenant.status}`,
    });
    return reply.code(404).send({ error: "Instance inactive" });
  }

  const instanceId = tenant.id;
  recordCallFlow({
    ...meta,
    tenantId: instanceId,
    slug: tenant.slug,
    stage: "webhook",
    outcome: "ok",
    detail: `Twilio a atteint l'API (${publicWebhookUrl(request)})`,
  });
  const settings = await withTenant(instanceId, async (db) => {
    const settingsResult = await db.query(
      `SELECT phone_line_enabled, transfer_phone
         FROM tenant_settings
        WHERE tenant_id = $1`,
      [instanceId],
    );
    return settingsResult.rows[0] || null;
  });
  if (!settings?.phone_line_enabled) {
    const hasTransfer = Boolean(settings?.transfer_phone);
    recordCallFlow({
      ...meta,
      tenantId: instanceId,
      slug: tenant.slug,
      stage: "line",
      outcome: "hangup",
      detail: hasTransfer
        ? "ligne off, transfert restaurant"
        : "ligne off, Reject busy (pas de numero de transfert)",
    });
    return reply
      .type("text/xml")
      .send(generateTwimlTransferToRestaurant(settings?.transfer_phone));
  }

  const host = voiceStreamHost(request);
  const streamToken = createStreamToken(instanceId);
  const streamPath = `/v1/${instanceId}/media-stream`;
  const xml = generateTwiml(host, streamPath, meta.from, instanceId, streamToken);
  recordCallFlow({
    ...meta,
    tenantId: instanceId,
    slug: tenant.slug,
    stage: "twiml",
    outcome: "ok",
    detail: `stream wss://${host}${streamPath.split("?")[0]}`,
  });
  return reply.type("text/xml").send(xml);
}

/**
 * Entrée Twilio multi-tenant : webhook vocal + media-stream.
 * URL unique /twilio/incoming-call (le numéro appelé identifie le restaurant).
 */
export default async function voiceIngressRoutes(fastify, opts = {}) {
  const useWorkers = opts.useWorkers === true;

  fastify.post("/twilio/incoming-call", handleIncomingCall);

  async function handleMediaStream(connection, request) {
    const instanceId = request.params.instanceId;
    recordCallFlow({
      tenantId: instanceId,
      stage: "stream",
      outcome: "ok",
      detail: "websocket media-stream ouvert, attente start Twilio",
    });
    await routeVoiceConnection(connection, request, instanceId, {
      useWorkers,
      requireStreamToken: true,
    });
  }

  fastify.get("/v1/:instanceId/media-stream", { websocket: true }, handleMediaStream);
}

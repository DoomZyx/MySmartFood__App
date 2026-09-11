// @ts-nocheck

import { generateTwiml, generateTwimlTransferToRestaurant } from "../../Services/twilioServices/twilioServices.js";
import { PricingService } from "../../Business/services/PricingService.js";
import { PhoneLineService } from "../../Business/services/PhoneLineService.js";

function getInstanceIdFromEnv() {
  const fromEnv = process.env.INSTANCE_ID != null ? String(process.env.INSTANCE_ID).trim() : "";
  return fromEnv || "inst_default";
}

export default async function callRoutes(fastify) {
  fastify.all("/incoming-call", async (request, reply) => {
    const instanceId = getInstanceIdFromEnv();
    const lineEnabled = await PricingService.getPhoneLineEnabled(instanceId);
    if (!lineEnabled) {
      const transferNumber = await PhoneLineService.getTransferNumber(instanceId);
      return reply.type("text/xml").send(generateTwimlTransferToRestaurant(transferNumber));
    }
    const host = request.headers.host;
    const callerNumber = request.body?.From ?? request.query?.From ?? null;
    const xml = generateTwiml(
      host,
      "/media-stream",
      callerNumber,
      instanceId,
    );
    return reply.type("text/xml").send(xml);
  });
}

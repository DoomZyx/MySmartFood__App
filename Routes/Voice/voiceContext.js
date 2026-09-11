import { VoiceContextController } from "../../API/controllers/VoiceContextController.js";
import { requireInternalApiKey } from "../../middleware/requireInternalApiKey.js";

export default async function voiceContextRoutes(fastify) {
  fastify.get(
    "/context/:instanceId",
    {
      preHandler: requireInternalApiKey,
      schema: {
        params: {
          type: "object",
          required: ["instanceId"],
          properties: {
            instanceId: {
              type: "string",
              minLength: 1,
              maxLength: 128,
              pattern: "^[A-Za-z0-9_.:-]+$",
            },
          },
        },
      },
    },
    VoiceContextController.getContext,
  );
}

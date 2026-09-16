import { VoiceContextController } from "../../API/controllers/VoiceContextController.js";
import { LlmUsageController } from "../../API/controllers/LlmUsageController.js";
import { VoiceHangupController } from "../../API/controllers/VoiceHangupController.js";
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

  fastify.post(
    "/usage",
    {
      preHandler: requireInternalApiKey,
      schema: {
        body: {
          type: "object",
          required: ["instanceId"],
          properties: {
            instanceId: { type: "string", minLength: 1, maxLength: 128 },
            source: { type: "string", enum: ["voice", "extraction"] },
            provider: { type: "string", enum: ["vllm", "openai"] },
            model: { type: "string", maxLength: 160 },
            inputTokens: { type: "integer", minimum: 0 },
            outputTokens: { type: "integer", minimum: 0 },
            totalTokens: { type: "integer", minimum: 0 },
            latencyMs: { type: "integer", minimum: 0 },
          },
        },
      },
    },
    LlmUsageController.recordFromVoice,
  );

  fastify.post(
    "/call-ended",
    {
      preHandler: requireInternalApiKey,
      schema: {
        body: {
          type: "object",
          required: ["instanceId", "turns"],
          properties: {
            instanceId: { type: "string", minLength: 1, maxLength: 128 },
            streamSid: { type: "string", maxLength: 128 },
            callSid: { type: "string", maxLength: 128 },
            turns: {
              type: "array",
              maxItems: 40,
              items: {
                type: "object",
                required: ["role", "content"],
                properties: {
                  role: { type: "string", enum: ["user", "assistant"] },
                  content: { type: "string", maxLength: 2000 },
                },
              },
            },
            liveCreate: {
              type: ["object", "null"],
              additionalProperties: false,
              properties: {
                type: { type: "string", enum: ["reservation", "order"] },
                id: { type: ["string", "null"], maxLength: 64 },
              },
            },
          },
        },
      },
    },
    VoiceHangupController.callEnded,
  );
}

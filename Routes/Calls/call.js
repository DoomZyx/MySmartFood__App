/**
 * Ancien webhook Twilio. Désactivé : sans signature, il ouvrait un media-stream public.
 * L'entrée valide est POST /twilio/incoming-call.
 */
export default async function callRoutes(fastify) {
  fastify.all("/incoming-call", async (_request, reply) => {
    return reply.code(403).send({ error: "Signature Twilio invalide" });
  });
}

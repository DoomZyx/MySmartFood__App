import { requireAuth } from "../../middleware/sessionAuth.js";

export default async function csrfRoutes(fastify) {
  fastify.get("/api/csrf-token", {
    preHandler: [requireAuth],
    handler: async (_request, reply) => {
      const token = reply.generateCsrf();
      return { token };
    },
  });
}

import * as Contact from "../../models/pg/Contact.js";
import { sendContactEmails } from "../../utils/emailService.js";
import { requirePlatformAdmin } from "../../middleware/sessionAuth.js";

export default async function contactRoutes(fastify) {
  fastify.post("/", {
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    schema: {
      body: {
        type: "object",
        required: ["name", "email", "subject", "message"],
        properties: {
          name: { type: "string", minLength: 2, maxLength: 100 },
          email: { type: "string", format: "email" },
          company: { type: "string", maxLength: 100 },
          subject: { type: "string", minLength: 5, maxLength: 200 },
          message: { type: "string", minLength: 10, maxLength: 2000 },
        },
      },
    },
    handler: async (request, reply) => {
      const contact = await Contact.create(request.body);
      sendContactEmails(contact).catch(() => {});
      return reply.code(201).send({
        success: true,
        data: { id: contact.id, name: contact.name, email: contact.email, subject: contact.subject },
      });
    },
  });

  fastify.get("/", {
    preHandler: [requirePlatformAdmin],
    handler: async (request) => {
      const limit = Math.min(parseInt(request.query.limit, 10) || 10, 100);
      const page = Math.max(parseInt(request.query.page, 10) || 1, 1);
      const status = request.query.status;
      const [contacts, total] = await Promise.all([
        Contact.findWithFilter({ status, limit, offset: (page - 1) * limit }),
        Contact.countFilter(status),
      ]);
      return { success: true, data: contacts, pagination: { page, total } };
    },
  });

  fastify.get("/:id", {
    preHandler: [requirePlatformAdmin],
    handler: async (request, reply) => {
      const contact = await Contact.findById(request.params.id);
      if (!contact) return reply.code(404).send({ error: "Contact non trouvé" });
      return { success: true, data: contact };
    },
  });

  fastify.patch("/:id/status", {
    preHandler: [requirePlatformAdmin],
    handler: async (request, reply) => {
      const contact = await Contact.updateStatus(request.params.id, request.body?.status);
      if (!contact) return reply.code(404).send({ error: "Contact non trouvé ou statut invalide" });
      return { success: true, data: contact };
    },
  });
}

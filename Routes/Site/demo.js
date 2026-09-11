import * as Demo from "../../models/pg/Demo.js";
import { sendDemoEmails } from "../../utils/emailService.js";
import { requirePlatformAdmin } from "../../middleware/sessionAuth.js";

const TEAM_SIZES = ["1-5", "6-10", "11-25", "26-50", "50+"];
const TIMES = ["Matin (9h-12h)", "Après-midi (14h-17h)", "Soirée (18h-20h)", "Flexible"];
const DURATIONS = ["5 minutes", "10 minutes", "15 minutes"];

export default async function demoRoutes(fastify) {
  fastify.post("/", {
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
    schema: {
      body: {
        type: "object",
        required: ["name", "email", "company", "teamSize", "needs", "preferredTime", "duration"],
        properties: {
          name: { type: "string", minLength: 2, maxLength: 100 },
          email: { type: "string", format: "email" },
          company: { type: "string", minLength: 2, maxLength: 100 },
          teamSize: { type: "string", enum: TEAM_SIZES },
          needs: { type: "string", minLength: 10, maxLength: 500 },
          preferredTime: { type: "string", enum: TIMES },
          duration: { type: "string", enum: DURATIONS },
        },
      },
    },
    handler: async (request, reply) => {
      const demo = await Demo.create(request.body);
      sendDemoEmails(demo).catch(() => {});
      return reply.code(201).send({
        success: true,
        message: "Demande de démo envoyée avec succès ! Axel vous contactera rapidement pour fixer un rendez-vous.",
        data: { id: demo.id, name: demo.name, email: demo.email, company: demo.company },
      });
    },
  });

  fastify.get("/", {
    preHandler: [requirePlatformAdmin],
    handler: async () => ({ success: true, data: await Demo.findAll() }),
  });

  fastify.get("/:id", {
    preHandler: [requirePlatformAdmin],
    handler: async (request, reply) => {
      const demo = await Demo.findById(request.params.id);
      if (!demo) return reply.code(404).send({ error: "Démo non trouvée" });
      return { success: true, data: demo };
    },
  });
}

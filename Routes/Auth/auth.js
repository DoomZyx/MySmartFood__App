import { ProfileController } from "../../API/controllers/ProfileController.js";
import { UserController } from "../../API/controllers/UserController.js";
import { authenticateToken, requireAdmin } from "../../middleware/auth.js";

export default async function authRoutes(fastify, options) {
  // Login / register : Routes/Auth/accountAuth.js (cookie JWT + PostgreSQL).

  // Route pour obtenir le profil (utilisateur connecté)
  fastify.get("/profile", {
    preHandler: [authenticateToken],
    handler: ProfileController.getProfile,
  });

  // Route pour mettre à jour le profil (utilisateur connecté)
  fastify.put("/profile", {
    preHandler: [authenticateToken],
    schema: {
      body: {
        type: "object",
        properties: {
          username: { type: "string", minLength: 3, maxLength: 30 },
          email: { type: "string", format: "email" },
          telephone: { type: "string" },
          poste: { type: "string" },
          departement: { type: "string" },
          avatar: { type: "string" },
        },
      },
    },
    handler: ProfileController.updateProfile,
  });

  // Route pour uploader l'avatar (utilisateur connecté)
  fastify.post("/profile/avatar", {
    preHandler: [authenticateToken],
    handler: ProfileController.uploadAvatar,
  });

  // Routes admin pour la gestion des utilisateurs
  fastify.get("/users", {
    preHandler: [requireAdmin],
    handler: UserController.getAllUsers,
  });

  fastify.put("/users/:id", {
    preHandler: [requireAdmin],
    schema: {
      params: {
        type: "object",
        properties: {
          id: { type: "string", minLength: 24, maxLength: 24 },
        },
        required: ["id"],
      },
      body: {
        type: "object",
        properties: {
          username: { type: "string", minLength: 3, maxLength: 30 },
          email: { type: "string", format: "email" },
          role: { type: "string", enum: ["admin", "user"] },
          isActive: { type: "boolean" },
        },
      },
    },
    handler: UserController.updateUser,
  });

  fastify.delete("/users/:id", {
    preHandler: [requireAdmin],
    schema: {
      params: {
        type: "object",
        properties: {
          id: { type: "string", minLength: 24, maxLength: 24 },
        },
        required: ["id"],
      },
    },
    handler: UserController.deleteUser,
  });
}

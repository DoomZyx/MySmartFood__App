import { timingSafeEqualString } from "../utils/timingSafe.js";

export async function requireInternalSecret(request, reply) {
  const expected = process.env.SMARTCRM_INTERNAL_SECRET || process.env.WEBSITE_INTERNAL_SECRET;
  const provided = request.headers["x-internal-secret"];
  if (!timingSafeEqualString(expected, provided)) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
}

// @ts-nocheck
import Fastify from "fastify";
import callRoutes from "./call.js";

describe("Route /incoming-call", () => {
  const fastify = Fastify();
  beforeAll(async () => {
    await fastify.register(callRoutes);
  });

  it("refuse un appel sans signature Twilio", async () => {
    const response = await fastify.inject({
      method: "POST",
      url: "/incoming-call",
      headers: { host: "localhost" }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error).toBe("Signature Twilio invalide");
    expect(response.body).not.toContain("<Stream");
  });

});

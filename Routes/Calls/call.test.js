// @ts-nocheck
import Fastify from "fastify";
import callRoutes from "./call.js";

describe("Route /incoming-call", () => {
  const fastify = Fastify();
  beforeAll(async () => {
    await fastify.register(callRoutes);
  });

  it("devrait retourner du XML TwiML", async () => {
    const response = await fastify.inject({
      method: "POST",
      url: "/incoming-call",
      headers: { host: "localhost" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("xml");
    expect(response.body).toContain("<Response>");
    expect(response.body).toContain("<Play>");
    expect(response.body).toContain("<Stream");
  });
});

// @ts-nocheck
import Fastify from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import { jest } from "@jest/globals";

jest.unstable_mockModule("../../Websocket/connection.js", () => ({
  handleWebSocketConnection: jest.fn(),
}));

const { default: wsRoutes } = await import("./ws.js");

describe("Route /media-stream", () => {
  const fastify = Fastify();

  beforeAll(async () => {
    await fastify.register(fastifyWebsocket);
    await fastify.register(wsRoutes);
  });

  afterAll(async () => {
    await fastify.close();
  });

  it("devrait exposer la route WebSocket", () => {
    expect(fastify.printRoutes()).toContain("media-stream");
  });
});

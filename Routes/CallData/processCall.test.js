import Fastify from "fastify";
import processCallRoutes from "./processCall.js";

describe("POST /process-call", () => {
  const previousKey = process.env.X_API_KEY;
  let fastify;

  beforeEach(async () => {
    process.env.X_API_KEY = "process-call-internal-secret-key";
    fastify = Fastify();
    await fastify.register(processCallRoutes);
  });

  afterEach(async () => {
    await fastify.close();
    if (previousKey === undefined) delete process.env.X_API_KEY;
    else process.env.X_API_KEY = previousKey;
  });

  async function postProcessCall(headers = {}, body = { transcription: "bonjour" }) {
    return fastify.inject({
      method: "POST",
      url: "/process-call",
      headers: { "content-type": "application/json", ...headers },
      payload: body,
    });
  }

  it("refuse une requête sans clé interne", async () => {
    const response = await postProcessCall();
    expect(response.statusCode).toBe(401);
    expect(response.json().error).toBe("Clé API interne invalide");
  });

  it("refuse une clé interne invalide", async () => {
    const response = await postProcessCall({ "x-api-key": "wrong-key" });
    expect(response.statusCode).toBe(401);
  });

  it("avec une clé valide, refuse une transcription manquante sans appeler GPT", async () => {
    const response = await postProcessCall(
      { "x-api-key": process.env.X_API_KEY },
      {}
    );
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("Transcription manquante");
  });

  it("avec une clé valide, refuse une transcription trop longue", async () => {
    const response = await postProcessCall(
      { "x-api-key": process.env.X_API_KEY },
      { transcription: "a".repeat(50_001) }
    );
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("Transcription trop longue");
  });
});

import {
  incomingNumberVoiceUpdate,
  resetVoicePublicHostCache,
  resolveVoiceSlugParam,
  voicePublicHostname,
  voiceStreamHost,
  voiceWebhookSlug,
  voiceWebhookUrl,
} from "./voiceWebhookUrl.js";

describe("voiceWebhookUrl", () => {
  const originalGateway = process.env.VOICE_GATEWAY_PUBLIC_HOST;
  const originalPublic = process.env.PUBLIC_HOST;
  const originalKey = process.env.ACCOUNT_IDENTIFIER_ENCRYPTION_KEY;
  const TEST_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  beforeEach(() => {
    process.env.ACCOUNT_IDENTIFIER_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    if (originalGateway === undefined) delete process.env.VOICE_GATEWAY_PUBLIC_HOST;
    else process.env.VOICE_GATEWAY_PUBLIC_HOST = originalGateway;
    if (originalPublic === undefined) delete process.env.PUBLIC_HOST;
    else process.env.PUBLIC_HOST = originalPublic;
    if (originalKey === undefined) delete process.env.ACCOUNT_IDENTIFIER_ENCRYPTION_KEY;
    else process.env.ACCOUNT_IDENTIFIER_ENCRYPTION_KEY = originalKey;
    resetVoicePublicHostCache();
  });

  it("laisse le chemin webhook sans slug et chiffre l'identifiant HTTP", () => {
    delete process.env.VOICE_GATEWAY_PUBLIC_HOST;
    process.env.PUBLIC_HOST = "https://tunnel.example";
    const token = voiceWebhookSlug("chez-test");
    expect(token).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(token).not.toContain("chez-test");
    expect(voiceWebhookUrl("chez-test")).toBe("https://tunnel.example/twilio/incoming-call");
    expect(resolveVoiceSlugParam(token)).toBe("chez-test");
  });

  it("accepte encore un slug clair historique", () => {
    expect(resolveVoiceSlugParam("chez-test")).toBe("chez-test");
  });

  it("ignore un slug invalide et retombe sur le webhook unique", () => {
    delete process.env.VOICE_GATEWAY_PUBLIC_HOST;
    process.env.PUBLIC_HOST = "https://tunnel.example";
    expect(voiceWebhookUrl("../admin")).toBe(
      "https://tunnel.example/twilio/incoming-call"
    );
  });

  it("extrait le hostname d'une URL complète", () => {
    expect(voicePublicHostname("https://tunnel.example/")).toBe("tunnel.example");
  });

  it("utilise le host de la requête Twilio pour le stream", () => {
    delete process.env.VOICE_GATEWAY_PUBLIC_HOST;
    process.env.PUBLIC_HOST = "https://stale.example";
    expect(
      voiceStreamHost({
        headers: {
          host: "live.ngrok-free.app",
          "x-forwarded-host": "live.ngrok-free.app",
        },
      })
    ).toBe("live.ngrok-free.app");
  });

  it("retombe sur PUBLIC_HOST sans en-tetes de tunnel", () => {
    delete process.env.VOICE_GATEWAY_PUBLIC_HOST;
    process.env.PUBLIC_HOST = "https://tunnel.example";
    expect(voiceStreamHost({ headers: {} })).toBe("tunnel.example");
  });

  it("détache TwiML App et trunk pour que voiceUrl soit actif", async () => {
    delete process.env.VOICE_GATEWAY_PUBLIC_HOST;
    process.env.PUBLIC_HOST = "https://tunnel.example";
    await expect(incomingNumberVoiceUpdate("chez-test")).resolves.toEqual({
      voiceUrl: "https://tunnel.example/twilio/incoming-call",
      voiceMethod: "POST",
      voiceApplicationSid: "",
      trunkSid: "",
    });
  });
});

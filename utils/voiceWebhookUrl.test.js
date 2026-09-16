import {
  incomingNumberVoiceUpdate,
  resetVoicePublicHostCache,
  voicePublicHostname,
  voiceStreamHost,
  voiceWebhookUrl,
} from "./voiceWebhookUrl.js";

describe("voiceWebhookUrl", () => {
  const originalGateway = process.env.VOICE_GATEWAY_PUBLIC_HOST;
  const originalPublic = process.env.PUBLIC_HOST;

  afterEach(() => {
    if (originalGateway === undefined) delete process.env.VOICE_GATEWAY_PUBLIC_HOST;
    else process.env.VOICE_GATEWAY_PUBLIC_HOST = originalGateway;
    if (originalPublic === undefined) delete process.env.PUBLIC_HOST;
    else process.env.PUBLIC_HOST = originalPublic;
    resetVoicePublicHostCache();
  });

  it("construit le webhook isole par slug", () => {
    delete process.env.VOICE_GATEWAY_PUBLIC_HOST;
    process.env.PUBLIC_HOST = "https://tunnel.example";
    expect(voiceWebhookUrl("chez-test")).toBe(
      "https://tunnel.example/twilio/chez-test/incoming-call"
    );
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
      voiceUrl: "https://tunnel.example/twilio/chez-test/incoming-call",
      voiceMethod: "POST",
      voiceApplicationSid: "",
      trunkSid: "",
    });
  });
});

// @ts-nocheck
import { generateTwiml } from "./twilioServices.js";

describe("twilioService", () => {
  const original = process.env.VOICE_STREAM_URL;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.VOICE_STREAM_URL;
    } else {
      process.env.VOICE_STREAM_URL = original;
    }
  });

  it("devrait générer un TwiML valide avec l'URL correcte", () => {
    delete process.env.VOICE_STREAM_URL;
    const xml = generateTwiml("example.com");
    expect(xml).toContain("<Response>");
    expect(xml).toContain("<Play");
    expect(xml).toContain("wss://example.com/media-stream");
    expect(xml).toContain("<Connect>");
    expect(xml).toContain("</Response>");
  });

  it("pointe exclusivement vers le Voice Service si VOICE_STREAM_URL est defini", () => {
    process.env.VOICE_STREAM_URL = "wss://voice.example.com/media-stream";
    const xml = generateTwiml("example.com");
    expect(xml).toContain('url="wss://voice.example.com/media-stream"');
    expect(xml).not.toContain("wss://example.com/media-stream");
  });

  it("transmet le numéro appelant français au flux sans le demander", () => {
    delete process.env.VOICE_STREAM_URL;
    const xml = generateTwiml(
      "example.com",
      "/media-stream",
      "+33672886255",
      "restaurant-42",
    );

    expect(xml).toContain(
      '<Parameter name="callerNumber" value="06 72 88 62 55" />',
    );
    expect(xml).toContain(
      '<Parameter name="instanceId" value="restaurant-42" />',
    );
  });

  it("n'injecte pas de paramètre si le numéro est masqué", () => {
    const xml = generateTwiml("example.com", "/media-stream", "anonymous");

    expect(xml).not.toContain('name="callerNumber"');
  });

  it("accepte un PUBLIC_HOST complet comme hôte de stream", () => {
    delete process.env.VOICE_STREAM_URL;
    const xml = generateTwiml("https://tunnel.example", "/v1/abc/media-stream");
    expect(xml).toContain('url="wss://tunnel.example/v1/abc/media-stream"');
    expect(xml).not.toContain("wss://https://");
  });

  it("passe le jeton stream en paramètre TwiML, pas dans l'URL", () => {
    delete process.env.VOICE_STREAM_URL;
    const token = "ff3e05bf-2da5-465c-a7a2-f635021f49a9.1789109599.abc123def456abc123";
    const xml = generateTwiml(
      "tunnel.example",
      "/v1/abc/media-stream",
      null,
      "abc",
      token,
    );
    expect(xml).toContain('url="wss://tunnel.example/v1/abc/media-stream"');
    expect(xml).not.toContain(`media-stream/${token}`);
    expect(xml).toContain(`<Parameter name="streamToken" value="${token}" />`);
  });
});

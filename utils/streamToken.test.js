import {
  createStreamToken,
  readStreamToken,
  streamTokenFailureReason,
  validateStreamToken,
} from "./streamToken.js";

describe("streamToken", () => {
  const tenantId = "ff3e05bf-2da5-465c-a7a2-f635021f49a9";

  beforeEach(() => {
    process.env.TWILIO_AUTH_TOKEN = "test-twilio-token";
  });

  it("valide un token UUID aller-retour", () => {
    const token = createStreamToken(tenantId);
    expect(validateStreamToken(tenantId, token)).toBe(true);
    expect(streamTokenFailureReason(tenantId, token)).toBeNull();
  });

  it("signale un token absent (query Twilio droppee)", () => {
    expect(streamTokenFailureReason(tenantId, undefined)).toBe("token absent");
    expect(streamTokenFailureReason(tenantId, "")).toBe("token absent");
  });

  it("lit le token depuis le chemin", () => {
    const token = createStreamToken(tenantId);
    expect(readStreamToken({ params: { token } })).toBe(token);
  });

  it("refuse un autre tenant", () => {
    const token = createStreamToken(tenantId);
    expect(streamTokenFailureReason("other-tenant", token)).toBe("tenant mismatch");
  });
});

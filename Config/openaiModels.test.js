import {
  OPENAI_REALTIME_MODEL,
  resolveOpenAiCredentials,
  sanitizeOpenAiKey,
  sanitizeOpenAiModel,
} from "./openaiModels.js";

describe("openaiModels", () => {
  test("modèle Realtime utilisé par le runtime", () => {
    expect(OPENAI_REALTIME_MODEL).toBe("gpt-realtime-1.5");
  });

  test("clé tenant prioritaire sur l'env", () => {
    const resolved = resolveOpenAiCredentials({
      tenant: { openaiApiKey: "sk-tenant-key-1234567890", openaiModel: "gpt-realtime-1.5" },
      settings: { voiceModel: "gpt-4o-realtime-mini" },
      env: { OPENAI_API_KEY: "sk-env", OPENAI_MODEL: "ignored" },
    });
    expect(resolved.apiKey).toBe("sk-tenant-key-1234567890");
    expect(resolved.model).toBe("gpt-realtime-1.5");
  });

  test("sans clé tenant : env + modèle code", () => {
    const resolved = resolveOpenAiCredentials({
      tenant: {},
      env: { OPENAI_API_KEY: "sk-env-key", OPENAI_MODEL: "" },
    });
    expect(resolved.apiKey).toBe("sk-env-key");
    expect(resolved.model).toBe(OPENAI_REALTIME_MODEL);
  });

  test("sanitize refuse un modèle hors format", () => {
    expect(() => sanitizeOpenAiModel("gpt realtime")).toThrow("Modèle OpenAI invalide");
    expect(sanitizeOpenAiModel("gpt-realtime-1.5")).toBe("gpt-realtime-1.5");
  });

  test("sanitize refuse une clé trop courte", () => {
    expect(() => sanitizeOpenAiKey("sk-short")).toThrow("Clé API OpenAI invalide");
    expect(sanitizeOpenAiKey("")).toBe(null);
  });
});

import { describe, expect, test, beforeEach } from "@jest/globals";
import {
  clearVoiceContextCache,
  getCachedVoiceContext,
  invalidateVoiceContextCache,
  setCachedVoiceContext,
} from "./voiceContextCache.js";

describe("voiceContextCache", () => {
  beforeEach(() => {
    clearVoiceContextCache();
  });

  test("retourne null si absent", () => {
    expect(getCachedVoiceContext("tenant-a")).toBeNull();
  });

  test("stocke et lit une entree", () => {
    setCachedVoiceContext("tenant-a", { menu: {} }, 60_000);
    expect(getCachedVoiceContext("tenant-a")).toEqual({ menu: {} });
  });

  test("expire apres TTL", () => {
    setCachedVoiceContext("tenant-a", { ok: true }, 1);
    return new Promise((resolve) => {
      setTimeout(() => {
        expect(getCachedVoiceContext("tenant-a")).toBeNull();
        resolve();
      }, 5);
    });
  });

  test("invalidate retire la cle", () => {
    setCachedVoiceContext("tenant-a", { ok: true }, 60_000);
    invalidateVoiceContextCache("tenant-a");
    expect(getCachedVoiceContext("tenant-a")).toBeNull();
  });
});

import {
  decryptGoogleId,
  encryptGoogleId,
  hashGoogleId,
} from "./accountIdentifierCrypto.js";

const TEST_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("accountIdentifierCrypto", () => {
  beforeEach(() => {
    process.env.ACCOUNT_IDENTIFIER_ENCRYPTION_KEY = TEST_KEY;
  });

  test("chiffre et déchiffre un identifiant Google", () => {
    const encrypted = encryptGoogleId("123456789");

    expect(encrypted).not.toContain("123456789");
    expect(decryptGoogleId(encrypted)).toBe("123456789");
  });

  test("utilise un IV aléatoire et un index aveugle déterministe", () => {
    expect(encryptGoogleId("123")).not.toBe(encryptGoogleId("123"));
    expect(hashGoogleId("123")).toBe(hashGoogleId("123"));
    expect(hashGoogleId("123")).not.toBe(hashGoogleId("456"));
  });

  test("détecte toute altération du ciphertext", () => {
    const encrypted = encryptGoogleId("123");
    const parts = encrypted.split(":");
    parts[2] = `${parts[2].slice(0, -1)}${parts[2].endsWith("A") ? "B" : "A"}`;

    expect(() => decryptGoogleId(parts.join(":"))).toThrow();
  });
});

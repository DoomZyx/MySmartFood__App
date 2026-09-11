import { hashAccessToken } from "./DashboardAccessService.js";

describe("hashAccessToken", () => {
  test("produit un hash SHA-256 déterministe", () => {
    expect(hashAccessToken("abc")).toBe(hashAccessToken("abc"));
    expect(hashAccessToken("abc")).not.toBe(hashAccessToken("abd"));
    expect(hashAccessToken("abc")).toMatch(/^[a-f0-9]{64}$/);
  });
});

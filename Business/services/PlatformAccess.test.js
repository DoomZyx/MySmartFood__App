import {
  capabilityForPlatformRoute,
  hasPlatformCapability,
  normalizeStaffRole,
  resolvePlatformRole,
} from "./PlatformAccess.js";

describe("PlatformAccess", () => {
  it("résout owner depuis le flag propriétaire", () => {
    expect(
      resolvePlatformRole({ isPlatformAdmin: true, isPlatformOwner: true, platformRole: "ops" })
    ).toBe("owner");
  });

  it("fallback ops pour un admin sans rôle", () => {
    expect(resolvePlatformRole({ isPlatformAdmin: true })).toBe("ops");
  });

  it("refuse le staff aux non-owner", () => {
    const ops = { isPlatformAdmin: true, platformRole: "ops" };
    const support = { isPlatformAdmin: true, platformRole: "support" };
    const owner = { isPlatformAdmin: true, isPlatformOwner: true };
    expect(hasPlatformCapability(ops, "staff.manage")).toBe(false);
    expect(hasPlatformCapability(support, "impersonate")).toBe(true);
    expect(hasPlatformCapability(support, "tenant.lifecycle")).toBe(false);
    expect(hasPlatformCapability(owner, "staff.manage")).toBe(true);
    expect(hasPlatformCapability({ isPlatformAdmin: true, platformRole: "readonly" }, "user.write")).toBe(
      false
    );
  });

  it("mappe les routes plateforme vers une capacité", () => {
    expect(capabilityForPlatformRoute("POST", "/tenants/:tenantId/activate")).toBe(
      "tenant.lifecycle"
    );
    expect(capabilityForPlatformRoute("GET", "/api/platform/staff")).toBe("staff.manage");
    expect(capabilityForPlatformRoute("POST", "/impersonate")).toBe("impersonate");
  });

  it("normalise les rôles staff sans owner", () => {
    expect(normalizeStaffRole("support")).toBe("support");
    expect(normalizeStaffRole("owner")).toBe(null);
    expect(normalizeStaffRole("nope")).toBe("ops");
  });
});

// @ts-nocheck
import { jest } from "@jest/globals";

const loadLegacyPricing = jest.fn();
const ensureDefaults = jest.fn();
const ensureDefaultsWithClient = jest.fn();
const persistPricing = jest.fn();
const loadLegacyPricingWithClient = jest.fn();

jest.unstable_mockModule("./MenuCatalogService.js", () => ({
  loadLegacyPricing,
  ensureDefaults,
  ensureDefaultsWithClient,
  persistPricing,
  loadLegacyPricingWithClient,
}));

jest.unstable_mockModule("../../database/transaction.js", () => ({
  withTenant: async (_id, fn) => fn({}),
}));

jest.unstable_mockModule("./AvailabilityService.js", () => ({
  isOpenNow: jest.fn(() => true),
}));

jest.unstable_mockModule("../../models/pg/TenantSettings.js", () => ({
  find: jest.fn(),
  setPhoneLineEnabled: jest.fn(),
}));

jest.unstable_mockModule("../mappers/pricingMapper.js", () => ({
  hoursToLegacy: jest.fn(() => ({})),
}));

jest.unstable_mockModule("../../models/pg/OpeningHours.js", () => ({
  list: jest.fn(),
}));

const { PricingService } = await import("./PricingService.js");

const TENANT_ID = "22222222-2222-4222-8222-222222222222";

describe("PricingService.getPricing", () => {
  beforeEach(() => {
    loadLegacyPricing.mockReset();
    ensureDefaults.mockReset();
    loadLegacyPricing.mockResolvedValue({
      instanceId: TENANT_ID,
      menuPricing: {},
    });
  });

  test("lit le catalogue sans seed", async () => {
    const result = await PricingService.getPricing(TENANT_ID);
    expect(loadLegacyPricing).toHaveBeenCalledWith(TENANT_ID);
    expect(ensureDefaults).not.toHaveBeenCalled();
    expect(result.instanceId).toBe(TENANT_ID);
  });
});

import { resolvePlanSlug, slugFromWebsitePlanId, websitePlanIdFromSlug } from "./websitePlan.js";

describe("websitePlan", () => {
  test("mappe les planId vitrine vers les slugs unifiés", () => {
    expect(slugFromWebsitePlanId(1)).toBe("echauffement");
    expect(slugFromWebsitePlanId(3)).toBe("standard");
    expect(resolvePlanSlug({ planId: 2 })).toBe("mise_en_place");
    expect(resolvePlanSlug({ planSlug: "premium", planId: 1 })).toBe("premium");
  });

  test("retrouve un planId depuis le slug", () => {
    expect(websitePlanIdFromSlug("echauffement")).toBe(1);
    expect(websitePlanIdFromSlug("inconnu")).toBeNull();
  });
});

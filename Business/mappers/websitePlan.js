/** Plans vitrine (entiers 1–5) vers slugs du catalogue unifié. */
export const WEBSITE_PLAN_SLUGS = {
  1: "echauffement",
  2: "mise_en_place",
  3: "standard",
  4: "premium",
  5: "premium",
};

export function slugFromWebsitePlanId(planId) {
  const n = Number(planId);
  return WEBSITE_PLAN_SLUGS[n] || null;
}

export function websitePlanIdFromSlug(slug) {
  const entry = Object.entries(WEBSITE_PLAN_SLUGS).find(([, value]) => value === slug);
  return entry ? Number(entry[0]) : null;
}

export function resolvePlanSlug({ planSlug, planId }) {
  const fromSlug = planSlug ? String(planSlug).trim() : "";
  if (fromSlug) return fromSlug;
  return slugFromWebsitePlanId(planId);
}

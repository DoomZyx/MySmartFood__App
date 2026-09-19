export const PLATFORM_ROLES = ["owner", "ops", "support", "billing", "readonly"];

export const PLATFORM_CAPABILITIES = [
  "tenant.read",
  "tenant.write",
  "tenant.lifecycle",
  "tenant.ops",
  "tenant.phone",
  "lead.read",
  "lead.write",
  "lead.convert",
  "user.read",
  "user.write",
  "user.delete",
  "membership.write",
  "staff.manage",
  "impersonate",
];

const READ_CAPS = ["tenant.read", "lead.read", "user.read"];

const ROLE_CAPABILITIES = {
  owner: PLATFORM_CAPABILITIES,
  ops: PLATFORM_CAPABILITIES.filter((cap) => cap !== "staff.manage"),
  support: [
    "tenant.read",
    "lead.read",
    "lead.write",
    "lead.convert",
    "user.read",
    "user.write",
    "membership.write",
    "impersonate",
  ],
  billing: READ_CAPS,
  readonly: READ_CAPS,
};

const ROUTE_CAPS = {
  "GET /inbox": "tenant.read",
  "GET /tenants": "tenant.read",
  "GET /tenants/:tenantId": "tenant.read",
  "GET /tenants/:tenantId/documents/:kind": "tenant.read",
  "POST /tenants/:tenantId/documents": "tenant.write",
  "POST /tenants": "tenant.write",
  "PATCH /tenants/:tenantId": "tenant.write",
  "POST /tenants/:tenantId/users": "membership.write",
  "DELETE /tenants/:tenantId/users/:userId": "membership.write",
  "PATCH /leads/:kind/:leadId": "lead.write",
  "POST /leads/:kind/:leadId/convert": "lead.convert",
  "GET /tenants/:tenantId/users": "user.read",
  "GET /tenants/:tenantId/ops": "tenant.read",
  "PATCH /tenants/:tenantId/hours": "tenant.ops",
  "PATCH /tenants/:tenantId/menu-items/:itemId": "tenant.ops",
  "PATCH /tenants/:tenantId/users/:userId": "user.write",
  "POST /tenants/:tenantId/assign-phone": "tenant.phone",
  "POST /tenants/:tenantId/activate": "tenant.lifecycle",
  "POST /tenants/:tenantId/suspend": "tenant.lifecycle",
  "POST /tenants/:tenantId/close": "tenant.lifecycle",
  "POST /tenants/:tenantId/reject": "tenant.lifecycle",
  "GET /users": "user.read",
  "GET /users/:userId": "user.read",
  "PATCH /users/:userId": "user.write",
  "DELETE /users/:userId": "user.delete",
  "GET /staff": "staff.manage",
  "POST /staff": "staff.manage",
  "PATCH /staff/:userId": "staff.manage",
  "POST /staff/:userId/revoke": "staff.manage",
  "POST /impersonate": "impersonate",
};

export function resolvePlatformRole(user) {
  if (!user?.isPlatformAdmin) return null;
  if (user.isPlatformOwner) return "owner";
  const role = String(user.platformRole || "").trim();
  if (PLATFORM_ROLES.includes(role) && role !== "owner") return role;
  return "ops";
}

export function capabilitiesForRole(role) {
  return ROLE_CAPABILITIES[role] ? [...ROLE_CAPABILITIES[role]] : [];
}

export function hasPlatformCapability(user, capability) {
  const role = resolvePlatformRole(user);
  if (!role) return false;
  return capabilitiesForRole(role).includes(capability);
}

export function capabilityForPlatformRoute(method, url) {
  const raw = String(url || "");
  const path = raw.replace(/^\/api\/platform/, "").replace(/\/+$/, "") || "/";
  const key = `${String(method || "GET").toUpperCase()} ${path}`;
  return ROUTE_CAPS[key] || null;
}

export function normalizeStaffRole(value, { fallback = "ops" } = {}) {
  const role = String(value || "").trim();
  if (role === "owner") return null;
  if (PLATFORM_ROLES.includes(role) && role !== "owner") return role;
  return fallback;
}

const STAFF_ONLY = "staff.manage";

export function hasPlatformCapability(user, capability) {
  const caps = user?.platformCapabilities;
  if (Array.isArray(caps)) return caps.includes(capability);
  if (user?.isPlatformOwner) return true;
  if (user?.isPlatformAdmin) return capability !== STAFF_ONLY;
  return false;
}

export const PLATFORM_ROLE_LABELS = {
  owner: "Propriétaire",
  ops: "Exploitation",
  support: "Support",
  billing: "Facturation",
  readonly: "Lecture",
};

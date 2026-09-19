export function getUserFirstName(user) {
  const name = String(user?.name || "").trim();
  if (name) return name.split(/\s+/)[0];
  const email = String(user?.email || "").trim();
  if (!email.includes("@")) return "";
  const local = email.split("@")[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export function getUserAvatarUrl(user) {
  const url = user?.avatarUrl || user?.avatar || user?.picture || "";
  return String(url).trim() || null;
}

export function getUserInitial(user) {
  const firstName = getUserFirstName(user);
  return firstName ? firstName.charAt(0).toUpperCase() : "?";
}

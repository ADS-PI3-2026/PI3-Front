export function hasUserRole(user, role) {
  if (typeof role !== "string" || !role) return false;
  return Array.isArray(user?.roles) && user.roles.includes(role);
}

export function isAdminUser(user) {
  return hasUserRole(user, "admin");
}

export function getAuthenticatedHomePath(user) {
  return isAdminUser(user) ? "/admin" : "/garagem";
}

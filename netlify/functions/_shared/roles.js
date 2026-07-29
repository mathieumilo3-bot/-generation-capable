const ROLES = Object.freeze({
  ADMIN: 'admin',
  MANAGER: 'manager',
  VENDEUR: 'vendeur',
  AMBASSADEUR: 'ambassadeur',
  CLIENT: 'client'
});

const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.ADMIN]: ['*'],
  [ROLES.MANAGER]: ['audit:read', 'site:read', 'site:verify', 'payment:read', 'ambassador:read'],
  [ROLES.VENDEUR]: ['site:create', 'site:read', 'payment:create', 'commission:read'],
  [ROLES.AMBASSADEUR]: ['ambassador:read', 'ambassador:update', 'commission:read'],
  [ROLES.CLIENT]: ['site:verify', 'subscription:read']
});

function normalizeRole(role) {
  const value = String(role || ROLES.CLIENT).toLowerCase();
  return Object.values(ROLES).includes(value) ? value : ROLES.CLIENT;
}

function permissionsForRole(role) {
  return ROLE_PERMISSIONS[normalizeRole(role)] || ROLE_PERMISSIONS[ROLES.CLIENT];
}

function hasPermission(role, permission) {
  const permissions = permissionsForRole(role);
  return permissions.includes('*') || permissions.includes(permission);
}

async function resolveRole(user, supabaseFetch) {
  if (!user?.email) return ROLES.CLIENT;
  const encodedEmail = encodeURIComponent(user.email);
  const result = await supabaseFetch(`gc_user_roles?email=eq.${encodedEmail}&select=role&limit=1`, { serviceRole: true });
  if (!result.ok || !Array.isArray(result.data) || result.data.length === 0) return ROLES.CLIENT;
  return normalizeRole(result.data[0].role);
}

module.exports = { ROLES, ROLE_PERMISSIONS, normalizeRole, permissionsForRole, hasPermission, resolveRole };

-- Comptes déjà abonnés (ou admin plateforme) : accès dashboard sans attendre un nouveau jeton.
UPDATE users u
SET dashboard_unlocked_at = COALESCE(u.dashboard_unlocked_at, NOW())
WHERE u.is_platform_admin = TRUE
   OR EXISTS (
     SELECT 1
       FROM tenant_memberships m
       JOIN subscriptions s ON s.tenant_id = m.tenant_id
      WHERE m.user_id = u.id
        AND s.status IN ('active', 'trialing')
   );

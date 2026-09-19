UPDATE users u
   SET dossier_notice_pending_at = t.activated_at
  FROM tenants t
 WHERE t.owner_user_id = u.id
   AND t.status = 'active'
   AND t.activated_at IS NOT NULL
   AND t.activated_at > NOW() - INTERVAL '14 days'
   AND u.dossier_notice_pending_at IS NULL;

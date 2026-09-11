-- Offre interne développeur : hors catalogue public (is_active = false).
INSERT INTO plans (slug, name, monthly_call_minutes, price_cents, sort_order, is_active)
VALUES ('developpeur', 'Développeur', 999999, 0, 99, FALSE)
ON CONFLICT (slug) DO NOTHING;

-- Offre unique pour les restaurants en beta test : hors catalogue public.
INSERT INTO plans (slug, name, monthly_call_minutes, price_cents, sort_order, is_active)
VALUES ('beta', 'Beta testeurs', 999999, 0, 90, FALSE)
ON CONFLICT (slug) DO NOTHING;

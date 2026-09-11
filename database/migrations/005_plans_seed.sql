INSERT INTO plans (slug, name, monthly_call_minutes, price_cents, sort_order)
VALUES
  ('echauffement', 'Échauffement', 60, 0, 1),
  ('mise_en_place', 'Mise en place', 180, 0, 2),
  ('standard', 'Standard', 400, 0, 3),
  ('premium', 'Premium', 800, 0, 4)
ON CONFLICT (slug) DO NOTHING;

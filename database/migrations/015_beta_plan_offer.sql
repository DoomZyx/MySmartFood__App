-- Offre beta affichée : 150 €, 1300 minutes. Reste hors catalogue public.
UPDATE plans
   SET name = 'Beta testeurs',
       monthly_call_minutes = 1300,
       price_cents = 15000,
       sort_order = 90,
       is_active = FALSE
 WHERE slug = 'beta';

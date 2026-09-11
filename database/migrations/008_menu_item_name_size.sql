-- Mongo autorise plusieurs produits de même nom dans une catégorie (tailles, variantes).
-- L'unicité porte donc sur (catégorie, nom, taille), pas sur le nom seul.

DROP INDEX IF EXISTS menu_items_tenant_category_name_idx;

CREATE UNIQUE INDEX menu_items_tenant_category_name_size_idx
  ON menu_items (tenant_id, category_id, name, COALESCE(size_label, ''));

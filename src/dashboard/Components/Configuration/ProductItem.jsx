import React from "react";
import { useTranslation } from "react-i18next";
import { CustomOptionsSection } from "./CustomOptionsSection";
import "./ProductItem.scss";

export const ProductItem = ({
  produit,
  index,
  categorie,
  isEditing,
  onStartEdit,
  onSave,
  onCancel,
  onDelete,
  onChange,
  safePricing
}) => {
  const { t } = useTranslation();

  if (isEditing) {
    return (
      <div className="product-item">
        <div className="product-edit">
          <input
            type="text"
            placeholder={t('configuration.menu.productName')}
            value={produit.nom}
            onChange={(e) => onChange('nom', e.target.value)}
          />
          <input
            type="text"
            placeholder={t('configuration.menu.description')}
            value={produit.description}
            onChange={(e) => onChange('description', e.target.value)}
          />
          <input
            type="number"
            placeholder={t('configuration.menu.price')}
            value={produit.prix || produit.prixBase}
            onChange={(e) => onChange('prixBase', parseFloat(e.target.value) || 0)}
            onFocus={(e) => e.target.select()}
            min="0"
            step="0.01"
          />

          <label className="product-disponible-edit">
            <input
              type="checkbox"
              checked={produit.disponible !== false}
              onChange={(e) => onChange('disponible', e.target.checked)}
            />
            {t('configuration.menu.productForm.available')}
          </label>

          <CustomOptionsSection 
            categorie={categorie}
            options={produit.options || {}}
            onUpdateOptions={(newOptions) => onChange('options', newOptions)}
          />

          <div className="edit-actions">
            <button onClick={onSave}>
              {t('common.save')}
            </button>
            <button onClick={onCancel}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isAvailable = produit.disponible !== false;

  return (
    <div className="product-item">
      <div className="product-display">
        <div className="product-info">
          <h5>{produit.nom}</h5>
          <p>{produit.description}</p>
          <span className="price">{produit.prix || produit.prixBase}€</span>
          <span className={`product-availability-badge ${isAvailable ? 'available' : 'unavailable'}`}>
            {isAvailable ? t('configuration.menu.availableLabel') : t('configuration.menu.unavailableLabel')}
          </span>
        </div>
        <div className="product-actions">
          <button
            type="button"
            className="btn-toggle-availability"
            onClick={() => onChange('disponible', !isAvailable)}
            title={isAvailable ? t('configuration.menu.markUnavailable') : t('configuration.menu.markAvailable')}
          >
            {isAvailable ? t('configuration.menu.markUnavailable') : t('configuration.menu.markAvailable')}
          </button>
          <button className="" onClick={onStartEdit}>
            {t('common.edit')}
          </button>
          <button 
            onClick={onDelete}
            disabled={!produit._id}
            title={produit._id ? t('common.delete') : 'Produit sans ID - Rechargez la page'}
          >
            {t('common.delete')}
          </button>
        </div>
      </div>
    </div>
  );
};


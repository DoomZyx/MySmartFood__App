import React from "react";
import { useTranslation } from "react-i18next";
import "./ConfigurationRestaurant.scss";

export function ConfigurationRestaurant({ safePricing, handleInputChange }) {
  const { t } = useTranslation();

  return (
    <div className="restaurant-info">
      <h3>{t('configuration.restaurant.title')}</h3>

      <div className="form-group">
        <label htmlFor="instancePhoneNumber">{t("configuration.restaurant.smartPhone")}</label>
        <input
          id="instancePhoneNumber"
          type="tel"
          value={safePricing.instancePhoneNumber || ""}
          placeholder={t("configuration.restaurant.smartPhonePending")}
          readOnly
        />
        <small className="help-text">
          {safePricing.instancePhoneNumber
            ? t("configuration.restaurant.smartPhoneHelp")
            : t("configuration.restaurant.smartPhonePendingHelp")}
        </small>
      </div>

      <div className="form-group">
        <label>{t('configuration.restaurant.name')}</label>
        <input
          type="text"
          value={safePricing.restaurantInfo?.nom || ""}
          onChange={(e) => handleInputChange("restaurantInfo.nom", e.target.value)}
        />
      </div>
      
      <div className="form-group">
        <label>{t('configuration.restaurant.address')}</label>
        <input
          type="text"
          value={safePricing.restaurantInfo?.adresse || ""}
          onChange={(e) => handleInputChange("restaurantInfo.adresse", e.target.value)}
        />
      </div>
      
      <div className="form-group">
        <label>{t('configuration.restaurant.phone')}</label>
        <input
          type="tel"
          value={safePricing.restaurantInfo?.telephone || ""}
          onChange={(e) => handleInputChange("restaurantInfo.telephone", e.target.value)}
        />
        <small className="help-text">
          Numéro du restaurant pour le transfert humain : lorsque l&apos;IA doit passer l&apos;appel à votre équipe, elle utilise ce numéro.
        </small>
      </div>
      
      <div className="form-group">
        <label>{t('configuration.restaurant.email')}</label>
        <input
          type="email"
          value={safePricing.restaurantInfo?.email || ""}
          onChange={(e) => handleInputChange("restaurantInfo.email", e.target.value)}
        />
      </div>
      
      <div className="form-group">
        <label>{t('configuration.restaurant.seats')}</label>
        <input
          type="number"
          min="0"
          value={safePricing.restaurantInfo?.nombreCouverts || 0}
          onChange={(e) => handleInputChange("restaurantInfo.nombreCouverts", parseInt(e.target.value) || 0)}
          onFocus={(e) => e.target.select()}
          placeholder="Ex: 50"
        />
        <small className="help-text">{t('configuration.restaurant.seatsHelp')}</small>
      </div>

      <div className="form-group">
        <label htmlFor="accessibilitePmr">{t('configuration.restaurant.pmr')}</label>
        <select
          id="accessibilitePmr"
          value={
            safePricing.restaurantInfo?.accessibilitePmr === true
              ? "yes"
              : safePricing.restaurantInfo?.accessibilitePmr === false
                ? "no"
                : ""
          }
          onChange={(e) => {
            const value = e.target.value;
            handleInputChange(
              "restaurantInfo.accessibilitePmr",
              value === "yes" ? true : value === "no" ? false : null
            );
          }}
        >
          <option value="">{t('configuration.restaurant.pmrUnknown')}</option>
          <option value="yes">{t('common.yes')}</option>
          <option value="no">{t('common.no')}</option>
        </select>
        <small className="help-text">{t('configuration.restaurant.pmrHelp')}</small>
      </div>

      <div className="form-group">
        <label htmlFor="nombreChaisesBebe">{t('configuration.restaurant.highchairs')}</label>
        <input
          id="nombreChaisesBebe"
          type="number"
          min="0"
          value={
            safePricing.restaurantInfo?.nombreChaisesBebe === "" ||
            safePricing.restaurantInfo?.nombreChaisesBebe == null
              ? ""
              : safePricing.restaurantInfo.nombreChaisesBebe
          }
          onChange={(e) =>
            handleInputChange(
              "restaurantInfo.nombreChaisesBebe",
              e.target.value === ""
                ? ""
                : Math.max(0, parseInt(e.target.value, 10) || 0)
            )
          }
          onFocus={(e) => e.target.select()}
          placeholder="Ex: 4"
        />
        <small className="help-text">{t('configuration.restaurant.highchairsHelp')}</small>
      </div>
    </div>
  );
}


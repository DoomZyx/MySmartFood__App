import React from "react";
import { useTranslation } from "react-i18next";
import "./ConfigurationHoraires.scss";

export function ConfigurationHoraires({ safePricing, handleInputChange }) {
  const { t } = useTranslation();

  return (
    <div className="opening-hours">
      <h3>{t('configuration.hours.title')}</h3>
      <div className="hours-grid">
        {Object.keys(safePricing.restaurantInfo?.horairesOuverture || {}).map((jour) => {
          const horaire = safePricing.restaurantInfo.horairesOuverture[jour];
          return (
            <div key={jour} className="day-hours">
              <div className="day-header">
                <label className="day-name">
                <input
                  type="checkbox"
                    checked={horaire?.ouvert || false}
                    onChange={(e) => 
                      handleInputChange(`restaurantInfo.horairesOuverture.${jour}.ouvert`, e.target.checked)
                    }
                  />
                  {t(`configuration.hours.days.${jour}`)}
              </label>
            </div>
              
              {horaire?.ouvert && (
                <>
                  <div className="time-slot">
                    <span>{t('configuration.hours.lunch')}</span>
                    <input
                      type="time"
                      value={horaire.midi?.ouverture || ""}
                      onChange={(e) => 
                        handleInputChange(`restaurantInfo.horairesOuverture.${jour}.midi.ouverture`, e.target.value)
                      }
                    />
                    <span>{t('configuration.hours.to')}</span>
                    <input
                      type="time"
                      value={horaire.midi?.fermeture || ""}
                      onChange={(e) => 
                        handleInputChange(`restaurantInfo.horairesOuverture.${jour}.midi.fermeture`, e.target.value)
                      }
                    />
                  </div>
                  
                  <div className="time-slot">
                    <span>{t('configuration.hours.dinner')}</span>
                    <input
                      type="time"
                      value={horaire.soir?.ouverture || ""}
                      onChange={(e) => 
                        handleInputChange(`restaurantInfo.horairesOuverture.${jour}.soir.ouverture`, e.target.value)
                      }
                    />
                    <span>{t('configuration.hours.to')}</span>
                    <input
                      type="time"
                      value={horaire.soir?.fermeture || ""}
                      onChange={(e) => 
                        handleInputChange(`restaurantInfo.horairesOuverture.${jour}.soir.fermeture`, e.target.value)
                      }
                    />
                  </div>
                </>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}


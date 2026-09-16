import React from "react";
import { useTranslation } from "react-i18next";
import "./ConfigurationLanguage.scss";

export function ConfigurationLanguage({ languageSuccess, handleLanguageChange }) {
  const { t } = useTranslation();

  return (
    <div className="language-settings">
      <h3>{t('configuration.language.title')}</h3>
      <p>{t('configuration.language.description')}</p>
      
      {languageSuccess && (
        <div className="notification-toast success-message">
          <i className="bi bi-check-circle-fill"></i>
          <span className="message-content">{t('common.success')}</span>
        </div>
      )}
      
      <div className="language-options">
          <button
            onClick={() => handleLanguageChange('fr')}
          className="language-btn"
          >
          🇫🇷 {t('configuration.language.french')}
          </button>
          <button
            onClick={() => handleLanguageChange('en')}
          className="language-btn"
          >
          🇬🇧 {t('configuration.language.english')}
          </button>
      </div>
    </div>
  );
}


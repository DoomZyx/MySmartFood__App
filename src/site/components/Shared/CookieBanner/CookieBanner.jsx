import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Settings, Shield, BarChart3, Cookie } from "lucide-react";
import "./CookieBanner.scss";

const CookieBanner = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState({
    necessary: true, // Toujours activé
    analytics: false,
    functional: false
  });

  useEffect(() => {
    // Vérifier si le consentement a déjà été donné
    const consent = localStorage.getItem("cookieConsent");
    if (!consent) {
      setShowBanner(true);
    }
  }, []);

  const handleAcceptAll = () => {
    const allAccepted = {
      necessary: true,
      analytics: true,
      functional: true
    };
    
    localStorage.setItem("cookieConsent", JSON.stringify(allAccepted));
    setShowBanner(false);
    
    // Initialiser les services acceptés
    initializeServices(allAccepted);
  };

  const handleAcceptSelected = () => {
    localStorage.setItem("cookieConsent", JSON.stringify(preferences));
    setShowBanner(false);
    
    // Initialiser seulement les services acceptés
    initializeServices(preferences);
  };

  const handleRejectAll = () => {
    const onlyNecessary = {
      necessary: true,
      analytics: false,
      functional: false
    };
    
    localStorage.setItem("cookieConsent", JSON.stringify(onlyNecessary));
    setShowBanner(false);
  };

  const handlePreferenceChange = (type) => {
    if (type === "necessary") return; // Ne peut pas être désactivé
    
    setPreferences(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  const initializeServices = (consent) => {
    // Cookies nécessaires (toujours activés)
    // - Session de navigation
    // - Préférences de langue
    // - Sécurité CSRF pour les formulaires
    
    if (consent.analytics) {
      // Google Analytics ou autre outil d'analyse
      if (import.meta.env.DEV) {
        // Exemple : gtag('consent', 'update', { analytics_storage: 'granted' });
      }
    }
    
    if (consent.functional) {
      // Cookies fonctionnels pour améliorer l'expérience
      // - Mémorisation des préférences de formulaire
      // - Sauvegarde des données de contact temporaires
    }
  };

  const cookieTypes = [
    {
      type: "necessary",
      title: "Cookies nécessaires",
      description: "Ces cookies sont essentiels au fonctionnement du site et des formulaires de contact. Ils ne peuvent pas être désactivés.",
      icon: Shield,
      required: true
    },
    {
      type: "analytics",
      title: "Cookies analytiques",
      description: "Ces cookies nous aident à comprendre comment les visiteurs utilisent le site et à améliorer nos services.",
      icon: BarChart3,
      required: false
    },
    {
      type: "functional",
      title: "Cookies fonctionnels",
      description: "Ces cookies améliorent votre expérience en mémorisant vos préférences et les données de formulaire.",
      icon: Settings,
      required: false
    }
  ];

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          className="cookie-banner"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <div className="cookie-content">
            {!showSettings ? (
              // Vue principale
              <>
                <div className="cookie-header">
                  <div className="cookie-icon">
                    <Cookie size={24} />
                  </div>
                  <div className="cookie-text">
                    <h3>Nous utilisons des cookies</h3>
                    <p>
                      Nous utilisons des cookies pour assurer le bon fonctionnement de nos formulaires de contact 
                      et améliorer votre expérience. Vous pouvez choisir ceux que vous acceptez.
                    </p>
                  </div>
                  <button 
                    className="cookie-close"
                    onClick={() => setShowBanner(false)}
                  >
                    <X size={20} />
                  </button>
                </div>
                
                <div className="cookie-actions">
                  <button 
                    className="btn btn-secondary"
                    onClick={() => setShowSettings(true)}
                  >
                    <Settings size={16} />
                    Personnaliser
                  </button>
                  <button 
                    className="btn btn-secondary"
                    onClick={handleRejectAll}
                  >
                    Refuser tout
                  </button>
                  <button 
                    className="btn btn-primary"
                    onClick={handleAcceptAll}
                  >
                    Accepter tout
                  </button>
                </div>
              </>
            ) : (
              // Vue des paramètres
              <>
                <div className="cookie-header">
                  <div className="cookie-icon">
                    <Settings size={24} />
                  </div>
                  <div className="cookie-text">
                    <h3>Paramètres des cookies</h3>
                    <p>
                      Choisissez les types de cookies que vous souhaitez autoriser.
                    </p>
                  </div>
                  <button 
                    className="cookie-close"
                    onClick={() => setShowSettings(false)}
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="cookie-preferences">
                  {cookieTypes.map(({ type, title, description, icon: Icon, required }) => (
                    <div key={type} className="cookie-preference">
                      <div className="preference-header">
                        <Icon size={20} />
                        <div className="preference-info">
                          <h4>{title}</h4>
                          <p>{description}</p>
                        </div>
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={preferences[type]}
                            onChange={() => handlePreferenceChange(type)}
                            disabled={required}
                          />
                          <span className="toggle-slider"></span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="cookie-actions">
                  <button 
                    className="btn btn-secondary"
                    onClick={() => setShowSettings(false)}
                  >
                    Retour
                  </button>
                  <button 
                    className="btn btn-primary"
                    onClick={handleAcceptSelected}
                  >
                    Enregistrer mes choix
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CookieBanner; 
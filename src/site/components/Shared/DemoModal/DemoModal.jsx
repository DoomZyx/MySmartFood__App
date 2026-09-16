import React, { useState, useEffect } from "react";
import { X, Send, CheckCircle, AlertCircle } from "lucide-react";
import { useDemoForm } from "../../../hooks/useDemoForm";
import "./DemoModal.scss";

const DemoModal = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    teamSize: "",
    needs: "",
    preferredTime: "",
    duration: ""
  });

  const { submitDemoForm, isLoading, error, success, resetForm } = useDemoForm();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await submitDemoForm(formData);
      setFormData({
        name: "",
        email: "",
        company: "",
        teamSize: "",
        needs: "",
        preferredTime: "",
        duration: ""
      });
    } catch (err) {
      // L'erreur est déjà gérée dans le hook
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Fermer avec Escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="demo-modal-overlay" onClick={handleClose}>
      <div className="demo-modal" onClick={(e) => e.stopPropagation()}>
        <button className="demo-modal-close" onClick={handleClose}>
          <X size={24} />
        </button>

        <div className="demo-modal-content">
          <h2 className="demo-modal-title">
            Demander une démo
            <span className="text-gradient"> SmartCRM</span>
          </h2>
          
          <p className="demo-modal-subtitle">
            Remplissez ce formulaire pour planifier une démo personnalisée de nos solutions CRM et IA Voice.
          </p>

          <form onSubmit={handleSubmit} className="demo-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="name">Nom complet *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Votre nom"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="email">Email *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="votre@email.com"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="company">Entreprise *</label>
                <input
                  type="text"
                  id="company"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  required
                  placeholder="Nom de votre entreprise"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="teamSize">Taille de l'équipe *</label>
                <select
                  id="teamSize"
                  name="teamSize"
                  value={formData.teamSize}
                  onChange={handleChange}
                  required
                >
                  <option value="">Sélectionnez</option>
                  <option value="1-5">1-5 personnes</option>
                  <option value="6-10">6-10 personnes</option>
                  <option value="11-25">11-25 personnes</option>
                  <option value="26-50">26-50 personnes</option>
                  <option value="50+">50+ personnes</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="needs">Vos besoins *</label>
              <textarea
                id="needs"
                name="needs"
                value={formData.needs}
                onChange={handleChange}
                required
                placeholder="Décrivez vos besoins en CRM et IA Voice..."
                rows="4"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="preferredTime">Horaire préféré *</label>
                <select
                  id="preferredTime"
                  name="preferredTime"
                  value={formData.preferredTime}
                  onChange={handleChange}
                  required
                >
                  <option value="">Sélectionnez</option>
                  <option value="Matin (9h-12h)">Matin (9h-12h)</option>
                  <option value="Après-midi (14h-17h)">Après-midi (14h-17h)</option>
                  <option value="Soirée (18h-20h)">Soirée (18h-20h)</option>
                  <option value="Flexible">Flexible</option>
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="duration">Durée souhaitée *</label>
                <select
                  id="duration"
                  name="duration"
                  value={formData.duration}
                  onChange={handleChange}
                  required
                >
                  <option value="">Sélectionnez</option>
                  <option value="5 minutes">5 minutes</option>
                  <option value="10 minutes">10 minutes</option>
                  <option value="15 minutes">15 minutes</option>
                </select>
              </div>
            </div>

            {success && (
              <div className="form-message success">
                <CheckCircle className="icon" />
                <div>
                  <h4>Demande envoyée !</h4>
                  <p>Axel vous contactera rapidement pour fixer un rendez-vous.</p>
                </div>
              </div>
            )}

            {error && (
              <div className="form-message error">
                <AlertCircle className="icon" />
                <div>
                  <h4>Erreur</h4>
                  <p>{error}</p>
                </div>
              </div>
            )}

            <button type="submit" className="btn btn-primary submit-btn" disabled={isLoading}>
              {isLoading ? (
                <>
                  <div className="spinner"></div>
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Send className="icon" />
                  Demander une démo
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default DemoModal; 
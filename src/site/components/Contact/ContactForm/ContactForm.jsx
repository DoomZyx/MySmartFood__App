import React, { useState, useEffect } from "react";
import { Send, CheckCircle, AlertCircle } from "lucide-react";
import { useContactForm } from "../../../hooks/useContactForm";
import "./ContactForm.scss";

const ContactForm = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    subject: "",
    message: "",
  });

  const { submitContactForm, isLoading, error, success, resetForm } =
    useContactForm();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await submitContactForm(formData);
      // Réinitialiser le formulaire en cas de succès
      setFormData({
        name: "",
        email: "",
        company: "",
        subject: "",
        message: "",
      });
    } catch (err) {
      // L'erreur est déjà gérée dans le hook
    }
  };

  // Réinitialiser les états quand le composant se monte
  useEffect(() => {
    resetForm();
  }, [resetForm]);

  return (
    <form onSubmit={handleSubmit} className="contact-form">
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="name" className="form-label">
            Nom complet *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="form-input"
            placeholder="Votre nom"
          />
        </div>

        <div className="form-group">
          <label htmlFor="email" className="form-label">
            Email *
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="form-input"
            placeholder="votre@email.com"
          />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="company" className="form-label">
          Entreprise
        </label>
        <input
          type="text"
          id="company"
          name="company"
          value={formData.company}
          onChange={handleChange}
          className="form-input"
          placeholder="Nom de votre entreprise"
        />
      </div>

      <div className="form-group">
        <label htmlFor="subject" className="form-label">
          Sujet *
        </label>
        <input
          type="text"
          id="subject"
          name="subject"
          value={formData.subject}
          onChange={handleChange}
          required
          className="form-input"
          placeholder="Sujet de votre message"
        />
      </div>

      <div className="form-group">
        <label htmlFor="message" className="form-label">
          Message *
        </label>
        <textarea
          id="message"
          name="message"
          value={formData.message}
          onChange={handleChange}
          required
          rows={6}
          className="form-textarea"
          placeholder="Décrivez votre projet ou votre question..."
        />
      </div>

      {/* Messages de succès et d'erreur */}
      {success && (
        <div className="form-message success">
          <CheckCircle className="icon" />
          <span>
            Message envoyé avec succès ! Nous vous répondrons dans les plus
            brefs délais.
          </span>
        </div>
      )}

      {error && (
        <div className="form-message error">
          <AlertCircle className="icon" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        className="btn btn-primary submit-btn"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <div className="spinner"></div>
            Envoi en cours...
          </>
        ) : (
          <>
            <Send className="icon" />
            Envoyer le message
          </>
        )}
      </button>
    </form>
  );
};

export default ContactForm;

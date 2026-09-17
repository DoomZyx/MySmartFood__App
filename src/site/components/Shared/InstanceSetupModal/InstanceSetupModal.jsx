import React, { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import { submitOnboardingDossierApi, getCurrentUser } from "../../../services/authService";
import "./InstanceSetupModal.scss";

const PAYS_OPTIONS = [
  { value: "", label: "Sélectionner un pays" },
  { value: "France", label: "France" },
  { value: "Luxembourg", label: "Luxembourg" },
  { value: "Belgique", label: "Belgique" },
];

const defaultFormData = {
  username: "",
  nomEtablissement: "",
  adresse: "",
  codePostal: "",
  ville: "",
  pays: "",
  telephone: "",
  email: "",
  nombreCouverts: "",
  typeCuisine: "",
  twilioNumberUsage: "",
  siret: "",
  accessibilitePmr: "",
  nombreChaisesBebe: "",
};

const ACCEPTED_DOC_TYPES = ".pdf,image/jpeg,image/png,image/jpg";
const MAX_FILE_SIZE_MB = 5;

/**
 * Modale affichée après un paiement réussi : collecte les infos restaurant
 * et envoie le dossier Twilio (sans création d'instance automatique).
 */
const InstanceSetupModal = ({ isOpen, onClose }) => {
  const { setAuth, user } = useAuth();
  const [formData, setFormData] = useState(defaultFormData);
  const [idDocumentRecto, setIdDocumentRecto] = useState(null);
  const [idDocumentVerso, setIdDocumentVerso] = useState(null);
  const [addressDocument, setAddressDocument] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [provisionResult, setProvisionResult] = useState(null);

  useEffect(() => {
    if (isOpen && user?.email) {
      const fromEmail = (user.email || "").split("@")[0].replace(/[^a-z0-9]/gi, "_").slice(0, 26) || "user";
      setFormData((prev) => ({
        ...defaultFormData,
        ...prev,
        email: user.email || "",
        username: prev.username || (fromEmail.length >= 3 ? fromEmail : fromEmail + "01"),
      }));
      setError(null);
    }
  }, [isOpen, user?.email]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleClose = useCallback(() => {
    setError(null);
    setProvisionResult(null);
    setIdDocumentRecto(null);
    setIdDocumentVerso(null);
    setAddressDocument(null);
    onClose();
  }, [onClose]);

  const handleFileChange = (field, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`Fichier ${file.name} trop volumineux (max ${MAX_FILE_SIZE_MB} Mo).`);
      return;
    }
    if (field === "idDocumentRecto") setIdDocumentRecto(file);
    else if (field === "idDocumentVerso") setIdDocumentVerso(file);
    else setAddressDocument(file);
    setError(null);
  };

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") handleClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, handleClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setProvisionResult(null);
    const usage = (formData.twilioNumberUsage || "").trim();
    if (usage.length < 15) {
      setError("Décrivez l'usage prévu du numéro (quelques phrases).");
      return;
    }
    const registration = (formData.siret || "").replace(/\D/g, "");
    if (registration.length !== 14 && registration.length !== 9) {
      setError("Indiquez un SIRET (14 chiffres) ou, à défaut, un SIREN (9 chiffres).");
      return;
    }
    if (!idDocumentRecto || !idDocumentVerso || !addressDocument) {
      setError("Pièce d'identité recto et verso, et justificatif d'adresse sont requis.");
      return;
    }
    setIsLoading(true);
    try {
      const { username: _u, ...profilePayload } = formData;
      const data = await submitOnboardingDossierApi(profilePayload, {
        idDocumentRecto,
        idDocumentVerso,
        addressDocument,
      });
      const apiUser = await getCurrentUser();
      if (apiUser) setAuth(apiUser);
      setProvisionResult({
        message: data.message || "Dossier transmis.",
      });
    } catch (err) {
      setError(err.message || "Une erreur est survenue.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="instance-setup-modal-overlay" onClick={handleClose}>
      <div className="instance-setup-modal" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="instance-setup-modal-close"
          onClick={handleClose}
          aria-label="Fermer"
        >
          <X size={24} />
        </button>

        <div className="instance-setup-modal-content">
          <h2 className="instance-setup-modal-title">
            {provisionResult ? "Dossier transmis" : "Configuration de votre restaurant"}
          </h2>
          <p className="instance-setup-modal-subtitle">
            {provisionResult
              ? provisionResult.message
              : "Complétez les informations ci-dessous et joignez les pièces pour Twilio. Notre équipe activera votre accès à l&apos;application ensuite ; vous recevrez un e-mail."}
          </p>

          {!provisionResult && (
            <div className="instance-setup-modal-info" role="status">
              <p>
                SIRET (ou SIREN), pièce d&apos;identité du dirigeant recto et verso, preuve d&apos;adresse (&lt; 3 mois), description de l&apos;usage du numéro. PDF ou image, max {MAX_FILE_SIZE_MB} Mo par fichier.
              </p>
            </div>
          )}

          {provisionResult ? (
            <div className="instance-setup-result">
              <p className="instance-setup-result-success">{provisionResult.message}</p>
              <button type="button" className="instance-setup-form-submit" onClick={handleClose}>
                Fermer
              </button>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="instance-setup-form">
            <div className="instance-setup-form-group">
              <label htmlFor="instance-username" className="instance-setup-form-label">
                Nom d&apos;utilisateur (connexion à l&apos;application) *
              </label>
              <input
                type="text"
                id="instance-username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                minLength={3}
                maxLength={30}
                pattern="[a-zA-Z0-9_]+"
                title="Lettres, chiffres et tirets bas uniquement (3 à 30 caractères)"
                className="instance-setup-form-input"
                placeholder="Ex: jean_dupont"
                disabled={isLoading}
              />
            </div>
            <div className="instance-setup-form-row">
              <div className="instance-setup-form-group">
                <label htmlFor="instance-nomEtablissement" className="instance-setup-form-label">
                  Nom de l&apos;établissement *
                </label>
                <input
                  type="text"
                  id="instance-nomEtablissement"
                  name="nomEtablissement"
                  value={formData.nomEtablissement}
                  onChange={handleChange}
                  required
                  className="instance-setup-form-input"
                  placeholder="Ex: Le Bistrot du Marché"
                  disabled={isLoading}
                />
              </div>
              <div className="instance-setup-form-group">
                <label htmlFor="instance-typeCuisine" className="instance-setup-form-label">
                  Type de cuisine
                </label>
                <input
                  type="text"
                  id="instance-typeCuisine"
                  name="typeCuisine"
                  value={formData.typeCuisine}
                  onChange={handleChange}
                  className="instance-setup-form-input"
                  placeholder="Ex: Française, Italienne"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="instance-setup-form-group">
              <label htmlFor="instance-adresse" className="instance-setup-form-label">
                Adresse *
              </label>
              <input
                type="text"
                id="instance-adresse"
                name="adresse"
                value={formData.adresse}
                onChange={handleChange}
                required
                className="instance-setup-form-input"
                placeholder="Numéro et nom de rue"
                disabled={isLoading}
              />
            </div>

            <div className="instance-setup-form-row">
              <div className="instance-setup-form-group">
                <label htmlFor="instance-codePostal" className="instance-setup-form-label">
                  Code postal *
                </label>
                <input
                  type="text"
                  id="instance-codePostal"
                  name="codePostal"
                  value={formData.codePostal}
                  onChange={handleChange}
                  required
                  className="instance-setup-form-input"
                  placeholder="75001"
                  maxLength={10}
                  disabled={isLoading}
                />
              </div>
              <div className="instance-setup-form-group">
                <label htmlFor="instance-ville" className="instance-setup-form-label">
                  Ville *
                </label>
                <input
                  type="text"
                  id="instance-ville"
                  name="ville"
                  value={formData.ville}
                  onChange={handleChange}
                  required
                  className="instance-setup-form-input"
                  placeholder="Paris"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="instance-setup-form-group">
              <label htmlFor="instance-pays" className="instance-setup-form-label">
                Pays *
              </label>
              <select
                id="instance-pays"
                name="pays"
                value={formData.pays}
                onChange={handleChange}
                required
                className="instance-setup-form-input"
                disabled={isLoading}
              >
                {PAYS_OPTIONS.map((opt) => (
                  <option key={opt.value || "empty"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="instance-setup-form-row">
              <div className="instance-setup-form-group">
                <label htmlFor="instance-telephone" className="instance-setup-form-label">
                  Téléphone *
                </label>
                <input
                  type="tel"
                  id="instance-telephone"
                  name="telephone"
                  value={formData.telephone}
                  onChange={handleChange}
                  required
                  className="instance-setup-form-input"
                  placeholder="+33123456789"
                  disabled={isLoading}
                />
              </div>
              <div className="instance-setup-form-group">
                <label htmlFor="instance-email" className="instance-setup-form-label">
                  Email *
                </label>
                <input
                  type="email"
                  id="instance-email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="instance-setup-form-input"
                  placeholder="contact@restaurant.fr"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="instance-setup-form-group">
              <label htmlFor="instance-nombreCouverts" className="instance-setup-form-label">
                Nombre de couverts (capacité)
              </label>
              <input
                type="number"
                id="instance-nombreCouverts"
                name="nombreCouverts"
                value={formData.nombreCouverts}
                onChange={handleChange}
                min={1}
                max={999}
                className="instance-setup-form-input"
                placeholder="Ex: 50"
                disabled={isLoading}
              />
            </div>

            <div className="instance-setup-form-row">
              <div className="instance-setup-form-group">
                <label htmlFor="instance-accessibilitePmr" className="instance-setup-form-label">
                  Accès personnes à mobilité réduite (PMR)
                </label>
                <select
                  id="instance-accessibilitePmr"
                  name="accessibilitePmr"
                  value={formData.accessibilitePmr}
                  onChange={handleChange}
                  className="instance-setup-form-input"
                  disabled={isLoading}
                >
                  <option value="">Non renseigné</option>
                  <option value="yes">Oui</option>
                  <option value="no">Non</option>
                </select>
              </div>
              <div className="instance-setup-form-group">
                <label htmlFor="instance-nombreChaisesBebe" className="instance-setup-form-label">
                  Nombre de chaises bébé
                </label>
                <input
                  type="number"
                  id="instance-nombreChaisesBebe"
                  name="nombreChaisesBebe"
                  value={formData.nombreChaisesBebe}
                  onChange={handleChange}
                  min={0}
                  max={999}
                  className="instance-setup-form-input"
                  placeholder="Ex: 4"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="instance-setup-form-group">
              <label htmlFor="instance-twilioNumberUsage" className="instance-setup-form-label">
                Usage prévu du numéro professionnel *
              </label>
              <textarea
                id="instance-twilioNumberUsage"
                name="twilioNumberUsage"
                value={formData.twilioNumberUsage}
                onChange={handleChange}
                required
                minLength={15}
                maxLength={2000}
                rows={4}
                className="instance-setup-form-input"
                placeholder="Ex : appels clients pour réservations et informations."
                disabled={isLoading}
              />
            </div>

            <div className="instance-setup-form-group">
              <label htmlFor="instance-siret" className="instance-setup-form-label">
                SIRET (ou SIREN) *
              </label>
              <input
                type="text"
                id="instance-siret"
                name="siret"
                value={formData.siret}
                onChange={handleChange}
                required
                inputMode="numeric"
                maxLength={17}
                className="instance-setup-form-input"
                placeholder="14 chiffres, ou 9 pour le SIREN"
                disabled={isLoading}
              />
            </div>
            <div className="instance-setup-form-group">
              <label htmlFor="instance-idRecto" className="instance-setup-form-label">
                Pièce d&apos;identité dirigeant — recto *
              </label>
              <input
                type="file"
                id="instance-idRecto"
                name="idDocumentRecto"
                accept={ACCEPTED_DOC_TYPES}
                onChange={(e) => handleFileChange("idDocumentRecto", e)}
                className="instance-setup-form-input"
                disabled={isLoading}
              />
              {idDocumentRecto && (
                <span className="instance-setup-form-file-name">{idDocumentRecto.name}</span>
              )}
            </div>
            <div className="instance-setup-form-group">
              <label htmlFor="instance-idVerso" className="instance-setup-form-label">
                Pièce d&apos;identité dirigeant — verso *
              </label>
              <input
                type="file"
                id="instance-idVerso"
                name="idDocumentVerso"
                accept={ACCEPTED_DOC_TYPES}
                onChange={(e) => handleFileChange("idDocumentVerso", e)}
                className="instance-setup-form-input"
                disabled={isLoading}
              />
              {idDocumentVerso && (
                <span className="instance-setup-form-file-name">{idDocumentVerso.name}</span>
              )}
            </div>
            <div className="instance-setup-form-group">
              <label htmlFor="instance-addressDocument" className="instance-setup-form-label">
                Preuve d&apos;adresse établissement *
              </label>
              <input
                type="file"
                id="instance-addressDocument"
                name="addressDocument"
                accept={ACCEPTED_DOC_TYPES}
                onChange={(e) => handleFileChange("addressDocument", e)}
                className="instance-setup-form-input"
                disabled={isLoading}
              />
              {addressDocument && (
                <span className="instance-setup-form-file-name">{addressDocument.name}</span>
              )}
            </div>

            {error && (
              <p className="instance-setup-form-error" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="btn btn-primary instance-setup-submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="spinner" />
                  Envoi en cours...
                </>
              ) : (
                "Transmettre le dossier"
              )}
            </button>
          </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default InstanceSetupModal;

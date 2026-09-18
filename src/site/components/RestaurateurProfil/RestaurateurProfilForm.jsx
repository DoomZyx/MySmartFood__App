import React, { useState, useEffect, useRef } from "react";
import { Save, CheckCircle, AlertCircle } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useRestaurateurProfile } from "../../hooks/useRestaurateurProfile";
import NotificationToast from "../Shared/NotificationToast/NotificationToast";
import { fileToWebp, PHOTO_ACCEPT, PHOTO_MAX_MB } from "../../utils/imageWebp";
import { clearPaidPendingDossier } from "@shared/companyOnboarding";
import "./RestaurateurProfilForm.scss";

const PAYS_OPTIONS = [
  { value: "", label: "Sélectionner un pays" },
  { value: "France", label: "France" },
  { value: "Luxembourg", label: "Luxembourg" },
  { value: "Belgique", label: "Belgique" },
];

const defaultFormData = {
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

const MAX_FILE_SIZE_MB = PHOTO_MAX_MB;

function isEstablishmentComplete(data) {
  return Boolean(
    String(data.nomEtablissement || "").trim() &&
      String(data.adresse || "").trim() &&
      String(data.codePostal || "").trim() &&
      String(data.ville || "").trim() &&
      String(data.pays || "").trim() &&
      String(data.telephone || "").trim() &&
      String(data.email || "").trim()
  );
}

const RestaurateurProfilForm = ({
  companyFormStep = 1,
  onCompanyFormStepChange,
  onEstablishmentReadyChange,
} = {}) => {
  const { user, refreshUser } = useAuth();
  const [formData, setFormData] = useState(defaultFormData);
  const [toast, setToast] = useState({ visible: false, message: "" });
  const [idRectoFile, setIdRectoFile] = useState(null);
  const [idVersoFile, setIdVersoFile] = useState(null);
  const [addrDocFile, setAddrDocFile] = useState(null);
  const [dossierLocalError, setDossierLocalError] = useState(null);
  const didAutoAdvance = useRef(false);
  const {
    profile,
    loadProfile,
    submitProfile,
    submitOnboardingDossier,
    isLoading,
    isLoadingProfile,
    isSubmittingOnboarding,
    error,
    success,
    onboardingError,
    resetForm,
  } = useRestaurateurProfile();

  const docsAlreadySent = Boolean(user?.twilioDocsSubmittedAt);
  const establishmentComplete = isEstablishmentComplete(formData);
  const showDossierStep = companyFormStep === 2 && !docsAlreadySent;

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (user?.email) {
      setFormData((prev) => ({ ...prev, email: user.email || "" }));
    }
  }, [user]);

  useEffect(() => {
    onEstablishmentReadyChange?.(establishmentComplete);
  }, [establishmentComplete, onEstablishmentReadyChange]);

  useEffect(() => {
    if (
      !profile ||
      (profile.nomEtablissement == null &&
        profile.adresse == null &&
        profile.email == null &&
        profile.twilioNumberUsage == null)
    ) {
      return;
    }
    const next = {
      ...defaultFormData,
      nomEtablissement: profile.nomEtablissement ?? "",
      adresse: profile.adresse ?? "",
      codePostal: profile.codePostal ?? "",
      ville: profile.ville ?? "",
      pays: profile.pays ?? "",
      telephone: profile.telephone ?? "",
      email: profile.email ?? user?.email ?? "",
      nombreCouverts: profile.nombreCouverts != null ? String(profile.nombreCouverts) : "",
      typeCuisine: profile.typeCuisine ?? "",
      twilioNumberUsage: profile.twilioNumberUsage ?? "",
      siret: profile.siret || profile.siren || "",
      accessibilitePmr:
        profile.accessibilitePmr === true
          ? "yes"
          : profile.accessibilitePmr === false
            ? "no"
            : "",
      nombreChaisesBebe:
        profile.nombreChaisesBebe != null ? String(profile.nombreChaisesBebe) : "",
    };
    setFormData((prev) => ({
      ...next,
      email: next.email || prev.email,
    }));
    if (
      !didAutoAdvance.current &&
      !user?.twilioDocsSubmittedAt &&
      isEstablishmentComplete(next)
    ) {
      didAutoAdvance.current = true;
      onCompanyFormStepChange?.(2);
    }
    // Hydratation unique quand le profil API change, pas à chaque frappe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  useEffect(() => {
    resetForm();
  }, [resetForm]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const goToDossierStep = () => {
    if (!establishmentComplete) return;
    onCompanyFormStepChange?.(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await submitProfile(formData);
      await refreshUser();
      setToast({ visible: true, message: "Informations enregistrées avec succès." });
      if (!docsAlreadySent) {
        onCompanyFormStepChange?.(2);
      }
    } catch (_) {
      // erreur gérée dans le hook
    }
  };

  const assignPickedFile = (kind, file) => {
    if (kind === "idRecto") setIdRectoFile(file);
    else if (kind === "idVerso") setIdVersoFile(file);
    else setAddrDocFile(file);
  };

  const handleFilePick = async (kind, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      e.target.value = "";
      assignPickedFile(kind, null);
      setDossierLocalError(`Fichier trop volumineux (max ${MAX_FILE_SIZE_MB} Mo).`);
      return;
    }
    setDossierLocalError(null);
    assignPickedFile(kind, file);
    try {
      const compressed = await fileToWebp(file);
      assignPickedFile(kind, compressed);
    } catch {
      assignPickedFile(kind, null);
      e.target.value = "";
      setDossierLocalError(
        "Image illisible. Utilisez un JPEG, PNG, WebP ou HEIF valide (pas un fichier corrompu).",
      );
    }
  };

  const handleDossierSubmit = async (e) => {
    e.preventDefault();
    resetForm();
    setDossierLocalError(null);
    if (!establishmentComplete) {
      setDossierLocalError("Complétez d'abord les informations de l'établissement.");
      onCompanyFormStepChange?.(1);
      return;
    }
    const usage = (formData.twilioNumberUsage || "").trim();
    if (usage.length < 15) {
      setDossierLocalError(
        "Décrivez l'usage prévu du numéro (au moins une phrase courte).",
      );
      return;
    }
    const registration = String(formData.siret || "").replace(/\D/g, "");
    if (registration.length !== 14 && registration.length !== 9) {
      setDossierLocalError(
        "Indiquez un SIRET (14 chiffres) ou, à défaut, un SIREN (9 chiffres).",
      );
      return;
    }
    if (!idRectoFile || !idVersoFile || !addrDocFile) {
      setDossierLocalError(
        `Joignez la pièce d'identité recto et verso, et le justificatif d'adresse (PDF ou image, max ${MAX_FILE_SIZE_MB} Mo chacun).`,
      );
      return;
    }
    try {
      await submitOnboardingDossier(formData, {
        idDocumentRecto: idRectoFile,
        idDocumentVerso: idVersoFile,
        addressDocument: addrDocFile,
      });
      clearPaidPendingDossier();
      await refreshUser();
      setIdRectoFile(null);
      setIdVersoFile(null);
      setAddrDocFile(null);
      setToast({
        visible: true,
        message:
          "Dossier transmis. Vous recevrez un e-mail lorsque l'application sera accessible.",
      });
    } catch (_) {
      // onboardingError dans le hook
    }
  };

  if (isLoadingProfile) {
    return (
      <div className="restaurateur-profil-form restaurateur-profil-form--loading">
        <div className="spinner" />
        <span>Chargement des informations...</span>
      </div>
    );
  }

  return (
    <>
      <NotificationToast
        message={toast.message}
        visible={toast.visible}
        onClose={() => setToast((t) => ({ ...t, visible: false }))}
        autoHide={4000}
        type="success"
      />
      {!showDossierStep ? (
      <form onSubmit={handleSubmit} className="restaurateur-profil-form">
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="nomEtablissement" className="form-label">
            Nom de l&apos;établissement *
          </label>
          <input
            type="text"
            id="nomEtablissement"
            name="nomEtablissement"
            value={formData.nomEtablissement}
            onChange={handleChange}
            required
            className="form-input"
            placeholder="Ex: Le Bistrot du Marché"
          />
        </div>
        <div className="form-group">
          <label htmlFor="typeCuisine" className="form-label">
            Type de cuisine
          </label>
          <input
            type="text"
            id="typeCuisine"
            name="typeCuisine"
            value={formData.typeCuisine}
            onChange={handleChange}
            className="form-input"
            placeholder="Ex: Française, Italienne"
          />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="adresse" className="form-label">
          Adresse *
        </label>
        <input
          type="text"
          id="adresse"
          name="adresse"
          value={formData.adresse}
          onChange={handleChange}
          required
          className="form-input"
          placeholder="Numéro et nom de rue"
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="codePostal" className="form-label">
            Code postal *
          </label>
          <input
            type="text"
            id="codePostal"
            name="codePostal"
            value={formData.codePostal}
            onChange={handleChange}
            required
            className="form-input"
            placeholder="75001"
            maxLength={10}
          />
        </div>
        <div className="form-group">
          <label htmlFor="ville" className="form-label">
            Ville *
          </label>
          <input
            type="text"
            id="ville"
            name="ville"
            value={formData.ville}
            onChange={handleChange}
            required
            className="form-input"
            placeholder="Paris"
          />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="pays" className="form-label">
          Pays *
        </label>
        <select
          id="pays"
          name="pays"
          value={formData.pays}
          onChange={handleChange}
          required
          className="form-input"
        >
          {PAYS_OPTIONS.map((opt) => (
            <option key={opt.value || "empty"} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="telephone" className="form-label">
            Téléphone *
          </label>
          <input
            type="tel"
            id="telephone"
            name="telephone"
            value={formData.telephone}
            onChange={handleChange}
            required
            className="form-input"
            placeholder="FR:+33123456789 | LU:+35247825 | B:+3223744264"
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
            placeholder="contact@restaurant.fr"
          />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="nombreCouverts" className="form-label">
          Nombre de couverts (capacité)
        </label>
        <input
          type="number"
          id="nombreCouverts"
          name="nombreCouverts"
          value={formData.nombreCouverts}
          onChange={handleChange}
          min={1}
          max={999}
          className="form-input"
          placeholder="Ex: 50"
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="accessibilitePmr" className="form-label">
            Accès personnes à mobilité réduite (PMR)
          </label>
          <select
            id="accessibilitePmr"
            name="accessibilitePmr"
            value={formData.accessibilitePmr}
            onChange={handleChange}
            className="form-input"
          >
            <option value="">Non renseigné</option>
            <option value="yes">Oui</option>
            <option value="no">Non</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="nombreChaisesBebe" className="form-label">
            Nombre de chaises bébé
          </label>
          <input
            type="number"
            id="nombreChaisesBebe"
            name="nombreChaisesBebe"
            value={formData.nombreChaisesBebe}
            onChange={handleChange}
            min={0}
            max={999}
            className="form-input"
            placeholder="Ex: 4"
          />
        </div>
      </div>

      {success && (
        <div className="form-message success">
          <CheckCircle className="icon" />
          <span>Informations enregistrées avec succès.</span>
        </div>
      )}

      {error && (
        <div className="form-message error">
          <AlertCircle className="icon" />
          <span>{error}</span>
        </div>
      )}

      {!docsAlreadySent && (
        <button
          type="button"
          className="btn btn-primary submit-btn"
          disabled={!establishmentComplete || isLoading}
          onClick={goToDossierStep}
        >
          Continuer vers les pièces
        </button>
      )}

      <button
        type="submit"
        className="btn btn-primary submit-btn"
        disabled={isLoading || isSubmittingOnboarding}
      >
        {isLoading ? (
          <>
            <div className="spinner" />
            Enregistrement...
          </>
        ) : (
          <>
            <Save className="icon" />
            Enregistrer les informations
          </>
        )}
      </button>
    </form>
      ) : (
      <form
        id="dossier-form"
        onSubmit={handleDossierSubmit}
        className="restaurateur-profil-form"
      >
      <div className="form-group">
        <label htmlFor="twilioNumberUsage" className="form-label">
          Usage prévu du numéro professionnel *
        </label>
        <textarea
          id="twilioNumberUsage"
          name="twilioNumberUsage"
          value={formData.twilioNumberUsage}
          onChange={handleChange}
          className="form-input"
          rows={4}
          maxLength={2000}
          required
          placeholder="Ex : réception des appels clients pour réservations et informations sur la carte et les horaires."
          disabled={isSubmittingOnboarding}
        />
      </div>
          <div className="form-group">
            <label htmlFor="siret" className="form-label">
              SIRET (ou SIREN) *
            </label>
            <input
              type="text"
              id="siret"
              name="siret"
              value={formData.siret}
              onChange={handleChange}
              className="form-input"
              inputMode="numeric"
              autoComplete="off"
              maxLength={17}
              required
              placeholder="14 chiffres, ou 9 chiffres pour le SIREN"
              disabled={isSubmittingOnboarding}
            />
          </div>
          <div className="form-group">
            <label htmlFor="idDocumentRecto" className="form-label">
              Pièce d&apos;identité du dirigeant — recto *
            </label>
            <input
              type="file"
              id="idDocumentRecto"
              name="idDocumentRecto"
              accept={PHOTO_ACCEPT}
              onChange={(e) => handleFilePick("idRecto", e)}
              className="form-input"
              disabled={isSubmittingOnboarding}
            />
          </div>
          <div className="form-group">
            <label htmlFor="idDocumentVerso" className="form-label">
              Pièce d&apos;identité du dirigeant — verso *
            </label>
            <input
              type="file"
              id="idDocumentVerso"
              name="idDocumentVerso"
              accept={PHOTO_ACCEPT}
              onChange={(e) => handleFilePick("idVerso", e)}
              className="form-input"
              disabled={isSubmittingOnboarding}
            />
          </div>
          <div className="form-group">
            <label htmlFor="addressDocument" className="form-label">
              Preuve d&apos;adresse de l&apos;établissement (&lt; 3 mois) *
            </label>
            <input
              type="file"
              id="addressDocument"
              name="addressDocument"
              accept={PHOTO_ACCEPT}
              onChange={(e) => handleFilePick("addr", e)}
              className="form-input"
              disabled={isSubmittingOnboarding}
            />
          </div>
          {(onboardingError || dossierLocalError) && (
            <div className="form-message error">
              <AlertCircle className="icon" />
              <span>{onboardingError || dossierLocalError}</span>
            </div>
          )}
          <button
            type="button"
            className="btn btn-secondary submit-btn"
            disabled={isSubmittingOnboarding}
            onClick={() => onCompanyFormStepChange?.(1)}
          >
            Retour aux informations
          </button>
          <button
            type="submit"
            className="btn btn-primary submit-btn"
            disabled={isSubmittingOnboarding || isLoading}
          >
            {isSubmittingOnboarding ? (
              <>
                <div className="spinner" />
                Envoi du dossier...
              </>
            ) : (
              <>Transmettre le dossier Twilio</>
            )}
          </button>
    </form>
      )}
    </>
  );
};

export default RestaurateurProfilForm;

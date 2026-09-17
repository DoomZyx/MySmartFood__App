import React, { useEffect, useMemo, useState } from "react";
import { fetchPlatformDocumentBlob } from "../../services/platformAdminService";
import { fileToWebp, PHOTO_ACCEPT } from "../../utils/imageWebp";
import "./PlatformDossierReview.scss";

const DOC_LABELS = {
  kbis: "KBIS / extrait Kbis",
  id_recto: "Pièce d'identité recto",
  id_verso: "Pièce d'identité verso",
  address_proof: "Justificatif d'adresse",
};

const IDENTITY_SLOTS = [
  { kind: "id_recto", label: "Carte d'identité — recto" },
  { kind: "id_verso", label: "Carte d'identité — verso" },
];

function formatBytes(size) {
  const bytes = Number(size) || 0;
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function DocumentPreview({ tenantId, document }) {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let revoked = false;
    let objectUrl = null;
    setPreview(null);
    setError(null);
    fetchPlatformDocumentBlob(tenantId, document.kind)
      .then(({ blob, mimeType }) => {
        objectUrl = URL.createObjectURL(blob);
        if (revoked) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setPreview({ url: objectUrl, mimeType });
      })
      .catch((err) => {
        if (!revoked) setError(err.message);
      });
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [tenantId, document.kind]);

  const label = DOC_LABELS[document.kind] || document.kind;
  const isImage = String(preview?.mimeType || document.mimeType || "").startsWith("image/");
  const isPdf = String(preview?.mimeType || document.mimeType || "").includes("pdf");

  return (
    <article className="pdr-doc">
      <header className="pdr-doc-head">
        <h4>{label}</h4>
        <p>
          {formatBytes(document.byteSize)} · {document.mimeType || "type inconnu"} ·{" "}
          {formatDate(document.uploadedAt)}
        </p>
        {document.sha256 ? <p className="pdr-sha">SHA-256 {document.sha256}</p> : null}
      </header>
      {error && (
        <p className="pdr-error" role="alert">
          {error}
        </p>
      )}
      {!error && !preview && <p className="pdr-empty">Chargement de la pièce...</p>}
      {preview && isImage && (
        <img className="pdr-preview-img" src={preview.url} alt={label} />
      )}
      {preview && isPdf && (
        <iframe className="pdr-preview-frame" title={label} src={preview.url} />
      )}
      {preview && !isImage && !isPdf && (
        <p className="pdr-empty">Aperçu indisponible pour ce format.</p>
      )}
      {preview && (
        <a className="pdr-download" href={preview.url} download={`${document.kind}`}>
          Ouvrir / télécharger
        </a>
      )}
    </article>
  );
}

const PlatformDossierReview = ({ tenant, onUploadIdentity, uploadBusyId }) => {
  const [showDocuments, setShowDocuments] = useState(Boolean(tenant.needsReview));
  const [uploadError, setUploadError] = useState(null);
  const [compressingKind, setCompressingKind] = useState(null);
  const fields = useMemo(
    () => [
      ["Nom établissement", tenant.businessName || tenant.name],
      ["Propriétaire", tenant.ownerName],
      ["E-mail propriétaire", tenant.ownerEmail],
      ["E-mail établissement", tenant.restaurantEmail],
      ["Téléphone établissement", tenant.restaurantPhone],
      ["Adresse", tenant.addressLine],
      ["Code postal", tenant.postalCode],
      ["Ville", tenant.city],
      ["Pays", tenant.profileCountry || tenant.countryCode],
      ["SIRET", tenant.siret],
      ["SIREN", tenant.siren],
      ["Couverts", tenant.seatCount],
      ["Cuisine", tenant.cuisineType],
      ["Offre", tenant.planName || tenant.planSlug],
      ["Abonnement", tenant.subscriptionStatus],
      ["Statut établissement", tenant.status],
      ["Provisioning", tenant.provisioningState],
      ["Bundle Twilio", tenant.bundleStatus],
      ["Numéro vocal", tenant.phoneNumber],
      ["Dossier envoyé le", formatDate(tenant.documentsSubmittedAt)],
    ],
    [tenant]
  );

  const documents = Array.isArray(tenant.documents) ? tenant.documents : [];
  const documentsByKind = useMemo(
    () => Object.fromEntries(documents.map((item) => [item.kind, item])),
    [documents]
  );

  const handleIdentityPick = async (kind, event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !onUploadIdentity) return;
    setUploadError(null);
    setCompressingKind(kind);
    setShowDocuments(true);
    try {
      const webp = await fileToWebp(file);
      await onUploadIdentity(kind, webp);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setCompressingKind(null);
    }
  };

  return (
    <section className="pdr" aria-label="Vérification du dossier">
      <h3>Dossier à vérifier</h3>
      <p className="pdr-intro">
        Comparez chaque champ et chaque pièce avec l&apos;identité de
        l&apos;établissement avant d&apos;accepter.
      </p>
      <dl className="pdr-grid">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value == null || value === "" ? "—" : String(value)}</dd>
          </div>
        ))}
        <div className="pdr-wide">
          <dt>Usage du numéro</dt>
          <dd>{tenant.phoneNumberUsage || "—"}</dd>
        </div>
      </dl>

      <div className="pdr-id">
        <h4>Carte d&apos;identité</h4>
        <p className="pdr-intro">
          Photo recto et verso. Chaque cliché est compressé en WebP puis
          enregistré en base.
        </p>
        <div className="pdr-id-slots">
          {IDENTITY_SLOTS.map((slot) => {
            const current = documentsByKind[slot.kind];
            const busy =
              compressingKind === slot.kind ||
              uploadBusyId === `${tenant.id}:${slot.kind}`;
            return (
              <label key={slot.kind} className="pdr-id-slot">
                <span>{slot.label}</span>
                {current ? (
                  <em>
                    {formatBytes(current.byteSize)} · {current.mimeType || "fichier"}
                  </em>
                ) : (
                  <em>Aucune photo</em>
                )}
                <input
                  type="file"
                  accept={PHOTO_ACCEPT}
                  capture="environment"
                  disabled={busy || !onUploadIdentity}
                  onChange={(event) => handleIdentityPick(slot.kind, event)}
                />
                {busy ? <strong>Compression et enregistrement...</strong> : null}
              </label>
            );
          })}
        </div>
        {uploadError ? (
          <p className="pdr-error" role="alert">
            {uploadError}
          </p>
        ) : null}
      </div>

      {documents.length === 0 ? (
        <p className="pdr-empty">Aucune pièce transmise pour le moment.</p>
      ) : (
        <>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowDocuments((current) => !current)}
          >
            {showDocuments ? "Masquer les pièces" : `Voir les pièces (${documents.length})`}
          </button>
          {showDocuments && (
            <div className="pdr-docs">
              {documents.map((document) => (
                <DocumentPreview
                  key={`${document.kind}-${document.uploadedAt || document.sha256 || ""}`}
                  tenantId={tenant.id}
                  document={document}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default PlatformDossierReview;

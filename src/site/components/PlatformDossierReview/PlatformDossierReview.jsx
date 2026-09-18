import React, { useEffect, useMemo, useState } from "react";
import { fetchPlatformDocumentBlob } from "../../services/platformAdminService";
import { fileToWebp, PHOTO_ACCEPT } from "../../utils/imageWebp";
import {
  REQUIRED_DOC_SLOTS,
  scrollToDossierField,
} from "../../utils/dossierModeration";
import "./PlatformDossierReview.scss";

const DOC_LABELS = {
  kbis: "KBIS / extrait Kbis",
  id_recto: "Pièce d'identité recto",
  id_verso: "Pièce d'identité verso",
  address_proof: "Justificatif d'adresse",
};

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

const PlatformDossierReview = ({ tenant, audit, onUploadIdentity, uploadBusyId }) => {
  const [uploadError, setUploadError] = useState(null);
  const [compressingKind, setCompressingKind] = useState(null);
  const reviewFields = useMemo(
    () => (audit?.items || []).filter((item) => !String(item.key).startsWith("doc_")),
    [audit]
  );

  const documents = Array.isArray(tenant.documents) ? tenant.documents : [];
  const documentsByKind = useMemo(
    () => Object.fromEntries(documents.map((item) => [item.kind, item])),
    [documents]
  );
  const extraDocuments = documents.filter(
    (document) => !REQUIRED_DOC_SLOTS.some((slot) => slot.kind === document.kind)
  );

  const handleIdentityPick = async (kind, event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !onUploadIdentity) return;
    setUploadError(null);
    setCompressingKind(kind);
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
        Les champs manquants et ceux qui ne correspondent pas restent visibles.
        Cliquez une ligne pour ouvrir l&apos;input à corriger, puis comparez avec
        les pièces.
      </p>
      <dl className="pdr-grid">
        {reviewFields.map((item) => (
          <div
            key={item.key}
            className={[
              item.key === "phoneNumberUsage" ? "pdr-wide" : "",
              item.status === "missing" ? "pdr-field-missing" : "",
              item.status === "mismatch" ? "pdr-field-mismatch" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <dt>{item.label}</dt>
            <dd>
              <button type="button" onClick={() => scrollToDossierField(item.key)}>
                {item.value ? item.value : "—"}
              </button>
              {item.status === "missing" ? (
                <span className="pdr-flag">Manquant</span>
              ) : null}
              {item.status === "mismatch" ? (
                <span className="pdr-flag">
                  Ne correspond pas{item.reason ? ` · ${item.reason}` : ""}
                </span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>

      <div className="pdr-id">
        <h4>Pièces à contrôler</h4>
        <p className="pdr-intro">
          Recto, verso et justificatif d&apos;adresse. Chaque photo est compressée
          en WebP puis enregistrée en base.
        </p>
        <div className="pdr-id-slots">
          {REQUIRED_DOC_SLOTS.map((slot) => {
            const current = documentsByKind[slot.kind];
            const issue = audit?.byKey?.[slot.key];
            const busy =
              compressingKind === slot.kind ||
              uploadBusyId === `${tenant.id}:${slot.kind}`;
            const missing = issue?.status === "missing";
            return (
              <label
                key={slot.kind}
                className={missing ? "pdr-id-slot pdr-id-slot-missing" : "pdr-id-slot"}
                id={`pte-field-${slot.key}`}
              >
                <span>{slot.label}</span>
                {current ? (
                  <em>
                    {formatBytes(current.byteSize)} · {current.mimeType || "fichier"}
                  </em>
                ) : (
                  <em>{missing ? "Pièce manquante" : "Aucune photo"}</em>
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

      <div className="pdr-docs">
        {REQUIRED_DOC_SLOTS.map((slot) => {
          const document = documentsByKind[slot.kind];
          if (document) {
            return (
              <DocumentPreview
                key={`${document.kind}-${document.uploadedAt || document.sha256 || ""}`}
                tenantId={tenant.id}
                document={document}
              />
            );
          }
          return (
            <article
              key={slot.kind}
              className="pdr-doc pdr-doc-missing"
              id={`pte-doc-${slot.key}`}
            >
              <header className="pdr-doc-head">
                <h4>{slot.label}</h4>
                <p>Pièce manquante — rien à comparer pour le moment.</p>
              </header>
            </article>
          );
        })}
        {extraDocuments.map((document) => (
          <DocumentPreview
            key={`${document.kind}-${document.uploadedAt || document.sha256 || ""}`}
            tenantId={tenant.id}
            document={document}
          />
        ))}
      </div>
    </section>
  );
};

export default PlatformDossierReview;

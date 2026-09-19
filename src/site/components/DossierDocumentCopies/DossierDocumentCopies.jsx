import React from "react";
import { useDossierDocumentPreview } from "../../hooks/useDossierDocumentPreview";
import {
  dossierCopySlots,
  formatDocumentBytes,
  formatDocumentDate,
} from "../../utils/dossierDocumentCopies";
import "./DossierDocumentCopies.scss";

function DocumentCopy({ slot }) {
  const { preview, error } = useDossierDocumentPreview(slot.kind);
  const mimeType = preview?.mimeType || slot.document.mimeType || "";
  const isImage = mimeType.startsWith("image/");
  const isPdf = mimeType.includes("pdf");
  const uploadedAt = formatDocumentDate(slot.document.uploadedAt);
  const sizeLabel = formatDocumentBytes(slot.document.byteSize);

  return (
    <article className="dossier-document-copy">
      <header className="dossier-document-copy-head">
        <h3>{slot.label}</h3>
        <p>
          {sizeLabel}
          {uploadedAt ? ` · ${uploadedAt}` : ""}
        </p>
      </header>
      {error ? (
        <p className="dossier-document-copy-error" role="alert">
          {error}
        </p>
      ) : null}
      {!error && !preview ? (
        <p className="dossier-document-copy-status">Chargement de la copie...</p>
      ) : null}
      {preview && isImage ? (
        <img className="dossier-document-copy-image" src={preview.url} alt={slot.label} />
      ) : null}
      {preview && isPdf ? (
        <iframe className="dossier-document-copy-frame" title={slot.label} src={preview.url} />
      ) : null}
      {preview && !isImage && !isPdf ? (
        <p className="dossier-document-copy-status">Aperçu indisponible pour ce format.</p>
      ) : null}
      {preview ? (
        <a className="dossier-document-copy-link" href={preview.url} download={slot.kind}>
          Ouvrir / télécharger la copie
        </a>
      ) : null}
    </article>
  );
}

const DossierDocumentCopies = ({ documents }) => {
  const slots = dossierCopySlots(documents);
  if (!slots.length) return null;

  return (
    <section className="dossier-document-copies" aria-label="Copies des pièces transmises">
      <h2 className="dossier-document-copies-title">Copies transmises</h2>
      <p className="dossier-document-copies-intro">
        Voici les pièces déjà jointes au serveur pour cet établissement.
      </p>
      <div className="dossier-document-copies-list">
        {slots.map((slot) => (
          <DocumentCopy key={slot.kind} slot={slot} />
        ))}
      </div>
    </section>
  );
};

export default DossierDocumentCopies;

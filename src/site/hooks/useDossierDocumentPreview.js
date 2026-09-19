import { useEffect, useState } from "react";
import { fetchWebsiteDocumentBlob } from "../services/authService";

export function useDossierDocumentPreview(kind) {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!kind) return undefined;
    let revoked = false;
    let objectUrl = null;
    setPreview(null);
    setError(null);
    fetchWebsiteDocumentBlob(kind)
      .then(({ blob, mimeType }) => {
        objectUrl = URL.createObjectURL(blob);
        if (revoked) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setPreview({ url: objectUrl, mimeType });
      })
      .catch((err) => {
        if (!revoked) setError(err.message || "Pièce indisponible");
      });
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [kind]);

  return { preview, error };
}

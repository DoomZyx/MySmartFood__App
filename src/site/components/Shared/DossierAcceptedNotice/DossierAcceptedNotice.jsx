import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import OnboardingNoticeModal from "../OnboardingNoticeModal/OnboardingNoticeModal";
import { useAuth } from "../../../hooks/useAuth";
import { ackDossierNoticeApi } from "../../../services/authService";
import { shouldShowDossierAcceptedNotice } from "../../../utils/dossierAcceptedNotice";
import { dashboardHomeHref } from "../../../utils/dashboardPath";

export default function DossierAcceptedNotice() {
  const { user, setAuth } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const open = shouldShowDossierAcceptedNotice(user);

  const dismiss = async ({ goDashboard = false } = {}) => {
    if (busy) return;
    setBusy(true);
    try {
      const next = await ackDossierNoticeApi();
      if (next) setAuth(next);
    } catch {
      if (user) setAuth({ ...user, dossierNoticePending: false });
    } finally {
      setBusy(false);
    }
    if (goDashboard) {
      window.location.assign(dashboardHomeHref());
      return;
    }
    navigate("/mon-espace");
  };

  return (
    <OnboardingNoticeModal
      isOpen={open}
      title="Votre dossier a été validé"
      confirmLabel="Ouvrir le tableau de bord"
      cancelLabel="Plus tard"
      busy={busy}
      onCancel={() => dismiss({ goDashboard: false })}
      onConfirm={() => dismiss({ goDashboard: true })}
    >
      <p>
        Bonne nouvelle : votre établissement a été accepté. Vous pouvez ouvrir
        le tableau de bord, les commandes et les réservations.
      </p>
      <p>Un e-mail de confirmation a aussi été envoyé à {user?.email}.</p>
    </OnboardingNoticeModal>
  );
}

export function shouldShowDossierAcceptedNotice(user) {
  return Boolean(user?.dossierNoticePending);
}

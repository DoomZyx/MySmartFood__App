/**
 * Utilitaires pour le service en cours (midi/soir) selon les horaires d'ouverture.
 */

const JOURS_FR = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/**
 * Retourne le service en cours (midi ou soir) selon l'heure et les horaires du jour.
 * Si hors créneau ou jour fermé, retourne null.
 * @param {Object} horairesOuverture - horaires par jour (lundi, mardi, ...)
 * @param {Date} now - date/heure de référence
 * @returns {{ service: 'midi'|'soir', start: number, end: number }|null}
 */
export function getCurrentService(horairesOuverture, now) {
  if (!horairesOuverture) return null;
  const jour = JOURS_FR[now.getDay()];
  const horaire = horairesOuverture[jour];
  if (!horaire || horaire.ouvert === false) return null;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  if (horaire.midi?.ouverture && horaire.midi?.fermeture) {
    const [moH, moM] = horaire.midi.ouverture.split(":").map(Number);
    const [mfH, mfM] = horaire.midi.fermeture.split(":").map(Number);
    const midiStart = moH * 60 + moM;
    const midiEnd = mfH * 60 + mfM;
    if (nowMinutes >= midiStart && nowMinutes <= midiEnd) return { service: "midi", start: midiStart, end: midiEnd };
  }

  if (horaire.soir?.ouverture && horaire.soir?.fermeture) {
    const [soH, soM] = horaire.soir.ouverture.split(":").map(Number);
    const [sfH, sfM] = horaire.soir.fermeture.split(":").map(Number);
    const soirStart = soH * 60 + soM;
    const soirEnd = sfH * 60 + sfM;
    if (nowMinutes >= soirStart && nowMinutes <= soirEnd) return { service: "soir", start: soirStart, end: soirEnd };
  }

  return null;
}

/**
 * Filtre les éléments dont le champ heure (HH:mm) tombe dans le créneau du service.
 * @param {Array} items - liste d'objets avec une propriété heure
 * @param {{ start: number, end: number }|null} currentService - service en cours (start/end en minutes)
 * @returns {Array}
 */
export function filterItemsByCurrentService(items, currentService) {
  if (!currentService || !Array.isArray(items)) return items;
  const { start, end } = currentService;
  return items.filter((item) => {
    const [h, m] = (item.heure || "").split(":").map(Number);
    if (Number.isNaN(h)) return false;
    const minutes = h * 60 + m;
    return minutes >= start && minutes <= end;
  });
}

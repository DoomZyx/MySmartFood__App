const DAYS_FR = [
  "dimanche",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
];

const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export function isHhmm(value) {
  return typeof value === "string" && HHMM.test(value.trim());
}

export function normalizeHhmm(raw) {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim().toLowerCase();
  const matchColon = s.match(/^(\d{1,2}):(\d{2})$/);
  if (matchColon) {
    const h = Number(matchColon[1]);
    const m = Number(matchColon[2]);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }
  const matchH = s.match(/^(\d{1,2})h(\d{0,2})?$/);
  if (matchH) {
    const h = Number(matchH[1]);
    const m = matchH[2] ? Number(matchH[2]) : 0;
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }
  return null;
}

export function toYmd(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    if (typeof value.toISOString === "function") {
      const iso = value.toISOString().slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
    }
    return `${y}-${m}-${d}`;
  }
  const raw = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export function zonedTimeToUtc(ymd, hhmm, timeZone = "Europe/Paris") {
  const [year, month, day] = ymd.split("-").map(Number);
  const [hour, minute] = hhmm.split(":").map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const locale = new Date(utcGuess).toLocaleString("en-US", { timeZone });
  const asLocal = new Date(locale);
  const offset = asLocal.getTime() - utcGuess;
  return new Date(utcGuess - offset);
}

function partMap(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(date);
  const map = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  return map;
}

export function splitInTimeZone(date, timeZone = "Europe/Paris") {
  const instant = date instanceof Date ? date : new Date(date);
  const map = partMap(instant, timeZone);
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    heure: `${map.hour}:${map.minute}`,
  };
}

export function weekdayIndexFromYmd(ymd, timeZone = "Europe/Paris") {
  const utc = zonedTimeToUtc(ymd, "12:00", timeZone);
  const map = partMap(utc, timeZone);
  const weekday = new Date(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day)
  ).getDay();
  return weekday;
}

export function dayNameFr(index) {
  return DAYS_FR[index] || null;
}

export function minutesOf(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + m;
}

export function formatMinutes(total) {
  const normalized = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export { DAYS_FR };

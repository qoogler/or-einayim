// אור עיניים · small helpers: escaping, dates (incl. Hebrew calendar), gender, images
import { PEOPLE } from './content.js';

// ---------- text ----------
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ESC[ch]);
export const nl2br = (s) => esc(s).replace(/\n/g, '<br>');
export const clip = (s, n) => {
  const v = String(s ?? '').trim();
  return v.length > n ? v.slice(0, n - 1).trimEnd() + '…' : v;
};
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

// ---------- gender-aware context ----------
export const other = (p) => (p === 'orel' ? 'yiska' : 'orel');
export function ctxFor(person) {
  const me = person || 'orel';
  const partner = other(me);
  return {
    me, partner,
    meName: PEOPLE[me].name,
    partnerName: PEOPLE[partner].name,
    g: (m, f) => (PEOPLE[me].g === 'm' ? m : f),
    pg: (m, f) => (PEOPLE[partner].g === 'm' ? m : f),
  };
}
// verb/adjective by a given person's gender
export const byG = (person, m, f) => (PEOPLE[person]?.g === 'f' ? f : m);
export const nameOf = (person) => PEOPLE[person]?.name ?? '';

// ---------- dates (local calendar days as YYYY-MM-DD) ----------
const pad = (n) => String(n).padStart(2, '0');
export const dateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayStr = () => dateStr(new Date());
export function parseDate(s) {
  if (!s) return null;
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0); // noon avoids DST edges
}
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export function daysBetween(a, b) {
  const da = typeof a === 'string' ? parseDate(a) : a;
  const db = typeof b === 'string' ? parseDate(b) : b;
  if (!da || !db) return null;
  const ua = Date.UTC(da.getFullYear(), da.getMonth(), da.getDate());
  const ub = Date.UTC(db.getFullYear(), db.getMonth(), db.getDate());
  return Math.round((ub - ua) / 86400000);
}
export const daysFromToday = (s) => daysBetween(new Date(), s);

// Israeli week: Sunday to Saturday
export function weekStart(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  x.setDate(x.getDate() - x.getDay());
  return dateStr(x);
}
export const inWeek = (s, ws = weekStart()) => {
  if (!s) return false;
  const n = daysBetween(ws, String(s).slice(0, 10));
  return n !== null && n >= 0 && n < 7;
};
export const localDay = (iso) => (iso ? dateStr(new Date(iso)) : '');

const fmtShort = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short' });
const fmtShortY = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtLong = new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtMonth = new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' });
const fmtWeekday = new Intl.DateTimeFormat('he-IL', { weekday: 'long' });
const fmtTime = new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit' });

export function fmtDate(s, withYear) {
  const d = typeof s === 'string' ? parseDate(s) : s;
  if (!d) return '';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return (withYear || !sameYear ? fmtShortY : fmtShort).format(d);
}
export const fmtDateLong = (s) => { const d = typeof s === 'string' ? parseDate(s) : s; return d ? fmtLong.format(d) : ''; };
export const fmtMonthYear = (s) => { const d = typeof s === 'string' ? parseDate(s) : s; return d ? fmtMonth.format(d) : ''; };
export const fmtWeekdayName = (d) => fmtWeekday.format(d);
export const fmtClock = (iso) => (iso ? fmtTime.format(new Date(iso)) : '');

// Hebrew calendar via Intl (no library)
let hebFmt, hebParts;
try {
  hebFmt = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { day: 'numeric', month: 'long', year: 'numeric' });
  hebParts = new Intl.DateTimeFormat('en-u-ca-hebrew', { day: 'numeric', month: 'long', year: 'numeric' });
} catch (_) { /* very old browsers: Hebrew dates simply hidden */ }

// Hebrew numerals: 22 -> כ״ב, 5787 -> תשפ״ז
export function gematria(num) {
  let n = Number(num) % 1000;
  if (!n) return '';
  let s = '';
  for (const [v, ch] of [[400, 'ת'], [300, 'ש'], [200, 'ר'], [100, 'ק']]) while (n >= v) { s += ch; n -= v; }
  if (n === 15) s += 'טו';
  else if (n === 16) s += 'טז';
  else {
    for (const [v, ch] of [[90, 'צ'], [80, 'פ'], [70, 'ע'], [60, 'ס'], [50, 'נ'], [40, 'מ'], [30, 'ל'], [20, 'כ'], [10, 'י']]) if (n >= v) { s += ch; n -= v; break; }
    for (const [v, ch] of [[9, 'ט'], [8, 'ח'], [7, 'ז'], [6, 'ו'], [5, 'ה'], [4, 'ד'], [3, 'ג'], [2, 'ב'], [1, 'א']]) if (n >= v) { s += ch; n -= v; break; }
  }
  return s.length === 1 ? `${s}׳` : `${s.slice(0, -1)}״${s.slice(-1)}`;
}
const HEB_MONTHS = {
  Tishri: 'תשרי', Heshvan: 'חשוון', Kislev: 'כסלו', Tevet: 'טבת', Shevat: 'שבט', 'Adar I': 'אדר א׳', 'Adar II': 'אדר ב׳',
  Adar: 'אדר', Nisan: 'ניסן', Iyar: 'אייר', Sivan: 'סיוון', Tamuz: 'תמוז', Av: 'אב', Elul: 'אלול',
};
export function hebDate(d = new Date(), withYear = true) {
  const x = typeof d === 'string' ? parseDate(d) : d;
  if (!x) return '';
  const h = hebInfo(x);
  if (h && HEB_MONTHS[h.month]) {
    return `${gematria(h.day)} ב${HEB_MONTHS[h.month]}${withYear ? ` ${gematria(h.year)}` : ''}`;
  }
  return hebFmt ? hebFmt.format(x) : '';
}
export const hebDayMonth = (d) => hebDate(d, false);
export function hebInfo(d) {
  if (!hebParts) return null;
  const x = typeof d === 'string' ? parseDate(d) : d;
  const parts = hebParts.formatToParts(x);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return { month: get('month'), day: Number(get('day')), year: Number(get('year')) };
}

// Plural-aware Hebrew durations
export function nDays(n) {
  n = Math.abs(n);
  if (n === 1) return 'יום אחד';
  if (n === 2) return 'יומיים';
  return `${n} ימים`;
}
export function nWeeks(n) { if (n === 1) return 'שבוע'; if (n === 2) return 'שבועיים'; return `${n} שבועות`; }
export function nMonths(n) { if (n === 1) return 'חודש'; if (n === 2) return 'חודשיים'; return `${n} חודשים`; }
export function nYears(n) { if (n === 1) return 'שנה'; if (n === 2) return 'שנתיים'; return `${n} שנים`; }

export function relDay(s) {
  const n = daysFromToday(s);
  if (n === null) return '';
  if (n === 0) return 'היום';
  if (n === 1) return 'מחר';
  if (n === 2) return 'מחרתיים';
  if (n === -1) return 'אתמול';
  if (n === -2) return 'שלשום';
  if (n > 0) return n < 14 ? `בעוד ${nDays(n)}` : n < 60 ? `בעוד ${nWeeks(Math.round(n / 7))}` : `בעוד ${nMonths(Math.round(n / 30))}`;
  const a = -n;
  return a < 14 ? `לפני ${nDays(a)}` : a < 60 ? `לפני ${nWeeks(Math.round(a / 7))}` : fmtDate(s);
}

export function timeAgo(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'עכשיו';
  const m = Math.round(s / 60);
  if (m < 60) return m === 1 ? 'לפני דקה' : `לפני ${m} דקות`;
  const h = Math.round(m / 60);
  const day = localDay(iso);
  if (day === todayStr()) return h === 1 ? 'לפני שעה' : h === 2 ? 'לפני שעתיים' : `לפני ${h} שעות`;
  return relDay(day);
}

// Together since: "יום 47" style plus a friendly duration
export function togetherSpan(startStr) {
  const n = daysBetween(startStr, todayStr());
  if (n === null || n < 0) return null;
  const day = n + 1;
  const start = parseDate(startStr);
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  let span;
  if (months < 1) span = nDays(day);
  else if (years < 1) span = nMonths(months);
  else span = rest ? `${nYears(years)} ו${nMonths(rest)}` : nYears(years);
  return { day, months, years, span };
}

// ---------- misc ----------
export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
// Deterministic shuffle (same order on both phones)
export function seededShuffle(arr, seed) {
  const a = arr.slice();
  let x = seed || 1;
  const rnd = () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 1e9) / 1e9; };
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export const sum = (arr) => arr.reduce((a, b) => a + (Number(b) || 0), 0);
export function money(n, cur = '₪') {
  const v = Number(n) || 0;
  return `${v.toLocaleString('he-IL', { maximumFractionDigits: 0 })} ${cur}`;
}

// Resize a photo before upload (keeps the shared storage light)
export async function resizeImage(file, max = 1600, quality = 0.84) {
  let src, w, h;
  try {
    src = await createImageBitmap(file, { imageOrientation: 'from-image' });
    w = src.width; h = src.height;
  } catch (_) {
    src = await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = URL.createObjectURL(file);
    });
    w = src.naturalWidth; h = src.naturalHeight;
  }
  const scale = Math.min(1, max / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = cw; canvas.height = ch;
  canvas.getContext('2d').drawImage(src, 0, 0, cw, ch);
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
  return { blob, w: cw, h: ch };
}

export function safeLocal(key, value) {
  try {
    if (value === undefined) return JSON.parse(localStorage.getItem(key) ?? 'null');
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch (_) { return null; }
  return value;
}

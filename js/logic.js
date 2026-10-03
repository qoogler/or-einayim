// אור עיניים · derived state: today's question, the week, what's coming, what's waiting
import { QUESTIONS, STAGES, HOLIDAYS, DATE_IDEAS } from './content.js';
import { S, items, itemsOf, isMine, settings, myPerson, partnerPerson, authorOf } from './store.js';
import {
  todayStr, parseDate, dateStr, addDays, daysBetween, daysFromToday, weekStart, inWeek, localDay,
  hashStr, seededShuffle, hebInfo, togetherSpan, nameOf,
} from './util.js';

export const stageIndex = () => Math.max(0, STAGES.findIndex((s) => s.key === settings().stage));
export const currentStage = () => STAGES[stageIndex()];
export const startDate = () => settings().first_date || settings().met_date || '';

// ---------- the daily question (same for both of us) ----------
export function dailyQuestion(day = todayStr()) {
  const st = settings();
  if (st.q_custom && st.q_custom.date === day && st.q_custom.text) {
    return { id: `ai-${day}`, t: st.q_custom.text, why: st.q_custom.why || '', ai: true };
  }
  const idx = stageIndex();
  let pool = QUESTIONS.filter((q) => q.st <= idx);
  if (idx === 0) pool = pool.filter((q) => q.d <= 2);
  const order = seededShuffle(pool, hashStr(st.room || 'or-einayim'));
  const dayNum = Math.floor(Date.UTC(...day.split('-').map((n, i) => (i === 1 ? Number(n) - 1 : Number(n)))) / 86400000);
  return order[dayNum % order.length];
}

export function answersFor(day = todayStr()) {
  const list = items('answer').filter((a) => a.data?.date === day);
  const me = list.find((a) => isMine(a)) || null;
  const partner = list.find((a) => !isMine(a)) || null;
  return { me, partner };
}

// ---------- this week ----------
export function weekStats() {
  const ws = weekStart();
  const dates = items('date').filter((d) => inWeek(d.event_date, ws));
  const thanks = items('thanks').filter((t) => inWeek(localDay(t.created_at), ws));
  const byDay = {};
  items('answer').filter((a) => inWeek(a.data?.date, ws)).forEach((a) => {
    byDay[a.data.date] = byDay[a.data.date] || new Set();
    byDay[a.data.date].add(authorOf(a));
  });
  const bothDays = Object.values(byDay).filter((set) => set.size >= 2).length;
  const anyDays = Object.keys(byDay).length;
  const talk = items('checkin').find((x) => x.data?.week === ws) || null;
  return {
    ws,
    date: { n: dates.length, target: 1, value: Math.min(1, dates.length) },
    thanks: { n: thanks.length, target: 7, value: Math.min(1, thanks.length / 7) },
    questions: { n: bothDays, any: anyDays, target: 4, value: Math.min(1, (bothDays + (anyDays - bothDays) * 0.5) / 4) },
    talk: { n: talk ? 1 : 0, target: 1, value: talk ? 1 : 0, item: talk },
  };
}

// ---------- what's next ----------
export function nextDate() {
  const today = todayStr();
  return items('date')
    .filter((d) => d.status !== 'done' && d.event_date && d.event_date >= today)
    .sort((a, b) => a.event_date.localeCompare(b.event_date))[0] || null;
}
export function datesToLog() {
  const today = todayStr();
  return items('date').filter((d) => d.status !== 'done' && d.event_date && d.event_date < today);
}

function nextYearly(mmdd, from = new Date()) {
  const [m, d] = mmdd.split('-').map(Number);
  let y = from.getFullYear();
  let cand = new Date(y, m - 1, d, 12);
  if (daysBetween(from, cand) < 0) cand = new Date(y + 1, m - 1, d, 12);
  return cand;
}

export function upcoming(horizon = 45) {
  const out = [];
  const today = new Date();
  const todayS = todayStr();
  // events
  items('event').forEach((e) => {
    const n = daysFromToday(e.event_date);
    if (n !== null && n >= 0 && n <= horizon) out.push({ date: e.event_date, title: e.title, icon: 'calendar', id: e.id, sub: e.data?.time || '' });
  });
  // birthdays
  Object.values(S.members).forEach((m) => {
    if (!m.birthday) return;
    const d = nextYearly(m.birthday.slice(5));
    const n = daysBetween(today, d);
    if (n <= horizon) {
      const p = m.person;
      out.push({ date: dateStr(d), title: p === myPerson() ? 'יום ההולדת שלך' : `יום ההולדת של ${nameOf(p)}`, icon: 'gift', tone: 'light' });
    }
  });
  // anniversaries
  const start = startDate();
  if (start) {
    const s = parseDate(start);
    const span = togetherSpan(start);
    // monthly in the first year
    if (span && span.months < 12) {
      for (let k = 1; k <= 12; k++) {
        const d = new Date(s.getFullYear(), s.getMonth() + k, s.getDate(), 12);
        const n = daysBetween(today, d);
        if (n >= 0 && n <= horizon) out.push({ date: dateStr(d), title: k === 12 ? 'שנה ביחד' : `${k === 1 ? 'חודש' : k === 2 ? 'חודשיים' : `${k} חודשים`} ביחד`, icon: 'sparkles', tone: 'light' });
      }
    }
    const yearly = nextYearly(start.slice(5));
    const yn = daysBetween(today, yearly);
    const years = yearly.getFullYear() - s.getFullYear();
    if (years >= 1 && yn <= horizon && !(span && span.months < 12)) {
      out.push({ date: dateStr(yearly), title: years === 1 ? 'שנה ביחד' : `${years} שנים ביחד`, icon: 'sparkles', tone: 'light' });
    }
    // Hebrew-date anniversary
    const hs = hebInfo(s);
    if (hs) {
      for (let i = 0; i <= horizon; i++) {
        const d = addDays(today, i);
        const h = hebInfo(d);
        if (h && h.month === hs.month && h.day === hs.day && h.year > hs.year) {
          const yrs = h.year - hs.year;
          out.push({ date: dateStr(d), title: `יום השנה העברי שלנו${yrs > 1 ? ` (${yrs})` : ''}`, icon: 'scroll-text', tone: 'light' });
          break;
        }
      }
    }
  }
  // holidays
  for (let i = 0; i <= Math.min(horizon, 60); i++) {
    const d = addDays(today, i);
    const h = hebInfo(d);
    if (!h) break;
    const hit = HOLIDAYS.find((x) => x.m === h.month && x.d === h.day);
    if (hit) out.push({ date: dateStr(d), title: hit.name, sub: hit.note || '', icon: 'flame', tone: 'muted' });
  }
  // savings deadlines
  items('saving').forEach((s) => {
    const n = daysFromToday(s.due_date);
    if (n !== null && n >= 0 && n <= 30) out.push({ date: s.due_date, title: `היעד: ${s.title}`, icon: 'piggy-bank', id: s.id });
  });
  return out.filter((x) => x.date >= todayS).sort((a, b) => a.date.localeCompare(b.date));
}

// ---------- waiting for me ----------
export function waiting() {
  const me = myPerson();
  const notes = itemsOf(['thanks', 'love', 'nudge']).filter((i) => !isMine(i) && !i.partner_seen_at && !i.data?.by)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const today = todayStr();
  const tasks = items('task').filter((t) => t.status !== 'done' && (t.for_person === me) && t.due_date && t.due_date <= today);
  const ws = weekStart();
  const talk = items('checkin').filter((x) => x.data?.week === ws || (x.data?.week && daysBetween(x.data.week, ws) <= 7))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
  const request = talk?.data?.asks?.[partnerPerson()] || '';
  const letter = items('letter').find((l) => l.data?.week === ws && !isMine(l) && !l.partner_seen_at) || null;
  return { notes, tasks, request, letter };
}

// ---------- remember? ----------
export function memoryOfDay() {
  const pool = itemsOf(['moment', 'milestone', 'date', 'photo'])
    .filter((i) => (i.kind !== 'date' || i.status === 'done'))
    .filter((i) => {
      const d = i.event_date || localDay(i.created_at);
      const n = daysFromToday(d);
      return n !== null && n <= -6;
    });
  if (!pool.length) return null;
  const sorted = pool.sort((a, b) => (a.id < b.id ? -1 : 1));
  return sorted[hashStr(todayStr()) % sorted.length];
}

// ---------- first steps ----------
export function questSteps(c) {
  const st = settings();
  return [
    { key: 'dates', done: !!st.first_date, label: 'התאריכים שלנו', act: 'onboard' },
    { key: 'thanks', done: items('thanks').some(isMine), label: 'תודה ראשונה', act: 'new', kind: 'thanks' },
    { key: 'answer', done: items('answer').some(isMine), label: 'שאלת היום', act: 'answer-q' },
    { key: 'date', done: items('date').length > 0, label: 'הדייט הבא', act: 'new', kind: 'date' },
    { key: 'dream', done: itemsOf(['place', 'trip', 'home', 'saving', 'wish']).length > 0, label: 'חלום ראשון', act: 'go', href: '#/dreams' },
    { key: 'partner', done: !!S.members[c.partner]?.joined_at, label: `${c.partnerName} ${c.pg('מצטרף', 'מצטרפת')}`, act: 'invite' },
  ];
}

// ---------- wishes, grouped ----------
export function wishGroups(c) {
  const all = items('wish');
  return {
    mine: all.filter((w) => w.visibility === 'shared' && w.for_person === c.me && w.status !== 'done'),
    partner: all.filter((w) => w.visibility === 'shared' && w.for_person === c.partner && w.status !== 'done'),
    hints: all.filter((w) => w.visibility === 'private' && w.status !== 'done'),
    both: all.filter((w) => w.visibility === 'shared' && w.for_person === 'both' && w.status !== 'done'),
    done: all.filter((w) => w.status === 'done'),
  };
}

// ---------- date ideas for now ----------
export function ideasForNow(n = 3, seed = todayStr()) {
  const month = new Date().getMonth() + 1;
  const done = new Set(items('date').map((d) => (d.title || '').trim()));
  const pool = DATE_IDEAS.filter((i) => (!i.when || i.when.includes(month)) && !done.has(i.t));
  return seededShuffle(pool, hashStr(seed)).slice(0, n);
}

// ---------- the year in moments (for the heatmap) ----------
export function momentsByDay(days = 7 * 26) {
  const map = {};
  const from = addDays(new Date(), -days);
  for (const it of S.items.values()) {
    if (['letter', 'nudge'].includes(it.kind)) continue;
    const d = ['date', 'moment', 'milestone', 'photo', 'event'].includes(it.kind) && it.event_date ? it.event_date : localDay(it.created_at);
    if (!d || parseDate(d) < from) continue;
    map[d] = (map[d] || 0) + 1;
  }
  return map;
}

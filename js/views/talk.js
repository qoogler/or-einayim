// אור עיניים · שיחת השבוע: a guided weekly conversation, one step at a time
import { icon } from '../icons.js';
import { WEEKLY } from '../content.js';
import { S, items, addItem, updateItem } from '../store.js';
import { esc, weekStart, todayStr, nameOf, byG } from '../util.js';
import { avatar, toast, burst, busy } from '../ui.js';
import { nextDate } from '../logic.js';

const KEY = 'oe-talk-draft';
const PEOPLE2 = ['orel', 'yiska'];
let T = load();

function load() {
  try { const v = JSON.parse(sessionStorage.getItem(KEY) || 'null'); if (v && v.week === weekStart()) return v; } catch (_) { /* fresh */ }
  return { week: weekStart(), step: -1, d: {} };
}
function save() { try { sessionStorage.setItem(KEY, JSON.stringify(T)); } catch (_) { /* private mode */ } }
function reset() { T = { week: weekStart(), step: -1, d: {} }; save(); }

const v = (k) => esc(T.d[k] ?? '');
const two = (key, label, ph = '', rows = 2) => `<div class="two">${PEOPLE2.map((p) => {
  const l = typeof label === 'function' ? label(p) : label;
  return `<div class="field"><label class="lbl" for="t-${key}-${p}">${avatar(p, { size: 'xs' })}${esc(nameOf(p))}${l ? ` · ${l}` : ''}</label>
  <textarea id="t-${key}-${p}" data-k="${key}_${p}" rows="${rows}" placeholder="${esc(ph)}">${v(`${key}_${p}`)}</textarea></div>`;
}).join('')}</div>`;

function stepBody(step) {
  switch (step.key) {
    case 'thanks':
      return `<p class="hint">אפשר רק לדבר. מה שנכתב כאן ייכנס גם לצנצנת התודות.</p>
        <div class="two">${PEOPLE2.map((p) => `<div class="field"><span class="lbl">${avatar(p, { size: 'xs' })}${esc(nameOf(p))} מודה ל${esc(nameOf(p === 'orel' ? 'yiska' : 'orel'))}</span>
          ${[0, 1, 2, 3, 4].map((i) => `<input type="text" id="t-th-${p}-${i}" data-k="th_${p}_${i}" value="${v(`th_${p}_${i}`)}" placeholder="${i + 1}.">`).join('')}</div>`).join('')}</div>`;
    case 'good':
      return two('good', 'רוצה לשמור', 'הרגע מהשבוע...');
    case 'hard':
      return `<div class="field"><label class="lbl" for="t-hard">הנושא</label><textarea id="t-hard" data-k="hard" rows="2" placeholder="נושא אחד, בלי האשמות">${v('hard')}</textarea></div>
        <label class="toggle"><input type="checkbox" data-k="understood" ${T.d.understood ? 'checked' : ''}><span class="toggle-ui" aria-hidden="true"></span><span>שנינו הרגשנו שהבינו אותנו</span></label>
        <div class="field"><label class="lbl" for="t-agreed">מה סיכמנו <span class="opt">(לא חובה)</span></label><textarea id="t-agreed" data-k="agreed" rows="2">${v('agreed')}</textarea></div>`;
    case 'growth': {
      const active = items('growth').filter((g) => g.status === 'active');
      if (!active.length) return `<p class="muted">עוד אין לנו מיקוד. אפשר לבחור אחד עכשיו, או לדלג.</p><button type="button" class="btn btn-quiet" data-act="new" data-kind="growth">${icon('sprout')}מיקוד חדש</button>`;
      return active.map((g) => {
        const next = (g.data?.steps || []).find((s) => !s.done);
        return `<div class="card growth-mini"><b>${esc(g.title)}</b>${next ? `<p class="meta">הצעד הבא: ${esc(next.text)}</p>` : ''}
          <div class="field"><label class="lbl" for="t-gr-${g.id}">איך התקדמנו?</label><textarea id="t-gr-${g.id}" data-k="gr_${g.id}" rows="2">${v(`gr_${g.id}`)}</textarea></div></div>`;
      }).join('');
    }
    case 'plan': {
      const nd = nextDate();
      if (nd) return `<div class="card"><p class="meta">כבר ביומן</p><b>${esc(nd.title)}</b><p class="meta">${esc(nd.event_date)}</p></div><p class="hint">אפשר לעבור לשלב הבא.</p>`;
      return `<div class="field"><label class="lbl" for="t-dt">מה עושים בדייט הבא?</label><input id="t-dt" type="text" data-k="date_title" value="${v('date_title')}" placeholder="למשל: זריחה בהרים"></div>
        <div class="two"><div class="field"><label class="lbl" for="t-dd">מתי</label><input id="t-dd" type="date" data-k="date_date" value="${v('date_date')}"></div>
        <div class="field"><label class="lbl" for="t-dtime">שעה</label><input id="t-dtime" type="time" data-k="date_time" value="${v('date_time')}"></div></div>`;
    }
    case 'ask':
      return two('ask', (p) => byG(p, 'מבקש', 'מבקשת'), 'דבר אחד קטן וספציפי');
    case 'close':
      return two('close', 'מחכה ל...', 'בשבוע הבא אני מחכה ל...');
    default:
      return '';
  }
}

export const talk = {
  html(r, c) {
    if (r.query?.new) reset();
    const steps = WEEKLY.steps;
    if (T.step === -1) {
      return `<div class="view view-page view-talk">
        <a class="back" href="#/us">${icon('chevron-right')}<span>אנחנו</span></a>
        <header class="page-head"><p class="eyebrow">פעם בשבוע</p><h1 class="page-title">${WEEKLY.title}</h1><p class="sec-sub">${WEEKLY.line}</p></header>
        <div class="card talk-intro"><p>${WEEKLY.setup}</p>
          <ol class="talk-map">${steps.map((s) => `<li>${esc(s.title)}</li>`).join('')}</ol>
          <button type="button" class="btn btn-block" data-act="talk-step" data-to="0">מתחילים</button></div>
      </div>`;
    }
    if (T.step >= steps.length) {
      return `<div class="view view-page view-talk"><div class="card talk-done">
        <h1 class="page-title">שבוע טוב</h1>
        <p>השיחה נשמרה. התודות נכנסו לצנצנת, והבקשות יחכו לכם בעמוד הבית.</p>
        <a class="btn btn-block" href="#/" data-act="talk-finish">לעמוד הבית</a></div></div>`;
    }
    const s = steps[T.step];
    const last = T.step === steps.length - 1;
    return `<div class="view view-page view-talk">
      <div class="talk-top"><button type="button" class="back" data-act="talk-step" data-to="${T.step - 1}">${icon('chevron-right')}<span>הקודם</span></button>
        <ol class="dots" aria-label="שלב ${T.step + 1} מתוך ${steps.length}">${steps.map((_, i) => `<li class="${i < T.step ? 'is-done' : i === T.step ? 'is-now' : ''}"></li>`).join('')}</ol></div>
      <header class="page-head"><p class="eyebrow">שלב ${T.step + 1} מתוך ${steps.length}</p><h1 class="page-title">${esc(s.title)}</h1><p class="talk-text">${esc(s.text)}</p></header>
      <form class="form talk-form" data-form="talk" novalidate>${stepBody(s)}
        <div class="form-actions">
          ${last ? `<button type="button" class="btn btn-block" data-act="talk-save">${icon('check')}לסיים ולשמור</button>`
            : `<button type="button" class="btn btn-block" data-act="talk-step" data-to="${T.step + 1}">הבא</button>`}
        </div>
      </form>
    </div>`;
  },
  mount(root) {
    root.querySelectorAll('[data-k]').forEach((el) => {
      const handler = () => { T.d[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value; save(); };
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
    });
  },
};

export function talkGo(to) {
  T.step = Math.max(-1, Math.min(WEEKLY.steps.length, Number(to)));
  save();
}

export async function talkSave(c, btn) {
  busy(btn, true, 'שומרים...');
  const d = T.d;
  const now = new Date().toISOString();
  try {
    const thanks = { orel: [], yiska: [] };
    PEOPLE2.forEach((p) => { for (let i = 0; i < 5; i++) { const t = (d[`th_${p}_${i}`] || '').trim(); if (t) thanks[p].push(t); } });
    const good = PEOPLE2.map((p) => (d[`good_${p}`] ? `${nameOf(p)}: ${d[`good_${p}`].trim()}` : '')).filter(Boolean).join(' · ');
    const growthNotes = Object.entries(d).filter(([k, val]) => k.startsWith('gr_') && String(val).trim()).map(([k, val]) => ({ id: k.slice(3), note: String(val).trim() }));
    await addItem({
      kind: 'checkin',
      title: `שיחת השבוע`,
      data: {
        week: T.week,
        thanks,
        good,
        hard: (d.hard || '').trim() || null,
        understood: !!d.understood,
        agreed: (d.agreed || '').trim() || null,
        asks: { orel: (d.ask_orel || '').trim(), yiska: (d.ask_yiska || '').trim() },
        close: { orel: (d.close_orel || '').trim(), yiska: (d.close_yiska || '').trim() },
        growth: growthNotes,
      },
    });
    for (const p of PEOPLE2) {
      for (const t of thanks[p]) {
        await addItem({ kind: 'thanks', body: t, for_person: p === 'orel' ? 'yiska' : 'orel', partner_seen_at: now, data: { by: p, from: 'weekly' } });
      }
    }
    for (const g of growthNotes) {
      const it = S.items.get(g.id);
      if (it) await updateItem(g.id, { data: { checkins: [...(it.data?.checkins || []), { at: now, note: g.note, week: T.week }] } });
    }
    if (d.date_title && d.date_date) {
      await addItem({ kind: 'date', title: d.date_title.trim(), event_date: d.date_date, status: 'planned', data: { time: d.date_time || null, planner: 'both' } });
    }
    burst(btn);
    T.step = WEEKLY.steps.length;
    save();
    return true;
  } catch (e) {
    console.error(e);
    busy(btn, false);
    toast('לא הצלחנו לשמור. כדאי לנסות שוב', { tone: 'warn' });
    return false;
  }
}

export function talkFinish() { reset(); }

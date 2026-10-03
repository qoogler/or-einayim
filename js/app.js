// אור עיניים · app shell, router and actions
import { icon } from './icons.js';
import {
  S, sb, onChange, getSession, cacheLoad, loadAll, subscribe, resync, getItem, addItem, updateItem, settings,
  hydratePhotos, signOut,
} from './store.js';
import { ctxFor, todayStr, safeLocal, addDays, dateStr, parseDate } from './util.js';
import { closeSheet, toast, burst, avatar, busy } from './ui.js';
import { WORLDS, KINDS } from './kinds.js';
import { home } from './views/home.js';
import { us, story, dreams, together } from './views/worlds.js';
import { list, album, answers, deck, letter, letters, timelinePage } from './views/pages.js';
import { talk, talkGo, talkSave, talkFinish } from './views/talk.js';
import { settingsView, applyTheme, aiOff, downloadBackup, doSignOut } from './views/settings.js';
import { renderAuth, brandMark } from './views/auth.js';
import {
  openEditor, openItem, openQuickAdd, pickPhotos, openAnswer, customQuestion, openOnboarding, openInvite,
  openDateIdeas, openTalkPrep, openSavingAdd, sendNudge, openOrWriteLetter, openWelcome,
} from './sheets.js';

const VIEWS = {
  home, us, story, dreams, together, list, album, answers, deck, letter, letters,
  timeline: timelinePage, talk, settings: settingsView,
};
const TITLES = {
  home: 'היום', us: 'אנחנו', story: 'הסיפור', dreams: 'חלומות', together: 'יחד', album: 'האלבום', answers: 'שאלות ותשובות',
  deck: 'חפיסת שאלות', letter: 'מבט מהצד', letters: 'מכתבים', timeline: 'הסיפור שלנו', talk: 'שיחת השבוע', settings: 'הגדרות',
};
const WORLD_OF_ROUTE = { home: 'home', us: 'us', answers: 'us', deck: 'us', talk: 'us', story: 'story', album: 'story', timeline: 'story', dreams: 'dreams', together: 'together', letter: 'home', letters: 'home' };

const app = document.getElementById('app');
let c = ctxFor('orel');

// ---------- routing ----------
function parseRoute() {
  const h = location.hash || '#/';
  const pathPart = h.slice(1).split('#')[0];
  const [path, qs] = pathPart.split('?');
  const parts = path.split('/').filter(Boolean);
  const name = VIEWS[parts[0]] ? parts[0] : 'home';
  return {
    name,
    arg: parts[1] ? decodeURIComponent(parts[1]) : null,
    query: Object.fromEntries(new URLSearchParams(qs || '')),
    key: pathPart || '/',
  };
}

// ---------- shell ----------
function mountShell() {
  app.innerHTML = `<div class="shell">
    <a class="skip" href="#view">דילוג לתוכן</a>
    <header class="topbar">
      <a href="#/" class="brand" aria-label="אור עיניים, עמוד הבית">${brandMark(30)}<span class="brand-name">אור עיניים</span></a>
      <div class="top-actions">
        <button type="button" class="nudge-btn" data-act="nudge" id="nudge-btn"></button>
        <a href="#/settings" class="icon-btn" aria-label="הגדרות">${icon('settings')}</a>
      </div>
    </header>
    <nav class="tabs" aria-label="ניווט ראשי">${WORLDS.map((w) => `<a href="${w.hash}" class="tab" data-world="${w.key}">${icon(w.icon)}<span>${w.name}</span></a>`).join('')}</nav>
    <main id="view" tabindex="-1"></main>
    <button type="button" class="fab" data-act="quick-add" aria-label="להוסיף משהו">${icon('plus')}</button>
  </div>`;
}

function updateTop() {
  const b = document.getElementById('nudge-btn');
  if (!b || !S.me) return;
  const joined = !!S.members[c.partner]?.joined_at;
  const online = !!S.online[c.partner];
  b.innerHTML = `${avatar(c.partner, { size: 'sm', online })}<span class="nudge-label">${joined ? `${c.g('חושב', 'חושבת')} ${c.pg('עליו', 'עליה')}` : `להזמין את ${c.partnerName}`}</span>`;
  b.setAttribute('aria-label', joined ? `לשלוח ל${c.partnerName} שאני ${c.g('חושב', 'חושבת')} ${c.pg('עליו', 'עליה')}${online ? `. ${c.partnerName} כאן עכשיו` : ''}` : `להזמין את ${c.partnerName}`);
  b.classList.toggle('is-online', online);
}

function updateTabs(r) {
  const world = r.name === 'list' ? (KINDS[r.arg]?.world || '') : WORLD_OF_ROUTE[r.name] || '';
  document.querySelectorAll('.tab').forEach((t) => {
    const on = t.dataset.world === world;
    t.classList.toggle('is-on', on);
    if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
  });
}

// keep what someone is typing when live data re-renders the page
function captureInputs(root) {
  const st = { values: {}, focus: null, sel: null };
  root.querySelectorAll('input[id], textarea[id], select[id]').forEach((el) => {
    if (el.type === 'file' || el.type === 'password') return;
    st.values[el.id] = el.type === 'checkbox' || el.type === 'radio' ? el.checked : el.value;
  });
  const a = document.activeElement;
  if (a && root.contains(a) && a.id) {
    st.focus = a.id;
    try { st.sel = [a.selectionStart, a.selectionEnd]; } catch (_) { /* not a text field */ }
  }
  return st;
}
function restoreInputs(root, st) {
  for (const [id, v] of Object.entries(st.values)) {
    const el = root.querySelector(`#${CSS.escape(id)}`);
    if (!el) continue;
    if (typeof v === 'boolean') el.checked = v;
    else if (v !== '' && el.value !== v) el.value = v;
  }
  if (st.focus) {
    const el = root.querySelector(`#${CSS.escape(st.focus)}`);
    if (el) {
      el.focus({ preventScroll: true });
      if (st.sel && st.sel[0] != null) { try { el.setSelectionRange(st.sel[0], st.sel[1]); } catch (_) { /* ignore */ } }
    }
  }
}

let lastKey = '';
function render() {
  if (!S.me) return;
  c = ctxFor(S.me.person);
  const main = document.getElementById('view');
  if (!main) return;
  const r = parseRoute();
  const same = r.key === lastKey;
  const st = same ? captureInputs(main) : null;
  const view = VIEWS[r.name];
  main.innerHTML = view.html(r, c);
  if (st) restoreInputs(main, st);
  main.querySelectorAll('article[data-act], section[data-act], li[data-act]').forEach((el) => {
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
  });
  view.mount?.(main, r, c);
  hydratePhotos(main);
  updateTabs(r);
  updateTop();
  if (!same) {
    lastKey = r.key;
    window.scrollTo(0, 0);
    document.title = `${TITLES[r.name] || ''} · אור עיניים`;
  }
}
let raf = 0;
const scheduleRender = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; render(); }); };

// ---------- actions ----------
function presetFrom(el) {
  const kind = el.dataset.kind;
  const p = { data: {} };
  if (el.dataset.title) {
    if (['thanks', 'love', 'moment'].includes(kind)) p.body = el.dataset.title;
    else p.title = el.dataset.title;
  }
  if (el.dataset.status) p.status = el.dataset.status;
  if (el.dataset.private) p.visibility = 'private';
  if (el.dataset.for) p.for_person = el.dataset.for;
  if (kind === 'date' && el.dataset.status === 'done') p.event_date = todayStr();
  return p;
}

async function quickSuggest(el) {
  const kind = el.dataset.kind;
  const value = el.dataset.value;
  const def = KINDS[kind];
  if (!def) return;
  const defaults = typeof def.defaults === 'function' ? def.defaults(c) : (def.defaults || {});
  const row = { kind, ...defaults, data: { ...(defaults.data || {}) } };
  if (['thanks', 'love', 'moment'].includes(kind)) row.body = value; else row.title = value;
  if (el.dataset.area) row.data.area = el.dataset.area;
  if (el.dataset.type) row.data.type = el.dataset.type;
  if (kind === 'milestone' && !row.event_date) row.event_date = todayStr();
  try {
    await addItem(row);
    toast(`נוסף: ${value.length > 40 ? `${value.slice(0, 40)}…` : value}`);
  } catch (_) { toast('לא הצלחנו להוסיף', { tone: 'warn' }); }
}

function nextDue(due, repeat) {
  const base = parseDate(due) || new Date();
  const from = base < new Date() ? new Date() : base;
  if (repeat === 'daily') return dateStr(addDays(from, 1));
  if (repeat === 'weekly') return dateStr(addDays(from, 7));
  if (repeat === 'monthly') { const d = new Date(from); d.setMonth(d.getMonth() + 1); return dateStr(d); }
  return null;
}

const ACT = {
  'sheet-close': () => closeSheet(),
  open: (el) => openItem(getItem(el.dataset.id), c),
  new: (el) => { const kind = el.dataset.kind; const p = presetFrom(el); closeSheet(() => openEditor(kind, c, null, p)); },
  'quick-add': () => openQuickAdd(c),
  suggest: (el) => quickSuggest(el),
  'talk-done': async (el) => {
    try { await updateItem(el.dataset.id, { status: 'done', done_at: new Date().toISOString() }); toast('סומן. אפשר להוסיף בכרטיס מה יצא מהשיחה'); } catch (_) { toast('לא נשמר', { tone: 'warn' }); }
  },
  'growth-step': async (el) => {
    const it = getItem(el.dataset.id);
    const steps = [...(it?.data?.steps || [])];
    const i = steps.findIndex((s) => !s.done);
    if (i < 0) return;
    steps[i] = { ...steps[i], done: true, at: new Date().toISOString() };
    try {
      await updateItem(it.id, { data: { steps } });
      burst(el);
      toast(steps.every((s) => s.done) ? 'כל הצעדים הושלמו. אולי זה הזמן לסמן הצלחה' : 'עוד צעד קטן מאחוריכם', { tone: 'good' });
    } catch (_) { toast('לא נשמר', { tone: 'warn' }); }
  },
  'task-toggle': async (el) => {
    const it = getItem(el.dataset.id);
    if (!it) return;
    const now = new Date().toISOString();
    try {
      if (it.status !== 'done' && it.data?.repeat) {
        const due = nextDue(it.due_date || todayStr(), it.data.repeat);
        await updateItem(it.id, { due_date: due, data: { last_done: now, last_by: c.me } });
        burst(el);
        toast(`בוצע. הפעם הבאה: ${due ? new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short' }).format(parseDate(due)) : ''}`);
      } else if (it.status !== 'done') {
        await updateItem(it.id, { status: 'done', done_at: now, data: { done_by: c.me } });
        burst(el);
      } else {
        await updateItem(it.id, { status: 'open', done_at: null });
      }
    } catch (_) { toast('לא נשמר', { tone: 'warn' }); }
  },
  'saving-add': (el) => openSavingAdd(getItem(el.dataset.id)),
  'place-to-date': (el) => {
    const p = getItem(el.dataset.id);
    if (p) openEditor('date', c, null, { title: p.title, data: { place: p.data?.where || p.title, place_id: p.id } });
  },
  nudge: (el) => sendNudge(c, el),
  'answer-q': () => closeSheet(() => openAnswer(c)),
  'ai-question': (el) => customQuestion(c, el),
  'ai-dates': () => closeSheet(() => openDateIdeas(c)),
  'ai-prep': () => openTalkPrep(c),
  letter: (el) => openOrWriteLetter(c, el),
  photos: () => pickPhotos(c),
  onboard: () => openOnboarding(c),
  invite: () => openInvite(c),
  go: (el) => { location.hash = el.dataset.href || '#/'; },
  'task-filter': (el) => { safeLocal('oe-task-filter', el.dataset.value); render(); },
  'deck-next': () => render(),
  'talk-step': (el) => { talkGo(el.dataset.to); lastKey = ''; render(); },
  'talk-save': async (el) => { if (await talkSave(c, el)) { lastKey = ''; render(); } },
  'talk-finish': () => talkFinish(),
  theme: (el) => { safeLocal('oe-theme', el.dataset.value); applyTheme(el.dataset.value); render(); },
  'ai-off': () => aiOff(),
  export: () => downloadBackup(),
  signout: () => doSignOut(),
};

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-stop]')) return;
  const el = e.target.closest('[data-act]');
  if (!el || !document.querySelector('.shell')?.contains(el) && !el.closest('#sheet-root')) return;
  const fn = ACT[el.dataset.act];
  if (!fn) return;
  if (el.tagName === 'A' && el.dataset.act !== 'talk-finish') e.preventDefault();
  fn(el, e);
});
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[role="button"][data-act]')) {
    e.preventDefault();
    e.target.click();
  }
});
document.addEventListener('submit', async (e) => {
  const f = e.target;
  if (f.dataset.form === 'talk') { e.preventDefault(); return; }
  if (f.dataset.form !== 'quick-thanks') return;
  e.preventDefault();
  const ta = f.querySelector('textarea');
  const text = ta.value.trim();
  if (!text) { ta.focus(); return; }
  const btn = f.querySelector('button[type="submit"]');
  busy(btn, true, 'שולחים...');
  try {
    await addItem({ kind: 'thanks', body: text, for_person: c.partner });
    burst(btn);
    toast(`התודה בדרך ל${c.partnerName}`, { tone: 'love' });
  } catch (_) {
    busy(btn, false);
    toast('לא נשלח. כדאי לנסות שוב', { tone: 'warn' });
  }
});

// ---------- live events ----------
onChange((evt) => {
  if (evt.type === 'items' && evt.event === 'INSERT' && evt.remote && evt.item && S.ready && evt.item.visibility !== 'private' && !evt.item.data?.by) {
    const it = evt.item;
    const pn = c.partnerName;
    const msg = {
      thanks: `${pn} ${c.pg('כתב', 'כתבה')} לך תודה`,
      love: `${pn} ${c.pg('כתב', 'כתבה')} מה ${c.pg('הוא אוהב', 'היא אוהבת')} בך`,
      nudge: `${pn} ${c.pg('חושב', 'חושבת')} ${c.g('עליך', 'עלייך')} עכשיו`,
      answer: `${pn} ${c.pg('ענה', 'ענתה')} על שאלת היום`,
      date: `${pn} ${c.pg('הוסיף', 'הוסיפה')} דייט ליומן`,
      photo: `${pn} ${c.pg('העלה', 'העלתה')} תמונה`,
      letter: 'מכתב השבוע נפתח',
    }[it.kind];
    if (msg) toast(msg, { tone: 'love', ms: 4200 });
  }
  if (evt.type === 'sync-error') console.warn('live sync interrupted');
  scheduleRender();
});

window.addEventListener('hashchange', () => { if (S.me) render(); });

let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); return; }
  if (hiddenAt && Date.now() - hiddenAt > 30 * 1000) resync();
});
window.addEventListener('online', () => resync());

// ---------- boot ----------
const splash = (text = '') => `<div class="splash">${brandMark(72)}<p class="splash-name">אור עיניים</p>${text ? `<p class="muted">${text}</p>` : ''}</div>`;

function showAuth() {
  app.innerHTML = '<div id="app-auth"></div>';
  renderAuth(document.getElementById('app-auth'), () => enterApp());
}

function notMember() {
  app.innerHTML = `<div class="splash">${brandMark(64)}<p class="splash-name">אור עיניים</p>
    <p class="muted">החשבון הזה עוד לא מחובר לבית. אפשר להצטרף עם קוד הבית.</p>
    <button type="button" class="btn" id="nm-out">חזרה למסך הכניסה</button></div>`;
  document.getElementById('nm-out').onclick = async () => { await signOut(); showAuth(); };
}

async function enterApp() {
  const hadCache = cacheLoad(S.user.id);
  if (hadCache) { mountShell(); render(); } else app.innerHTML = splash('פותחים את הבית...');
  try {
    const ok = await loadAll();
    if (!ok) { notMember(); return; }
  } catch (e) {
    console.error(e);
    if (!hadCache) {
      app.innerHTML = splash('אין חיבור לרשת כרגע. ננסה שוב ברגע שהחיבור יחזור.');
      window.addEventListener('online', () => location.reload(), { once: true });
      return;
    }
    toast('אין חיבור. מציגים את מה שנשמר במכשיר', { tone: 'warn' });
  }
  if (!hadCache) mountShell();
  render();
  subscribe();
  if (!safeLocal(`oe-onboard-${S.user.id}`)) {
    safeLocal(`oe-onboard-${S.user.id}`, 1);
    if (!settings().first_date) setTimeout(() => openOnboarding(c, { first: true }), 450);
    else if (!S.me.birthday) setTimeout(() => openWelcome(c), 450);
  }
}

sb.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT' && S.me) location.reload();
});

async function boot() {
  applyTheme();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  const session = await getSession().catch(() => null);
  if (!session) { showAuth(); return; }
  await enterApp();
}

boot();

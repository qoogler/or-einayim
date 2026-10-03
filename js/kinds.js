// אור עיניים · every kind of thing we keep: copy, form fields and how each one looks
import { icon } from './icons.js';
import { OPTIONS } from './content.js';
import { esc, nl2br, clip, fmtDate, relDay, daysFromToday, money, nameOf, timeAgo, todayStr, parseDate, byG } from './util.js';
import { avatar, bar } from './ui.js';
import { authorOf, isMine, myPerson } from './store.js';

export const WORLDS = [
  { key: 'home', hash: '#/', name: 'היום', icon: 'sun' },
  { key: 'us', hash: '#/us', name: 'אנחנו', icon: 'heart-handshake' },
  { key: 'story', hash: '#/story', name: 'הסיפור', icon: 'book-heart' },
  { key: 'dreams', hash: '#/dreams', name: 'חלומות', icon: 'compass' },
  { key: 'together', hash: '#/together', name: 'יחד', icon: 'house' },
];

const val = (x, ...a) => (typeof x === 'function' ? x(...a) : x);
const statusLabel = (kind, s) => (KINDS[kind]?.statuses || []).find(([v]) => v === s)?.[1] || '';

// ---------- shared card pieces ----------
function byLine(it) {
  const by = authorOf(it);
  if (!by) return '';
  return `${avatar(by, { size: 'xs' })}<span>${esc(nameOf(by))}</span>`;
}
function metaRow(parts) {
  return `<p class="meta">${parts.filter(Boolean).join('<span class="sep" aria-hidden="true">·</span>')}</p>`;
}
function statusChip(kind, s, tone = '') {
  const l = statusLabel(kind, s);
  return l ? `<span class="chip chip-s ${tone} st-${esc(s)}">${esc(l)}</span>` : '';
}
function rowCard(it, { title, sub = '', chips = '', meta = '', action = '', lead = '' }) {
  return `<article class="row" data-act="open" data-id="${it.id}">
    ${lead}
    <div class="row-main">
      <h3 class="row-title">${title}</h3>
      ${sub ? `<p class="row-sub">${sub}</p>` : ''}
      ${chips || meta ? `<div class="row-meta">${chips}${meta}</div>` : ''}
    </div>
    ${action}
  </article>`;
}
const linkBtn = (url) => (url ? `<a class="icon-btn" href="${esc(url)}" target="_blank" rel="noopener" aria-label="פתיחת קישור" data-stop>${icon('link')}</a>` : '');
const actBtn = (act, id, label, ic = '') => `<button type="button" class="pill-btn" data-act="${act}" data-id="${id}">${ic ? icon(ic) : ''}${label}</button>`;

function dateBlock(s) {
  const d = parseDate(s);
  if (!d) return '';
  const mon = new Intl.DateTimeFormat('he-IL', { month: 'short' }).format(d);
  return `<div class="dblock" aria-hidden="true"><b>${d.getDate()}</b><span>${mon}</span></div>`;
}

export function noteCard(it) {
  const by = authorOf(it);
  const to = it.for_person && it.for_person !== 'both' ? it.for_person : null;
  const fresh = !isMine(it) && !it.partner_seen_at && !it.data?.by;
  return `<article class="note ${fresh ? 'is-fresh' : ''} note-${by || 'x'}" data-act="open" data-id="${it.id}">
    <p class="note-text">${nl2br(it.body)}</p>
    <footer class="note-meta">
      ${avatar(by, { size: 'xs' })}
      <span>${by ? `מ${esc(nameOf(by))}` : ''}${to ? ` ל${esc(nameOf(to))}` : ''}</span>
      <span class="sep" aria-hidden="true">·</span><span>${timeAgo(it.created_at)}</span>
      ${it.data?.reaction ? `<span class="reacted" title="נגע ללב">${icon('heart')}</span>` : ''}
      ${fresh ? '<span class="new-tag">חדש</span>' : ''}
    </footer>
  </article>`;
}

function growthNext(it) {
  const steps = it.data?.steps || [];
  return steps.find((s) => !s.done) || null;
}
export function growthCard(it) {
  const steps = it.data?.steps || [];
  const done = steps.filter((s) => s.done).length;
  const next = growthNext(it);
  const pct = steps.length ? (done / steps.length) * 100 : 0;
  return `<article class="card growth" data-act="open" data-id="${it.id}">
    <div class="growth-top"><h3 class="row-title">${esc(it.title)}</h3>${statusChip('growth', it.status)}</div>
    ${steps.length ? `${bar(pct, 'bar-light')}<p class="meta">${done} מתוך ${steps.length} צעדים</p>` : '<p class="meta">עוד אין צעדים. צעד קטן אחד מספיק כדי להתחיל.</p>'}
    ${next ? `<div class="next-step"><span>הצעד הבא</span><p>${esc(next.text)}</p>${actBtn('growth-step', it.id, 'עשינו', 'check')}</div>` : ''}
  </article>`;
}

export function dateCard(it) {
  const planned = it.status !== 'done';
  const n = daysFromToday(it.event_date);
  const when = it.event_date ? (planned ? relDay(it.event_date) : fmtDate(it.event_date)) : '';
  const disc = ['orel', 'yiska'].map((p) => it.data?.[`discovered_${p}`] ? `<p class="disc">${avatar(p, { size: 'xs' })}<span>${esc(clip(it.data[`discovered_${p}`], 120))}</span></p>` : '').join('');
  return `<article class="row date-row ${planned ? 'is-planned' : ''}" data-act="open" data-id="${it.id}">
    ${dateBlock(it.event_date)}
    <div class="row-main">
      <h3 class="row-title">${esc(it.title)}</h3>
      ${metaRow([when, it.data?.time ? esc(it.data.time) : '', it.data?.place ? esc(it.data.place) : '', planned && n !== null && n < 0 ? '<span class="warn">איך היה? כדאי לתעד</span>' : ''])}
      ${!planned && it.body ? `<p class="row-sub">${esc(clip(it.body, 120))}</p>` : ''}
      ${!planned ? disc : ''}
    </div>
    ${it.data?.photo ? `<img class="row-thumb" data-photo="${esc(it.data.photo)}" alt="">` : ''}
  </article>`;
}

export function taskRow(it) {
  const done = it.status === 'done';
  const n = it.due_date ? daysFromToday(it.due_date) : null;
  const due = it.due_date ? `<span class="${!done && n < 0 ? 'late' : !done && n === 0 ? 'today' : ''}">${relDay(it.due_date)}</span>` : '';
  const who = it.for_person && it.for_person !== 'both' ? avatar(it.for_person, { size: 'xs' }) : `<span class="both-mark">${avatar('orel', { size: 'xs' })}${avatar('yiska', { size: 'xs' })}</span>`;
  const rep = it.data?.repeat ? `<span class="rep">${icon('repeat')}</span>` : '';
  return `<article class="task ${done ? 'is-done' : ''}" data-id="${it.id}">
    <button type="button" class="check" data-act="task-toggle" data-id="${it.id}" aria-pressed="${done}" aria-label="${done ? 'החזרה לפתוחה' : 'סימון כבוצע'}">${icon('check')}</button>
    <button type="button" class="task-main" data-act="open" data-id="${it.id}">
      <span class="task-title">${esc(it.title)}</span>
      <span class="task-meta">${who}${rep}${due}${it.data?.area && it.data.area !== 'בית' ? `<span class="area">${esc(it.data.area)}</span>` : ''}</span>
    </button>
  </article>`;
}

export function savingCard(it) {
  const t = Number(it.data?.target) || 0;
  const s = Number(it.data?.saved) || 0;
  const cur = it.data?.currency || '₪';
  const pct = t ? (s / t) * 100 : 0;
  return `<article class="card saving" data-act="open" data-id="${it.id}">
    <div class="saving-top"><h3 class="row-title">${esc(it.title)}</h3><span class="saving-pct">${Math.min(100, Math.round(pct))}%</span></div>
    ${bar(pct, 'bar-light')}
    ${metaRow([`${money(s, cur)} מתוך ${money(t, cur)}`, it.due_date ? `עד ${fmtDate(it.due_date, true)}` : ''])}
    ${actBtn('saving-add', it.id, 'להוסיף לחיסכון', 'plus')}
  </article>`;
}

// ---------- the kinds ----------
export const KINDS = {
  thanks: {
    world: 'us', icon: 'heart', name: 'תודה', plural: 'תודות', list: 'notes',
    title: 'צנצנת התודות',
    sub: 'כל תודה היא דרך להגיד: ראיתי אותך.',
    newTitle: (c) => `תודה ל${c.partnerName}`,
    fields: (c) => [{ k: 'body', type: 'textarea', label: `על מה ${c.g('תרצה', 'תרצי')} להגיד ל${c.partnerName} תודה היום?`, ph: 'על הרגע ש...', required: true, rows: 4, autofocus: true }],
    defaults: (c) => ({ for_person: c.partner }),
    card: noteCard,
  },
  love: {
    world: 'us', icon: 'sparkles', name: 'משהו שאני אוהב', plural: 'דברים שאנחנו אוהבים', list: 'notes',
    title: 'מה אנחנו אוהבים אחד בשני',
    sub: 'תכונות, הרגלים ורגעים. דברים שכדאי לשמוע יותר מפעם אחת.',
    newTitle: (c) => c.g(`מה אני אוהב ב${c.partnerName}`, `מה אני אוהבת ב${c.partnerName}`),
    fields: (c) => [{ k: 'body', type: 'textarea', label: `מה יש ב${c.partnerName} שגורם לך לחייך?`, ph: `${c.g('אני אוהב', 'אני אוהבת')} איך ש${c.pg('אתה', 'את')}...`, required: true, rows: 4, autofocus: true }],
    defaults: (c) => ({ for_person: c.partner }),
    card: noteCard,
  },
  talk: {
    world: 'us', icon: 'messages-square', name: 'נושא לשיחה', plural: 'שיחות',
    title: 'שיחות שמחכות לנו',
    sub: 'נושאים שמגיע להם ערב שלם, כוס תה ושקט.',
    newTitle: 'נושא לשיחה',
    statuses: [['open', 'מחכה לנו'], ['done', 'דיברנו']],
    fields: () => [
      { k: 'title', label: 'על מה בא לך שנדבר באמת?', ph: 'למשל: איך נראה בית בעינינו', required: true, autofocus: true },
      { k: 'body', type: 'textarea', label: 'למה זה חשוב לי', optional: true, rows: 2 },
      { k: 'status', type: 'chips', label: 'מצב', options: [['open', 'מחכה לנו'], ['done', 'דיברנו']], firstDefault: true },
      { k: 'data.notes', type: 'textarea', label: 'מה יצא לנו מהשיחה', optional: true, rows: 3 },
    ],
    defaults: () => ({ status: 'open' }),
    card: (it) => rowCard(it, {
      title: esc(it.title),
      sub: it.status === 'done' && it.data?.notes ? esc(clip(it.data.notes, 110)) : esc(clip(it.body, 110)),
      chips: statusChip('talk', it.status),
      meta: `<span class="meta-inline">${byLine(it)}</span>`,
      action: it.status !== 'done' ? actBtn('talk-done', it.id, 'דיברנו', 'check') : '',
    }),
  },
  growth: {
    world: 'us', icon: 'sprout', name: 'מיקוד', plural: 'מיקודים',
    title: 'על מה אנחנו עובדים',
    sub: 'קשר טוב נבנה בצעדים קטנים. מיקוד אחד או שניים בכל פעם.',
    newTitle: 'מיקוד חדש',
    statuses: [['active', 'בעבודה'], ['paused', 'בהמתנה'], ['done', 'הצלחנו']],
    fields: () => [
      { k: 'title', label: 'מה נרצה לעשות טוב יותר, ביחד?', ph: 'למשל: להקשיב עד הסוף לפני שעונים', required: true, autofocus: true },
      { k: 'body', type: 'textarea', label: 'למה זה חשוב לנו', optional: true, rows: 2 },
      { k: 'data.steps', type: 'steps', label: 'צעדים קטנים' },
      { k: 'status', type: 'chips', label: 'מצב', options: [['active', 'בעבודה'], ['paused', 'בהמתנה'], ['done', 'הצלחנו']], firstDefault: true },
    ],
    defaults: () => ({ status: 'active', data: { steps: [] } }),
    card: growthCard,
  },
  word: {
    world: 'us', icon: 'quote', name: 'מילה', plural: 'מילים',
    title: 'המילון שלנו',
    sub: 'מילים שרק שנינו מבינים, ומאיפה הן הגיעו.',
    newTitle: 'מילה חדשה במילון',
    fields: () => [
      { k: 'title', label: 'המילה', required: true, autofocus: true },
      { k: 'body', type: 'textarea', label: 'מה היא אומרת אצלנו', rows: 2, required: true },
      { k: 'data.origin', type: 'textarea', label: 'איך זה התחיל', optional: true, rows: 2 },
    ],
    card: (it) => `<article class="entry" data-act="open" data-id="${it.id}">
      <h3 class="entry-word">${esc(it.title)}</h3>
      <p class="entry-def">${esc(it.body)}</p>
      ${it.data?.origin ? `<p class="entry-origin">${esc(clip(it.data.origin, 140))}</p>` : ''}
    </article>`,
  },
  milestone: {
    world: 'story', icon: 'flag', name: 'קפיצת מדרגה', plural: 'קפיצות מדרגה',
    title: 'קפיצות מדרגה',
    sub: 'הרגעים שבהם הקשר שלנו עלה שלב.',
    newTitle: 'קפיצת מדרגה',
    fields: () => [
      { k: 'title', label: 'מה קרה?', ph: 'למשל: פגשנו את המשפחות', required: true, autofocus: true },
      { k: 'event_date', type: 'date', label: 'מתי', required: true },
      { k: 'body', type: 'textarea', label: 'איך זה הרגיש', optional: true, rows: 3 },
    ],
    defaults: () => ({ event_date: todayStr() }),
    card: (it) => rowCard(it, {
      lead: `<span class="lead-ic">${icon('flag')}</span>`,
      title: esc(it.title),
      sub: esc(clip(it.body, 120)),
      meta: it.event_date ? `<span>${fmtDate(it.event_date, true)}</span>` : '',
    }),
  },
  date: {
    world: 'story', icon: 'calendar-heart', name: 'דייט', plural: 'דייטים',
    title: 'יומן הדייטים',
    sub: 'מה עשינו, ומה גילינו אחד על השני.',
    newTitle: (c, it) => (it?.status === 'done' ? 'דייט שהיה' : 'דייט'),
    statuses: [['planned', 'מתוכנן'], ['done', 'היה']],
    fields: (c, it) => {
      const past = it && (it.status === 'done' || (it.event_date && daysFromToday(it.event_date) < 0));
      const base = [
        { k: 'title', label: 'מה עושים?', ph: 'למשל: פיקניק שקיעה', required: true, autofocus: !it?.id },
        { k: 'event_date', type: 'date', label: 'מתי', required: true },
        { k: 'data.time', type: 'time', label: 'שעה', optional: true },
        { k: 'data.place', label: 'איפה', optional: true },
        { k: 'data.planner', type: 'chips', label: 'מי מתכנן', options: [['both', 'שנינו'], ['orel', 'אוראל'], ['yiska', 'יסכה'], ['surprise', 'הפתעה']], firstDefault: true },
        { k: 'status', type: 'chips', label: 'מצב', options: [['planned', 'מתוכנן'], ['done', 'היה']], firstDefault: true },
      ];
      if (!past) return base;
      return [...base,
        { k: 'body', type: 'textarea', label: 'איך היה', optional: true, rows: 3 },
        { k: `data.discovered_${c.me}`, type: 'textarea', label: `מה גילית על ${c.partnerName}`, optional: true, rows: 2 },
        { k: 'data.photo', type: 'photo', label: 'תמונה מהדייט', optional: true },
      ];
    },
    defaults: () => ({ status: 'planned', data: { planner: 'both' } }),
    card: dateCard,
  },
  photo: {
    world: 'story', icon: 'image', name: 'תמונה', plural: 'תמונות',
    title: 'האלבום שלנו',
    sub: 'תמונות שלא רוצים שייבלעו בגלריה של הטלפון.',
    newTitle: 'תמונה',
    fields: () => [
      { k: 'title', label: 'כיתוב', optional: true },
      { k: 'event_date', type: 'date', label: 'מתי' },
    ],
    card: (it) => `<button type="button" class="ph" data-act="open" data-id="${it.id}"><img data-photo="${esc(it.data?.path || '')}" alt="${esc(it.title || '')}" loading="lazy"></button>`,
  },
  song: {
    world: 'story', icon: 'music', name: 'שיר', plural: 'שירים',
    title: 'השירים שלנו',
    sub: 'לכל שיר יש רגע. כאן כותבים אותו.',
    newTitle: 'שיר שלנו',
    fields: () => [
      { k: 'title', label: 'שם השיר', required: true, autofocus: true },
      { k: 'data.artist', label: 'מי שר', optional: true },
      { k: 'data.link', type: 'url', label: 'קישור', optional: true, ph: 'https://' },
      { k: 'body', type: 'textarea', label: 'הרגע של השיר', ph: 'מתי הוא התנגן, ולמה הוא שלנו', optional: true, rows: 3 },
    ],
    card: (it) => rowCard(it, {
      lead: `<span class="lead-ic">${icon('music')}</span>`,
      title: `${esc(it.title)}${it.data?.artist ? ` <span class="muted">· ${esc(it.data.artist)}</span>` : ''}`,
      sub: esc(clip(it.body, 110)),
      action: linkBtn(it.data?.link),
    }),
  },
  moment: {
    world: 'story', icon: 'star', name: 'רגע', plural: 'רגעים',
    title: 'דברים שאהבנו',
    sub: 'רגעים קטנים שלא רוצים לשכוח.',
    newTitle: 'רגע לשמור',
    fields: () => [
      { k: 'body', type: 'textarea', label: 'איזה רגע מהשבוע עוד מחמם לך את הלב?', required: true, rows: 3, autofocus: true },
      { k: 'event_date', type: 'date', label: 'מתי' },
    ],
    defaults: () => ({ event_date: todayStr() }),
    card: (it) => `<article class="moment" data-act="open" data-id="${it.id}">
      <p>${nl2br(it.body)}</p>
      ${metaRow([byLine(it), it.event_date ? fmtDate(it.event_date) : ''])}
    </article>`,
  },
  home: {
    world: 'dreams', icon: 'house', name: 'חלום לבית', plural: 'חלומות לבית',
    title: 'הבית שנבנה',
    sub: 'אם היינו קמים מחר בבית שלנו, מה היינו רואים קודם?',
    newTitle: 'חלום לבית',
    fields: () => [
      { k: 'title', label: 'מה רואים?', ph: 'למשל: שולחן שבת גדול מעץ', required: true, autofocus: true },
      { k: 'data.room', type: 'select', label: 'איפה בבית', options: OPTIONS.home_room },
      { k: 'body', type: 'textarea', label: 'פרטים', optional: true, rows: 2 },
      { k: 'data.link', type: 'url', label: 'השראה (קישור)', optional: true, ph: 'https://' },
      { k: 'data.photo', type: 'photo', label: 'תמונת השראה', optional: true },
    ],
    defaults: () => ({ data: { room: 'כללי' } }),
    card: (it) => `<article class="vision" data-act="open" data-id="${it.id}">
      ${it.data?.photo ? `<img data-photo="${esc(it.data.photo)}" alt="" loading="lazy">` : ''}
      <div class="vision-txt"><span class="eyebrow">${esc(it.data?.room || 'כללי')}</span><h3>${esc(it.title)}</h3>${it.body ? `<p>${esc(clip(it.body, 90))}</p>` : ''}</div>
    </article>`,
  },
  trip: {
    world: 'dreams', icon: 'plane', name: 'טיול', plural: 'טיולים',
    title: 'לאן נוסעים',
    sub: 'מקומות שנרצה לראות ביחד בפעם הראשונה.',
    newTitle: 'טיול',
    statuses: [['dream', 'חלום'], ['planned', 'בתכנון'], ['done', 'היינו']],
    fields: () => [
      { k: 'title', label: 'לאן?', required: true, autofocus: true },
      { k: 'data.when', label: 'מתי, בערך', optional: true, ph: 'למשל: אביב 2027' },
      { k: 'body', type: 'textarea', label: 'מה עושים שם', optional: true, rows: 3 },
      { k: 'status', type: 'chips', label: 'מצב', options: [['dream', 'חלום'], ['planned', 'בתכנון'], ['done', 'היינו']], firstDefault: true },
    ],
    defaults: () => ({ status: 'dream' }),
    card: (it) => rowCard(it, {
      lead: `<span class="lead-ic">${icon('plane')}</span>`,
      title: esc(it.title),
      sub: esc(clip(it.body, 100)),
      chips: statusChip('trip', it.status, it.status === 'planned' ? 'chip-hot' : ''),
      meta: it.data?.when ? `<span>${esc(it.data.when)}</span>` : '',
    }),
  },
  saving: {
    world: 'dreams', icon: 'piggy-bank', name: 'יעד חיסכון', plural: 'יעדים',
    title: 'חוסכים בשביל',
    sub: 'כל חיסכון הוא חלום עם תאריך.',
    newTitle: 'יעד חיסכון',
    fields: () => [
      { k: 'title', label: 'בשביל מה?', ph: 'למשל: הטיול הגדול', required: true, autofocus: true },
      { k: 'data.target', type: 'number', label: 'כמה צריך', required: true },
      { k: 'data.currency', type: 'chips', label: 'מטבע', options: OPTIONS.currency, firstDefault: true },
      { k: 'data.saved', type: 'number', label: 'כמה כבר יש', optional: true },
      { k: 'due_date', type: 'date', label: 'עד מתי', optional: true },
      { k: 'body', type: 'textarea', label: 'למה זה חשוב לנו', optional: true, rows: 2 },
    ],
    defaults: () => ({ data: { currency: '₪', saved: 0 } }),
    card: savingCard,
  },
  place: {
    world: 'dreams', icon: 'map-pin', name: 'מקום', plural: 'מקומות',
    title: 'מקומות שרוצים להגיע אליהם',
    sub: 'מסעדות, נופים, הופעות ופינות שמישהו סיפר עליהן.',
    newTitle: 'מקום שרוצים להגיע אליו',
    statuses: [['want', 'רוצים'], ['visited', 'היינו']],
    fields: () => [
      { k: 'title', label: 'איזה מקום?', required: true, autofocus: true },
      { k: 'data.where', label: 'איפה', optional: true },
      { k: 'data.type', type: 'chips', label: 'סוג', options: OPTIONS.place_type, firstDefault: true },
      { k: 'data.link', type: 'url', label: 'קישור', optional: true, ph: 'https://' },
      { k: 'body', type: 'textarea', label: 'למה בא לנו', optional: true, rows: 2 },
      { k: 'status', type: 'chips', label: 'מצב', options: [['want', 'רוצים'], ['visited', 'היינו']], firstDefault: true },
    ],
    defaults: () => ({ status: 'want', data: { type: 'אוכל' } }),
    card: (it) => rowCard(it, {
      lead: `<span class="lead-ic">${icon('map-pin')}</span>`,
      title: esc(it.title),
      sub: esc(clip(it.body, 90)),
      chips: it.data?.type ? `<span class="chip chip-s">${esc(it.data.type)}</span>` : '',
      meta: it.data?.where ? `<span>${esc(it.data.where)}</span>` : '',
      action: it.status === 'want' ? actBtn('place-to-date', it.id, 'לדייט', 'calendar-heart') : statusChip('place', it.status),
    }),
  },
  wish: {
    world: 'dreams', icon: 'gift', name: 'משאלה', plural: 'משאלות',
    title: 'מתנות וחוויות',
    sub: 'מה עושה לכל אחד מאיתנו טוב, ומה בא לנו להגשים ביחד.',
    newTitle: (c, it) => (it?.visibility === 'private' ? 'רמז למחברת' : 'משאלה'),
    statuses: [['open', 'מחכה'], ['done', 'הוגשם']],
    fields: (c, it) => [
      { k: 'title', label: it?.visibility === 'private' ? `מה ${c.partnerName} ${c.pg('הזכיר', 'הזכירה')} בדרך אגב?` : 'מה?', required: true, autofocus: true },
      { k: 'data.type', type: 'chips', label: 'סוג', options: OPTIONS.wish_type, firstDefault: true },
      { k: 'for_person', type: 'chips', label: 'בשביל מי', options: [[c.me, 'בשבילי'], [c.partner, `בשביל ${c.partnerName}`], ['both', 'לשנינו']] },
      { k: 'body', type: 'textarea', label: 'פרטים', optional: true, rows: 2 },
      { k: 'data.link', type: 'url', label: 'קישור', optional: true, ph: 'https://' },
      { k: 'status', type: 'chips', label: 'מצב', options: [['open', 'מחכה'], ['done', 'הוגשם']], firstDefault: true },
      { k: 'visibility', type: 'toggle', label: 'פרטי: רק אני רואה את זה', hint: `טוב להפתעות. ${c.partnerName} לא ${c.pg('יראה', 'תראה')} את זה באפליקציה.` },
    ],
    defaults: (c) => ({ status: 'open', for_person: c.me, data: { type: 'מתנה' } }),
    card: (it) => rowCard(it, {
      lead: `<span class="lead-ic">${icon(it.visibility === 'private' ? 'lock' : 'gift')}</span>`,
      title: esc(it.title),
      sub: esc(clip(it.body, 90)),
      chips: `${it.data?.type ? `<span class="chip chip-s">${esc(it.data.type)}</span>` : ''}${it.status === 'done' ? statusChip('wish', 'done') : ''}`,
      meta: it.for_person === 'both' ? '<span>לשנינו</span>' : it.for_person ? `<span>בשביל ${esc(nameOf(it.for_person))}</span>` : '',
      action: linkBtn(it.data?.link),
    }),
  },
  task: {
    world: 'together', icon: 'list-checks', name: 'משימה', plural: 'משימות', list: 'tasks',
    title: 'משימות',
    sub: 'הבית והבריאות שלנו, בלי שאף אחד יצטרך לזכור הכל לבד.',
    newTitle: 'משימה',
    fields: () => [
      { k: 'title', label: 'מה צריך לעשות?', required: true, autofocus: true },
      { k: 'data.area', type: 'chips', label: 'תחום', options: OPTIONS.task_area, firstDefault: true },
      { k: 'for_person', type: 'chips', label: 'מי לוקח', options: [['both', 'שנינו'], ['orel', 'אוראל'], ['yiska', 'יסכה']], firstDefault: true },
      { k: 'due_date', type: 'date', label: 'עד מתי', optional: true },
      { k: 'data.repeat', type: 'select', label: 'חוזר על עצמו', options: OPTIONS.task_repeat },
      { k: 'body', type: 'textarea', label: 'הערות', optional: true, rows: 2 },
    ],
    defaults: () => ({ status: 'open', for_person: 'both', data: { area: 'בית', repeat: '' } }),
    card: taskRow,
  },
  recipe: {
    world: 'together', icon: 'cooking-pot', name: 'מתכון', plural: 'מתכונים',
    title: 'מתכונים',
    sub: 'מה שאהבנו, ומה שמחכה לניסיון.',
    newTitle: 'מתכון',
    statuses: [['want', 'רוצים לנסות'], ['loved', 'אהבנו']],
    fields: () => [
      { k: 'title', label: 'שם המתכון', required: true, autofocus: true },
      { k: 'data.link', type: 'url', label: 'קישור', optional: true, ph: 'https://' },
      { k: 'body', type: 'textarea', label: 'מצרכים, הערות או השינויים שלנו', optional: true, rows: 4 },
      { k: 'status', type: 'chips', label: 'מצב', options: [['want', 'רוצים לנסות'], ['loved', 'אהבנו']], firstDefault: true },
    ],
    defaults: () => ({ status: 'want' }),
    card: (it) => rowCard(it, {
      lead: `<span class="lead-ic">${icon('cooking-pot')}</span>`,
      title: esc(it.title),
      sub: esc(clip(it.body, 90)),
      chips: statusChip('recipe', it.status, it.status === 'loved' ? 'chip-good' : ''),
      action: linkBtn(it.data?.link),
    }),
  },
  media: {
    world: 'together', icon: 'book-open', name: 'פריט', plural: 'פריטים',
    title: 'לראות, לקרוא, ללמוד',
    sub: 'סיפורים, רעיונות ולימוד שנעבור ביחד.',
    newTitle: 'לראות, לקרוא, ללמוד',
    statuses: [['want', 'בתור'], ['doing', 'באמצע'], ['done', 'סיימנו']],
    fields: () => [
      { k: 'title', label: 'מה?', required: true, autofocus: true },
      { k: 'data.type', type: 'chips', label: 'סוג', options: OPTIONS.media_type, firstDefault: true },
      { k: 'data.progress', label: 'איפה עצרנו', optional: true, ph: 'פרק 3, עמוד 40, משנה ב׳' },
      { k: 'data.link', type: 'url', label: 'קישור', optional: true, ph: 'https://' },
      { k: 'body', type: 'textarea', label: 'מחשבות', optional: true, rows: 2 },
      { k: 'status', type: 'chips', label: 'מצב', options: [['want', 'בתור'], ['doing', 'באמצע'], ['done', 'סיימנו']], firstDefault: true },
    ],
    defaults: () => ({ status: 'want', data: { type: 'סדרה' } }),
    card: (it) => rowCard(it, {
      lead: `<span class="lead-ic">${icon({ 'סדרה': 'tv', 'סרט': 'film', 'ספר': 'book-open', 'לימוד תורה': 'scroll-text', 'פודקאסט': 'podcast', 'קורס': 'graduation-cap' }[it.data?.type] || 'book-open')}</span>`,
      title: esc(it.title),
      sub: it.data?.progress ? `עצרנו ב: ${esc(it.data.progress)}` : esc(clip(it.body, 90)),
      chips: `${it.data?.type ? `<span class="chip chip-s">${esc(it.data.type)}</span>` : ''}${statusChip('media', it.status, it.status === 'doing' ? 'chip-hot' : '')}`,
      action: linkBtn(it.data?.link),
    }),
  },
  event: {
    world: 'together', icon: 'calendar', name: 'אירוע', plural: 'אירועים',
    title: 'אירועים',
    sub: 'מה שמחכה לנו ומה שכבר היה.',
    newTitle: 'אירוע',
    fields: () => [
      { k: 'title', label: 'מה?', required: true, autofocus: true },
      { k: 'event_date', type: 'date', label: 'מתי', required: true },
      { k: 'data.time', type: 'time', label: 'שעה', optional: true },
      { k: 'data.place', label: 'איפה', optional: true },
      { k: 'body', type: 'textarea', label: 'פרטים', optional: true, rows: 2 },
    ],
    card: (it) => rowCard(it, {
      lead: dateBlock(it.event_date),
      title: esc(it.title),
      sub: esc(clip(it.body, 90)),
      meta: [relDay(it.event_date), it.data?.time, it.data?.place].filter(Boolean).map((x) => `<span>${esc(x)}</span>`).join('<span class="sep">·</span>'),
    }),
  },
};

// Internal kinds (no generic editor): answer, checkin, letter, nudge
export const INTERNAL = ['answer', 'checkin', 'letter', 'nudge'];

export function kindTitle(kind, c) { return val(KINDS[kind]?.title, c); }
export function kindSub(kind, c) { return val(KINDS[kind]?.sub, c); }
export function kindNewTitle(kind, c, it) { return val(KINDS[kind]?.newTitle, c, it) || KINDS[kind]?.name || ''; }
export function kindFields(kind, c, it) { return val(KINDS[kind]?.fields, c, it) || []; }
export function kindDefaults(kind, c) { return val(KINDS[kind]?.defaults, c) || {}; }
export function renderCard(it) {
  const k = KINDS[it.kind];
  return k ? k.card(it) : '';
}

// Sorting helpers
export const byCreatedDesc = (a, b) => (a.created_at < b.created_at ? 1 : -1);
export const byEventAsc = (a, b) => String(a.event_date || '9999').localeCompare(String(b.event_date || '9999'));
export const byEventDesc = (a, b) => String(b.event_date || '').localeCompare(String(a.event_date || ''));

// Which quick-add entries appear under the + button
export const QUICK_ADD = [
  { group: 'רגע של חיבור', kinds: ['thanks', 'love', 'moment', 'word'] },
  { group: 'לתכנן', kinds: ['date', 'task', 'event', 'talk'] },
  { group: 'לחלום', kinds: ['place', 'trip', 'home', 'saving', 'wish'] },
  { group: 'לשמור', kinds: ['photo', 'song', 'recipe', 'media', 'milestone', 'growth'] },
];

export { byG };

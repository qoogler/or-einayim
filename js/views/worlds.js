// אור עיניים · the four worlds: אנחנו, הסיפור, חלומות, יחד
import { icon } from '../icons.js';
import { STAGES, DECKS, SUGGEST, WEEKLY } from '../content.js';
import { S, items, isMine, settings, authorOf } from '../store.js';
import {
  esc, clip, todayStr, fmtDate, relDay, daysFromToday, nameOf, parseDate, dateStr, addDays, safeLocal, fmtMonthYear, localDay, byG,
} from '../util.js';
import { avatar, sectionHead, empty, suggestChips, bar } from '../ui.js';
import { KINDS, renderCard, byCreatedDesc, byEventAsc, byEventDesc, noteCard, growthCard, dateCard, taskRow, savingCard } from '../kinds.js';
import { weekStats, currentStage, wishGroups, momentsByDay, answersFor } from '../logic.js';

const addBtn = (kind, label = 'להוסיף') => ({ act: 'new', label, icon: 'plus', attrs: `data-kind="${kind}"` });
const allLink = (kind, n) => (n > 0 ? `<a class="more-link" href="#/list/${kind}">לכל ה${KINDS[kind].plural} (${n})${icon('chevron-left')}</a>` : '');

// =================== אנחנו ===================
function jar(c) {
  const all = items('thanks').sort(byCreatedDesc);
  const month = todayStr().slice(0, 7);
  const thisMonth = all.filter((t) => localDay(t.created_at).slice(0, 7) === month).length;
  const fresh = all.filter((t) => !isMine(t) && !t.partner_seen_at && !t.data?.by);
  const show = [...fresh, ...all.filter((t) => !fresh.includes(t))].slice(0, 3);
  return `<section class="jar">
    <div class="jar-head">
      <div><h2 class="world-h">צנצנת התודות</h2><p class="sec-sub">${KINDS.thanks.sub}</p></div>
      <div class="jar-count"><b>${all.length}</b><span>${all.length === 1 ? 'תודה' : 'תודות'}<br>${thisMonth} החודש</span></div>
    </div>
    ${show.length ? `<div class="notes">${show.map(noteCard).join('')}</div>` : empty(`הצנצנת ריקה ומחכה לפתק הראשון. ${c.g('אתה רוצה', 'את רוצה')} להתחיל?`)}
    <div class="row-actions"><button type="button" class="btn" data-act="new" data-kind="thanks">${icon('heart')}לכתוב תודה</button>${allLink('thanks', all.length)}</div>
  </section>`;
}

function loveBlock(c) {
  const all = items('love').sort(byCreatedDesc);
  return `<section>${sectionHead(KINDS.love.title, { sub: KINDS.love.sub, action: addBtn('love') })}
    ${all.length ? `<div class="notes notes-2">${all.slice(0, 2).map(noteCard).join('')}</div>${allLink('love', all.length)}`
      : empty(`מה יש ב${esc(c.partnerName)} שגורם לך לחייך? משפט אחד מספיק.`)}
  </section>`;
}

function weeklyBlock(c) {
  const w = weekStats();
  const last = items('checkin').sort(byCreatedDesc)[0];
  const day = settings().weekly_day || 'fri';
  const dayName = { sun: 'ראשון', mon: 'שני', tue: 'שלישי', wed: 'רביעי', thu: 'חמישי', fri: 'שישי', sat: 'מוצאי שבת' }[day];
  return `<section class="card weekly">
    <div class="card-eyebrow">${icon('coffee')}<span>${WEEKLY.title}</span>${w.talk.n ? '<span class="chip chip-s chip-good">השבוע: היה</span>' : ''}</div>
    <p>${WEEKLY.line}</p>
    <p class="meta">היום הקבוע שלנו: ${esc(dayName)}</p>
    <div class="row-actions">
      <a class="btn" href="#/talk">${w.talk.n ? 'שיחה נוספת' : 'להתחיל עכשיו'}</a>
      ${last ? `<button type="button" class="btn btn-quiet" data-act="open" data-id="${last.id}">הסיכום האחרון</button>` : ''}
    </div>
  </section>`;
}

function talksBlock(c) {
  const open = items('talk').filter((t) => t.status !== 'done').sort(byCreatedDesc);
  const n = items('talk').length;
  return `<section>${sectionHead(KINDS.talk.title, { sub: KINDS.talk.sub, action: addBtn('talk') })}
    ${open.length ? `<div class="rows">${open.slice(0, 4).map(renderCard).join('')}</div>` : `${empty('עוד אין כאן נושאים. אפשר להתחיל מאחת ההצעות:')}${suggestChips(SUGGEST.talk, 'talk')}`}
    ${allLink('talk', n)}
  </section>`;
}

function decksBlock(c) {
  return `<section>${sectionHead('חפיסות שאלות', { sub: 'לערב בלי טלפונים. שולפים שאלה, ומקשיבים עד הסוף.' })}
    <div class="decks">${DECKS.map((d) => `<a class="deck-tile deck-${d.key}" href="#/deck/${d.key}"><b>${esc(d.name)}</b><span>${esc(d.line)}</span></a>`).join('')}</div>
  </section>`;
}

function growthBlock() {
  const all = items('growth').sort((a, b) => (a.status === 'active' ? -1 : 1) - (b.status === 'active' ? -1 : 1) || (a.updated_at < b.updated_at ? 1 : -1));
  const active = all.filter((g) => g.status !== 'done');
  return `<section>${sectionHead(KINDS.growth.title, { sub: KINDS.growth.sub, action: addBtn('growth') })}
    ${active.length ? `<div class="stack">${active.slice(0, 3).map(growthCard).join('')}</div>` : `${empty('מה היינו רוצים לעשות טוב יותר, ביחד? הנה כמה כיוונים:')}${suggestChips(SUGGEST.growth, 'growth')}`}
    ${allLink('growth', all.length)}
  </section>`;
}

function wordsBlock() {
  const all = items('word').sort(byCreatedDesc);
  return `<section>${sectionHead(KINDS.word.title, { sub: KINDS.word.sub, action: addBtn('word') })}
    ${all.length ? `<div class="dict">${all.slice(0, 4).map(renderCard).join('')}</div>${allLink('word', all.length)}` : empty('הכינוי הראשון, הבדיחה הפנימית, המילה שהמצאתם. הכל נכנס לכאן.')}
  </section>`;
}

function answersBlock(c) {
  const days = [...new Set(items('answer').map((a) => a.data?.date).filter(Boolean))].sort().reverse().slice(0, 3);
  if (!days.length) return '';
  return `<section>${sectionHead('שאלות ותשובות', { action: { act: 'go', label: 'הכל', attrs: 'data-href="#/answers"' } })}
    <div class="rows">${days.map((d) => {
      const { me, partner } = answersFor(d);
      const q = (me || partner)?.data?.q || '';
      return `<a class="row" href="#/answers"><div class="row-main"><h3 class="row-title">${esc(q)}</h3>
        <div class="row-meta">${me ? avatar(c.me, { size: 'xs' }) : ''}${partner ? avatar(c.partner, { size: 'xs' }) : ''}<span>${relDay(d)}</span></div></div></a>`;
    }).join('')}</div>
  </section>`;
}

function prepBlock(c) {
  return `<section class="card prep-card">
    <div class="card-eyebrow">${icon('lock')}<span>רק ${c.g('אתה רואה', 'את רואה')} את זה</span></div>
    <h3 class="row-title">יש משהו שקשה לך להתחיל לדבר עליו?</h3>
    <p class="muted">שיחה קשה מתחילה טוב כשהפתיחה רכה: מה אני ${c.g('מרגיש', 'מרגישה')}, על מה, ומה אני ${c.g('צריך', 'צריכה')}. בלי "אתה תמיד" ובלי "את אף פעם".</p>
    ${S.ai?.enabled ? `<button type="button" class="btn btn-quiet" data-act="ai-prep">${icon('wand-sparkles')}לעזור לי לנסח</button>` : ''}
  </section>`;
}

export const us = {
  html(r, c) {
    return `<div class="view view-world">
      <header class="world-intro"><p class="eyebrow">אנחנו</p><h1 class="world-title">מה שבינינו</h1>
      <p class="world-line">תודות, שיחות, ומה שאנחנו בונים ביחד מבפנים.</p></header>
      ${jar(c)}
      ${weeklyBlock(c)}
      ${loveBlock(c)}
      ${talksBlock(c)}
      ${decksBlock(c)}
      ${growthBlock()}
      ${wordsBlock()}
      ${answersBlock(c)}
      ${prepBlock(c)}
    </div>`;
  },
};

// =================== הסיפור ===================
function stageBlock(c) {
  const st = currentStage();
  const recorded = new Set(items('milestone').map((m) => (m.title || '').trim()));
  const next = st.milestones.filter((m) => !recorded.has(m));
  return `<section class="card stage">
    <div class="card-eyebrow">${icon('compass')}<span>השלב שלנו</span></div>
    <h2 class="stage-name">${esc(st.name)}</h2>
    <p>${esc(st.line)}</p>
    <h3 class="mini-h">מה טבעי עכשיו</h3>
    <ul class="ticks">${st.natural.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
    ${next.length ? `<h3 class="mini-h">קפיצות מדרגה שאולי מחכות</h3>
      <div class="suggest">${next.map((m) => `<button type="button" class="chip chip-add" data-act="new" data-kind="milestone" data-title="${esc(m)}">${icon('flag')}${esc(m)}</button>`).join('')}</div>` : ''}
    <a class="link-btn" href="#/settings#stage">לשנות שלב</a>
  </section>`;
}

function heatmap() {
  const weeks = 26;
  const map = momentsByDay(weeks * 7);
  const today = new Date();
  const end = addDays(today, 6 - today.getDay());
  const cells = [];
  let total = 0;
  for (let w = weeks - 1; w >= 0; w--) {
    for (let d = 0; d < 7; d++) {
      const day = addDays(end, -(w * 7 + (6 - d)));
      const key = dateStr(day);
      const n = day > today ? -1 : (map[key] || 0);
      if (n > 0) total += n;
      cells.push({ key, n, col: weeks - 1 - w, row: d });
    }
  }
  const size = 11, gap = 3;
  const W = weeks * (size + gap);
  const H = 7 * (size + gap);
  const lvl = (n) => (n < 0 ? 'f' : n === 0 ? 0 : n < 2 ? 1 : n < 4 ? 2 : n < 7 ? 3 : 4);
  // RTL: newest week on the left side of the reader's flow, so draw from the right edge
  const rects = cells.map((c) => `<rect x="${W - (c.col + 1) * (size + gap)}" y="${c.row * (size + gap)}" width="${size}" height="${size}" rx="2.5" class="hm hm-${lvl(c.n)}"><title>${c.key}: ${Math.max(0, c.n)}</title></rect>`).join('');
  return `<section>${sectionHead('חצי שנה של רגעים', { sub: total ? `${total} דברים שעשינו, כתבנו ושמרנו בחצי השנה האחרונה.` : 'כל דבר שנכתוב או נעשה ביחד יאיר כאן משבצת.' })}
    <div class="hm-wrap"><svg viewBox="0 0 ${W} ${H}" class="heatmap" role="img" aria-label="רגעים לפי ימים">${rects}</svg></div>
  </section>`;
}

function timeline(limit = 8) {
  const list = [
    ...items('milestone'),
    ...items('date').filter((d) => d.status === 'done'),
    ...items('moment'),
  ].sort((a, b) => String(b.event_date || localDay(b.created_at)).localeCompare(String(a.event_date || localDay(a.created_at))));
  if (!list.length) return empty('הסיפור שלנו מתחיל כאן. דייט שהיה, רגע שאהבנו או קפיצת מדרגה.',
    `<button type="button" class="btn btn-quiet" data-act="new" data-kind="moment">רגע לשמור</button><button type="button" class="btn btn-quiet" data-act="new" data-kind="milestone">קפיצת מדרגה</button>`);
  let lastMonth = '';
  const rows = list.slice(0, limit).map((it) => {
    const d = it.event_date || localDay(it.created_at);
    const m = d.slice(0, 7);
    const head = m !== lastMonth ? `<li class="tl-month">${fmtMonthYear(d)}</li>` : '';
    lastMonth = m;
    const ic = it.kind === 'milestone' ? 'flag' : it.kind === 'date' ? 'calendar-heart' : 'star';
    const title = it.kind === 'moment' ? clip(it.body, 90) : it.title;
    return `${head}<li class="tl-item tl-${it.kind}" data-act="open" data-id="${it.id}">
      <span class="tl-ic">${icon(ic)}</span>
      <div><b>${esc(title)}</b><small>${fmtDate(d)}${it.kind === 'date' && it.data?.place ? ` · ${esc(it.data.place)}` : ''}</small></div>
    </li>`;
  }).join('');
  return `<ol class="timeline">${rows}</ol>${list.length > limit ? `<a class="more-link" href="#/timeline">לכל הסיפור (${list.length})${icon('chevron-left')}</a>` : ''}`;
}

function datesBlock() {
  const all = items('date');
  const planned = all.filter((d) => d.status !== 'done').sort(byEventAsc);
  const done = all.filter((d) => d.status === 'done').sort(byEventDesc);
  return `<section>${sectionHead(KINDS.date.title, { sub: KINDS.date.sub, action: addBtn('date', 'לתכנן') })}
    ${planned.length || done.length ? `<div class="rows">${[...planned.slice(0, 2), ...done.slice(0, 3)].map(dateCard).join('')}</div>` : empty('עוד אין דייטים ביומן.')}
    <div class="row-actions">
      <button type="button" class="btn btn-quiet" data-act="new" data-kind="date" data-status="done">${icon('pencil')}לתעד דייט שהיה</button>
      ${S.ai?.enabled ? `<button type="button" class="btn btn-quiet" data-act="ai-dates">${icon('wand-sparkles')}רעיונות</button>` : ''}
    </div>
    ${allLink('date', all.length)}
  </section>`;
}

function albumBlock() {
  const all = items('photo').sort((a, b) => String(b.event_date || '').localeCompare(String(a.event_date || '')) || (a.created_at < b.created_at ? 1 : -1));
  const link = settings().album_url;
  return `<section>${sectionHead(KINDS.photo.title, { sub: KINDS.photo.sub, action: { act: 'photos', label: 'להעלות', icon: 'camera' } })}
    ${all.length ? `<div class="album album-mini">${all.slice(0, 6).map(renderCard).join('')}</div><a class="more-link" href="#/album">לכל האלבום (${all.length})${icon('chevron-left')}</a>`
      : empty('התמונות הראשונות שלנו יחכו כאן, שמורות רק לשנינו.', `<button type="button" class="btn btn-quiet" data-act="photos">${icon('camera')}להעלות תמונות</button>`)}
    ${link ? `<a class="link-btn" href="${esc(link)}" target="_blank" rel="noopener">${icon('link')}האלבום המשותף שלנו</a>` : ''}
  </section>`;
}

function songsBlock() {
  const all = items('song').sort(byCreatedDesc);
  const pl = settings().playlist_url;
  return `<section>${sectionHead(KINDS.song.title, { sub: KINDS.song.sub, action: addBtn('song') })}
    ${all.length ? `<div class="rows">${all.slice(0, 3).map(renderCard).join('')}</div>${allLink('song', all.length)}` : empty('השיר שהתנגן ברכב בפעם הראשונה, השיר שלה, השיר שלו. כל אחד עם הרגע שלו.')}
    ${pl ? `<a class="btn btn-quiet" href="${esc(pl)}" target="_blank" rel="noopener">${icon('music')}לפלייליסט שלנו</a>` : `<a class="link-btn" href="#/settings#links">${icon('link')}לחבר פלייליסט משותף</a>`}
  </section>`;
}

export const story = {
  html(r, c) {
    return `<div class="view view-world">
      <header class="world-intro"><p class="eyebrow">הסיפור</p><h1 class="world-title">איך הגענו עד כאן</h1>
      <p class="world-line">הדייטים, הרגעים וקפיצות המדרגה. הפרקים של הספר שלנו.</p></header>
      ${stageBlock(c)}
      <section>${sectionHead('ציר הזמן שלנו', { action: { act: 'new', label: 'רגע', icon: 'plus', attrs: 'data-kind="moment"' } })}${timeline()}</section>
      ${datesBlock()}
      ${albumBlock()}
      ${heatmap()}
      ${songsBlock()}
    </div>`;
  },
};

// =================== חלומות ===================
function savingsBlock() {
  const all = items('saving').sort(byCreatedDesc);
  return `<section>${sectionHead(KINDS.saving.title, { sub: KINDS.saving.sub, action: addBtn('saving') })}
    ${all.length ? `<div class="stack">${all.map(savingCard).join('')}</div>` : empty('טיול, דירה, טבעת, ספה. כל חלום שיש לו מחיר מקבל כאן מד התקדמות.')}
  </section>`;
}

function tripsBlock() {
  const all = items('trip');
  const order = { planned: 0, dream: 1, done: 2 };
  const sorted = all.sort((a, b) => (order[a.status] ?? 1) - (order[b.status] ?? 1) || (a.created_at < b.created_at ? 1 : -1));
  return `<section>${sectionHead(KINDS.trip.title, { sub: KINDS.trip.sub, action: addBtn('trip') })}
    ${sorted.length ? `<div class="rows">${sorted.slice(0, 5).map(renderCard).join('')}</div>${allLink('trip', all.length)}` : `${empty('לאן נרצה לנסוע ביחד?')}${suggestChips(SUGGEST.trip, 'trip')}`}
  </section>`;
}

function homeVision() {
  const all = items('home').sort(byCreatedDesc);
  return `<section>${sectionHead(KINDS.home.title, { sub: KINDS.home.sub, action: addBtn('home') })}
    ${all.length ? `<div class="visions">${all.slice(0, 6).map(renderCard).join('')}</div>${allLink('home', all.length)}` : `${empty('פינה אחת, ריח אחד, שולחן אחד. מתחילים מפרט קטן.')}${suggestChips(SUGGEST.home, 'home')}`}
  </section>`;
}

function placesBlock() {
  const all = items('place');
  const want = all.filter((p) => p.status !== 'visited').sort(byCreatedDesc);
  return `<section>${sectionHead(KINDS.place.title, { sub: KINDS.place.sub, action: addBtn('place') })}
    ${want.length ? `<div class="rows">${want.slice(0, 5).map(renderCard).join('')}</div>` : empty('מסעדה שמישהו המליץ, נוף שראינו בתמונה, הופעה שמתקרבת. שומרים כאן, והופכים לדייט בלחיצה.')}
    ${allLink('place', all.length)}
  </section>`;
}

function wishesBlock(c) {
  const g = wishGroups(c);
  const list = (arr, emptyText) => (arr.length ? `<div class="rows">${arr.slice(0, 4).map(renderCard).join('')}</div>` : `<p class="muted small">${emptyText}</p>`);
  return `<section>${sectionHead(KINDS.wish.title, { sub: KINDS.wish.sub, action: addBtn('wish') })}
    <div class="wish-cols">
      <div class="wish-col"><h3 class="mini-h">${c.g('מה הייתי שמח לקבל', 'מה הייתי שמחה לקבל')}</h3>${list(g.mine, `כדאי לכתוב כאן, ש${c.partnerName} ${c.pg('ידע', 'תדע')}.`)}</div>
      <div class="wish-col"><h3 class="mini-h">מה ${esc(c.partnerName)} ${c.pg('היה שמח', 'הייתה שמחה')} לקבל</h3>${list(g.partner, `${c.partnerName} עוד לא ${c.pg('כתב', 'כתבה')} כאן.`)}</div>
      <div class="wish-col"><h3 class="mini-h">חוויות לשנינו</h3>${list(g.both, 'ערב ספא, סדנה, לילה במקום יפה.')}</div>
      <div class="wish-col is-private"><h3 class="mini-h">${icon('lock')}מחברת הרמזים שלי</h3>
        <p class="muted small">דברים ש${esc(c.partnerName)} ${c.pg('הזכיר', 'הזכירה')} בדרך אגב. רק ${c.g('אתה רואה', 'את רואה')} את הדף הזה.</p>
        ${list(g.hints, '')}
        <button type="button" class="btn btn-quiet" data-act="new" data-kind="wish" data-private="1" data-for="${c.partner}">${icon('lock')}רמז חדש</button>
      </div>
    </div>
  </section>`;
}

export const dreams = {
  html(r, c) {
    return `<div class="view view-world">
      <header class="world-intro"><p class="eyebrow">חלומות</p><h1 class="world-title">מה שעוד לא קרה</h1>
      <p class="world-line">החלום שנכתב היום הוא התוכנית של מחר.</p></header>
      ${savingsBlock()}
      ${tripsBlock()}
      ${placesBlock()}
      ${homeVision()}
      ${wishesBlock(c)}
    </div>`;
  },
};

// =================== יחד ===================
function tasksBlock(c) {
  const filter = safeLocal('oe-task-filter') || 'mine';
  const open = items('task').filter((t) => t.status !== 'done');
  const pick = {
    mine: open.filter((t) => t.for_person === c.me || t.for_person === 'both'),
    partner: open.filter((t) => t.for_person === c.partner),
    all: open,
  }[filter] || open;
  const sorted = pick.sort((a, b) => String(a.due_date || '9999').localeCompare(String(b.due_date || '9999')) || (a.created_at < b.created_at ? 1 : -1));
  const recentDone = items('task').filter((t) => t.status === 'done').sort((a, b) => String(b.done_at || '').localeCompare(String(a.done_at || ''))).slice(0, 4);
  const seg = (k, l) => `<button type="button" class="seg-btn ${filter === k ? 'is-on' : ''}" data-act="task-filter" data-value="${k}" aria-pressed="${filter === k}">${l}</button>`;
  return `<section>${sectionHead(KINDS.task.title, { sub: KINDS.task.sub, action: addBtn('task') })}
    <div class="seg" role="group" aria-label="סינון משימות">${seg('mine', c.g('שלי ושלנו', 'שלי ושלנו'))}${seg('partner', `של ${esc(c.partnerName)}`)}${seg('all', 'הכל')}</div>
    ${sorted.length ? `<div class="tasks">${sorted.map(taskRow).join('')}</div>` : `${empty(open.length ? 'אין כאן משימות פתוחות.' : 'אין משימות פתוחות. אפשר להתחיל מאלה:')}${open.length ? '' : `${suggestChips(SUGGEST.task_home, 'task', 'data-area="בית"')}${suggestChips(SUGGEST.task_health, 'task', 'data-area="בריאות"')}`}`}
    ${recentDone.length ? `<details class="done-box"><summary>בוצעו לאחרונה (${recentDone.length})</summary><div class="tasks">${recentDone.map(taskRow).join('')}</div></details>` : ''}
  </section>`;
}

function eventsBlock() {
  const today = todayStr();
  const all = items('event');
  const next = all.filter((e) => (e.event_date || '') >= today).sort(byEventAsc);
  return `<section>${sectionHead(KINDS.event.title, { sub: KINDS.event.sub, action: addBtn('event') })}
    ${next.length ? `<div class="rows">${next.slice(0, 5).map(renderCard).join('')}</div>` : empty('חתונה של חברים, ארוחה אצל ההורים, הופעה. מה שבלוח שלנו.')}
    ${allLink('event', all.length)}
  </section>`;
}

function mediaBlock() {
  const all = items('media');
  const order = { doing: 0, want: 1, done: 2 };
  const sorted = all.filter((m) => m.status !== 'done').sort((a, b) => (order[a.status] ?? 1) - (order[b.status] ?? 1) || (a.created_at < b.created_at ? 1 : -1));
  return `<section>${sectionHead(KINDS.media.title, { sub: KINDS.media.sub, action: addBtn('media') })}
    ${sorted.length ? `<div class="rows">${sorted.slice(0, 5).map(renderCard).join('')}</div>` : `${empty('סדרה, ספר או לימוד בחברותא. הנה כמה התחלות ללימוד ביחד:')}`}
    ${suggestChips(SUGGEST.media_learn.filter((s) => !all.some((m) => m.title === s)).slice(0, 4), 'media', 'data-type="לימוד תורה"')}
    ${allLink('media', all.length)}
  </section>`;
}

function recipesBlock() {
  const all = items('recipe');
  const sorted = all.sort((a, b) => (a.status === 'want' ? -1 : 1) - (b.status === 'want' ? -1 : 1) || (a.created_at < b.created_at ? 1 : -1));
  return `<section>${sectionHead(KINDS.recipe.title, { sub: KINDS.recipe.sub, action: addBtn('recipe') })}
    ${sorted.length ? `<div class="rows">${sorted.slice(0, 4).map(renderCard).join('')}</div>${allLink('recipe', all.length)}` : empty('המתכון שלה מהבית, המתכון שלו לשבת, ומה שבא לנו לנסות.')}
  </section>`;
}

export const together = {
  html(r, c) {
    return `<div class="view view-world">
      <header class="world-intro"><p class="eyebrow">יחד</p><h1 class="world-title">החיים עצמם</h1>
      <p class="world-line">הבית, הבריאות, הלוח, ומה שאנחנו רואים, קוראים ולומדים.</p></header>
      ${tasksBlock(c)}
      ${eventsBlock()}
      ${mediaBlock()}
      ${recipesBlock()}
    </div>`;
  },
};

export { timeline };

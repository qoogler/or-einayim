// אור עיניים · full pages: a whole list, the album, answers, a question deck, the weekly letter
import { icon } from '../icons.js';
import { QUESTIONS, DECKS, SUGGEST } from '../content.js';
import { S, items, isMine, markSeen, authorOf } from '../store.js';
import { esc, nl2br, fmtDate, fmtDateLong, relDay, nameOf, hashStr, todayStr, localDay } from '../util.js';
import { avatar, sectionHead, empty, suggestChips } from '../ui.js';
import { KINDS, renderCard, byCreatedDesc, byEventAsc, byEventDesc } from '../kinds.js';
import { timeline } from './worlds.js';

const back = (href, label) => `<a class="back" href="${href}">${icon('chevron-right')}<span>${label}</span></a>`;
const WORLD_OF = { us: ['#/us', 'אנחנו'], story: ['#/story', 'הסיפור'], dreams: ['#/dreams', 'חלומות'], together: ['#/together', 'יחד'] };

// ---------- a whole collection ----------
export const list = {
  html(r, c) {
    const kind = r.arg;
    const k = KINDS[kind];
    if (!k) return `<div class="view">${empty('לא מצאנו את העמוד הזה.')}</div>`;
    const [href, label] = WORLD_OF[k.world] || ['#/', 'היום'];
    let all = items(kind);
    const sorter = ['date', 'event', 'milestone'].includes(kind) ? byEventDesc : byCreatedDesc;
    all = all.sort(sorter);
    const filter = r.query?.s || '';
    const statuses = k.statuses || [];
    const shown = filter ? all.filter((i) => i.status === filter) : all;
    const grid = kind === 'photo' ? 'album' : kind === 'home' ? 'visions' : ['thanks', 'love'].includes(kind) ? 'notes' : kind === 'word' ? 'dict' : kind === 'task' ? 'tasks' : 'rows';
    const sug = { talk: SUGGEST.talk, growth: SUGGEST.growth, trip: SUGGEST.trip, home: SUGGEST.home }[kind];
    return `<div class="view view-page">
      ${back(href, label)}
      <header class="page-head"><h1 class="page-title">${esc(typeof k.title === 'function' ? k.title(c) : k.title)}</h1>
        <p class="sec-sub">${esc(typeof k.sub === 'function' ? k.sub(c) : k.sub)}</p></header>
      <div class="page-tools">
        ${statuses.length ? `<div class="seg" role="group">${[['', 'הכל'], ...statuses].map(([v, l]) => `<a class="seg-btn ${filter === v ? 'is-on' : ''}" href="#/list/${kind}${v ? `?s=${v}` : ''}">${esc(l)}</a>`).join('')}</div>` : '<span></span>'}
        <button type="button" class="btn btn-sm" data-act="${kind === 'photo' ? 'photos' : 'new'}" data-kind="${kind}">${icon('plus')}${kind === 'photo' ? 'להעלות' : 'להוסיף'}</button>
      </div>
      ${shown.length ? `<div class="${grid}">${shown.map(renderCard).join('')}</div>` : `${empty('עוד אין כאן כלום.')}${sug ? suggestChips(sug, kind) : ''}`}
    </div>`;
  },
};

// ---------- album ----------
export const album = {
  html() {
    const all = items('photo').sort((a, b) => String(b.event_date || '').localeCompare(String(a.event_date || '')) || (a.created_at < b.created_at ? 1 : -1));
    let last = '';
    const groups = [];
    for (const p of all) {
      const m = (p.event_date || localDay(p.created_at)).slice(0, 7);
      if (m !== last) { groups.push({ m, list: [] }); last = m; }
      groups[groups.length - 1].list.push(p);
    }
    const monthName = (m) => new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' }).format(new Date(`${m}-15T12:00:00`));
    return `<div class="view view-page">
      ${back('#/story', 'הסיפור')}
      <header class="page-head"><h1 class="page-title">האלבום שלנו</h1><p class="sec-sub">${all.length} תמונות, שמורות רק לשנינו.</p></header>
      <div class="page-tools"><span></span><button type="button" class="btn btn-sm" data-act="photos">${icon('camera')}להעלות</button></div>
      ${groups.length ? groups.map((g) => `<h2 class="mini-h">${monthName(g.m)}</h2><div class="album">${g.list.map(renderCard).join('')}</div>`).join('') : empty('האלבום מחכה לתמונה הראשונה.')}
    </div>`;
  },
};

// ---------- all answers ----------
export const answers = {
  html(r, c) {
    const byDay = {};
    items('answer').forEach((a) => { const d = a.data?.date; if (!d) return; (byDay[d] = byDay[d] || []).push(a); });
    const days = Object.keys(byDay).sort().reverse();
    return `<div class="view view-page">
      ${back('#/us', 'אנחנו')}
      <header class="page-head"><h1 class="page-title">שאלות ותשובות</h1><p class="sec-sub">כל שאלה היא חלון קטן. ככה נראה מה שגילינו עד עכשיו.</p></header>
      ${days.length ? days.map((d) => {
        const list = byDay[d];
        const mine = list.find(isMine);
        const theirs = list.find((a) => !isMine(a));
        const q = list[0].data?.q || '';
        return `<article class="qa-day"><p class="meta">${fmtDateLong(d)}</p><h2 class="qa-q">${esc(q)}</h2>
          ${mine ? `<div class="ans">${avatar(c.me, { size: 'xs' })}<p>${nl2br(mine.body)}</p></div>` : ''}
          ${theirs ? (mine ? `<div class="ans">${avatar(c.partner, { size: 'xs' })}<p>${nl2br(theirs.body)}</p></div>` : `<p class="q-tease">${avatar(c.partner, { size: 'xs' })}התשובה של ${esc(c.partnerName)} תיפתח אחרי ${c.g('שתענה', 'שתעני')}.</p>`) : ''}
        </article>`;
      }).join('') : empty('עוד לא ענינו על שאלות. השאלה של היום מחכה בעמוד הבית.')}
    </div>`;
  },
};

// ---------- a deck of questions ----------
const seen = new Set();
export const deck = {
  html(r, c) {
    const d = DECKS.find((x) => x.key === r.arg) || DECKS[0];
    const pool = QUESTIONS.filter((q) => d.themes.includes(q.th) && (!d.maxD || q.d <= d.maxD) && (!d.minD || q.d >= d.minD));
    const fresh = pool.filter((q) => !seen.has(q.id));
    const list = fresh.length ? fresh : pool;
    const q = list[(hashStr(`${todayStr()}${seen.size}${d.key}`) + seen.size) % list.length];
    seen.add(q.id);
    return `<div class="view view-page view-deck">
      ${back('#/us', 'אנחנו')}
      <header class="page-head"><p class="eyebrow">חפיסה</p><h1 class="page-title">${esc(d.name)}</h1><p class="sec-sub">${esc(d.line)}</p></header>
      <article class="qcard-big" aria-live="polite"><p>${esc(q.t)}</p></article>
      <div class="row-actions deck-actions">
        <button type="button" class="btn" data-act="deck-next">${icon('shuffle')}שאלה אחרת</button>
        <button type="button" class="btn btn-quiet" data-act="suggest" data-kind="talk" data-value="${esc(q.t)}">${icon('book-marked')}לשמור לשיחה</button>
      </div>
      <p class="hint center">טיפ: מי ששואל, רק מקשיב. אחר כך מתחלפים.</p>
    </div>`;
  },
};

// ---------- the weekly letter ----------
const DIR_ACT = { talk: 'talk', date: 'date', thanks: 'thanks', task: 'task', growth: 'growth', milestone: 'milestone', question: 'talk' };
export const letter = {
  html(r, c) {
    const it = S.items.get(r.arg);
    if (!it) return `<div class="view view-page">${back('#/', 'היום')}${empty(S.ready ? 'המכתב לא נמצא.' : 'טוענים...')}</div>`;
    const d = it.data || {};
    const author = authorOf(it);
    return `<div class="view view-page view-letter">
      ${back('#/', 'היום')}
      <article class="letter">
        <p class="eyebrow">מבט מהצד · שבוע של ${fmtDate(d.week || it.created_at.slice(0, 10), true)}</p>
        <h1 class="letter-title">${esc(it.title)}</h1>
        ${d.opening ? `<p class="letter-open">${esc(d.opening)}</p>` : ''}
        ${(d.noticed || []).length ? `<h2 class="letter-h">מה ראינו מהצד</h2>${d.noticed.map((n) => `<p>${esc(n)}</p>`).join('')}` : ''}
        ${d.stage?.reading ? `<h2 class="letter-h">${esc(d.stage.name || 'השלב שלכם')}</h2><p>${esc(d.stage.reading)}</p>` : ''}
        ${(d.directions || []).length ? `<h2 class="letter-h">כיוון לשבוע הקרוב</h2>
          <ol class="directions">${d.directions.map((x, i) => `<li>
            <div><b>${esc(x.title)}</b>${x.why ? `<p>${esc(x.why)}</p>` : ''}</div>
            ${DIR_ACT[x.type] ? `<button type="button" class="pill-btn" data-act="new" data-kind="${DIR_ACT[x.type]}" data-title="${esc(x.title)}">${icon('plus')}${x.type === 'date' ? 'לתכנן' : x.type === 'thanks' ? 'לכתוב' : 'להוסיף'}</button>` : ''}
          </li>`).join('')}</ol>` : ''}
        ${d.question ? `<div class="letter-q"><span>שאלה לשבוע</span><p>${esc(d.question)}</p>
          <button type="button" class="link-btn" data-act="suggest" data-kind="talk" data-value="${esc(d.question)}">${icon('plus')}לשמור לשיחה</button></div>` : ''}
        ${d.closing ? `<p class="letter-close">${esc(d.closing)}</p>` : ''}
        <p class="meta letter-meta">נפתח על ידי ${esc(nameOf(author))} · ${relDay(it.created_at.slice(0, 10))}</p>
      </article>
    </div>`;
  },
  mount(root, r) {
    const it = S.items.get(r.arg);
    if (it && !isMine(it)) markSeen([it]);
  },
};

export const letters = {
  html() {
    const all = items('letter').sort(byCreatedDesc);
    return `<div class="view view-page">
      ${back('#/', 'היום')}
      <header class="page-head"><h1 class="page-title">כל המכתבים</h1><p class="sec-sub">מבט מהצד, שבוע אחרי שבוע.</p></header>
      ${all.length ? `<div class="rows">${all.map((l) => `<a class="row" href="#/letter/${l.id}"><span class="lead-ic">${icon('mail-open')}</span><div class="row-main"><h3 class="row-title">${esc(l.title)}</h3><div class="row-meta"><span>${fmtDate(l.data?.week || l.created_at.slice(0, 10), true)}</span></div></div></a>`).join('')}</div>` : empty('עוד אין מכתבים.')}
    </div>`;
  },
};

export const timelinePage = {
  html() {
    return `<div class="view view-page">
      ${back('#/story', 'הסיפור')}
      <header class="page-head"><h1 class="page-title">הסיפור שלנו</h1><p class="sec-sub">כל הדייטים, הרגעים וקפיצות המדרגה, מהחדש לישן.</p></header>
      ${timeline(500)}
    </div>`;
  },
};

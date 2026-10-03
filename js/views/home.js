// אור עיניים · היום: what is ours to do today
import { icon } from '../icons.js';
import { THOUGHTS, greeting, PEOPLE } from '../content.js';
import { S, items, settings, isMine, markSeen, authorOf } from '../store.js';
import {
  esc, nl2br, clip, todayStr, fmtDateLong, hebDayMonth, hebDate, relDay, daysFromToday, togetherSpan,
  hashStr, fmtDate, nameOf, byG, timeAgo, safeLocal, parseDate, nDays,
} from '../util.js';
import { avatar, iris, sectionHead, bar } from '../ui.js';
import { noteCard, growthCard, KINDS } from '../kinds.js';
import {
  dailyQuestion, answersFor, weekStats, nextDate, datesToLog, upcoming, waiting, memoryOfDay, questSteps,
  startDate, ideasForNow,
} from '../logic.js';

function hero(c) {
  const today = todayStr();
  const start = startDate();
  const span = start ? togetherSpan(start) : null;
  const thought = THOUGHTS[hashStr(today) % THOUGHTS.length];
  const hour = new Date().getHours();
  return `<section class="hero">
    <p class="hero-date">${fmtDateLong(today)} <span class="sep">·</span> ${esc(hebDayMonth(today))}</p>
    <h1 class="hero-hello">${greeting(hour)}, ${esc(c.meName)}</h1>
    ${span ? `<div class="count" aria-label="היום ה-${span.day} שלנו">
        <span class="count-n">${span.day}</span>
        <span class="count-l">הימים שלנו<small>${span.span} · מאז ${fmtDate(start, true)}</small></span>
      </div>` : `<button type="button" class="count count-empty" data-act="onboard"><span class="count-n">?</span><span class="count-l">מתי הכול התחיל?<small>להוסיף את התאריך שלנו</small></span></button>`}
    <p class="hero-thought">${esc(thought)}</p>
  </section>`;
}

function quest(c) {
  if (safeLocal('oe-quest-done')) return '';
  const steps = questSteps(c);
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return '';
  return `<section class="quest" aria-label="הצעדים הראשונים">
    <div class="quest-head"><h2 class="sec-title">הצעדים הראשונים שלנו</h2><span class="quest-n">${done}/${steps.length}</span></div>
    ${bar((done / steps.length) * 100, 'bar-light')}
    <ol class="quest-list">${steps.map((s) => `<li class="${s.done ? 'is-done' : ''}">
      ${s.done ? `<span class="q-check">${icon('check')}</span><span>${esc(s.label)}</span>`
        : `<button type="button" class="q-go" data-act="${s.act}" ${s.kind ? `data-kind="${s.kind}"` : ''} ${s.href ? `data-href="${s.href}"` : ''}><span class="q-dot"></span><span>${esc(s.label)}</span>${icon('chevron-left')}</button>`}
    </li>`).join('')}</ol>
  </section>`;
}

function waitingBlock(c) {
  const w = waiting();
  const rows = [];
  w.notes.slice(0, 3).forEach((n) => {
    if (n.kind === 'nudge') {
      rows.push(`<button type="button" class="wait wait-nudge" data-act="open" data-id="${n.id}">${avatar(c.partner, { size: 'sm' })}
        <span><b>${esc(c.partnerName)} ${c.pg('חשב', 'חשבה')} ${c.g('עליך', 'עלייך')}</b><small>${timeAgo(n.created_at)}</small></span></button>`);
    } else {
      rows.push(`<button type="button" class="wait" data-act="open" data-id="${n.id}">${avatar(c.partner, { size: 'sm' })}
        <span><b>${n.kind === 'thanks' ? `${c.partnerName} ${c.pg('כתב', 'כתבה')} לך תודה` : `${c.partnerName} ${c.pg('כתב', 'כתבה')} מה ${c.pg('הוא אוהב', 'היא אוהבת')} בך`}</b>
        <small>${timeAgo(n.created_at)}</small></span>${icon('mail')}</button>`);
    }
  });
  if (w.letter) rows.push(`<a class="wait" href="#/letter/${w.letter.id}"><span class="wait-ic">${icon('mail-open')}</span><span><b>מכתב השבוע מחכה לך</b><small>${esc(w.letter.title || '')}</small></span>${icon('chevron-left')}</a>`);
  if (w.request) rows.push(`<div class="wait wait-static"><span class="wait-ic">${icon('hand-heart')}</span><span><b>הבקשה של ${esc(c.partnerName)} לשבוע הזה</b><small>${esc(w.request)}</small></span></div>`);
  w.tasks.slice(0, 3).forEach((t) => rows.push(`<button type="button" class="wait" data-act="open" data-id="${t.id}"><span class="wait-ic">${icon('list-checks')}</span><span><b>${esc(t.title)}</b><small>${relDay(t.due_date)}</small></span></button>`));
  if (!rows.length) return '';
  return `<section class="waiting" aria-label="מחכה לך">${sectionHead('מחכה לך')}<div class="wait-list">${rows.join('')}</div></section>`;
}

function questionCard(c) {
  const q = dailyQuestion();
  const { me, partner } = answersFor();
  let state;
  if (!me && !partner) state = `<button type="button" class="btn" data-act="answer-q">לענות</button>`;
  else if (!me && partner) state = `<p class="q-tease">${avatar(c.partner, { size: 'xs' })}${esc(c.partnerName)} כבר ${c.pg('ענה', 'ענתה')}. התשובה ${c.pg('שלו', 'שלה')} תיפתח אחרי ${c.g('שתענה', 'שתעני')}.</p><button type="button" class="btn" data-act="answer-q">לענות ולגלות</button>`;
  else {
    state = `<div class="answers">
      <div class="ans">${avatar(c.me, { size: 'xs' })}<p>${nl2br(me.body)}</p></div>
      ${partner ? `<div class="ans">${avatar(c.partner, { size: 'xs' })}<p>${nl2br(partner.body)}</p></div>`
        : `<p class="muted small">${esc(c.partnerName)} עוד לא ${c.pg('ענה', 'ענתה')}.</p>`}
    </div><button type="button" class="link-btn" data-act="answer-q">${icon('pencil')}עריכה</button>`;
  }
  return `<section class="card qcard">
    <div class="card-eyebrow">${icon('messages-square')}<span>השאלה של היום</span>${q.ai ? '<span class="chip chip-s chip-ai">אישית</span>' : ''}</div>
    <p class="q-text">${esc(q.t)}</p>
    ${q.why ? `<p class="hint">${esc(q.why)}</p>` : ''}
    ${state}
    ${S.ai?.enabled && !q.ai && !me ? `<button type="button" class="link-btn subtle" data-act="ai-question">${icon('wand-sparkles')}שאלה שנכתבה בשבילנו</button>` : ''}
  </section>`;
}

function nextDateCard(c) {
  const d = nextDate();
  const toLog = datesToLog()[0];
  if (d) {
    const n = daysFromToday(d.event_date);
    const planner = d.data?.planner;
    const plannerTxt = planner === 'surprise' ? 'הפתעה' : planner && planner !== 'both' ? `${nameOf(planner)} ${byG(planner, 'מתכנן', 'מתכננת')}` : 'מתכננים ביחד';
    return `<section class="card datecard" data-act="open" data-id="${d.id}">
      <div class="card-eyebrow">${icon('calendar-heart')}<span>הדייט הבא</span></div>
      <div class="datecard-main">
        <div class="countdown"><span class="countdown-n">${n === 0 ? 'היום' : n === 1 ? 'מחר' : n}</span>${n > 1 ? '<span class="countdown-l">ימים</span>' : ''}</div>
        <div><h3 class="datecard-title">${esc(d.title)}</h3>
        <p class="meta">${[fmtDateLong(d.event_date), d.data?.time, d.data?.place].filter(Boolean).map(esc).join(' · ')}</p>
        <p class="meta">${esc(plannerTxt)}</p></div>
      </div>
    </section>`;
  }
  const ideas = ideasForNow(3);
  return `<section class="card datecard is-empty">
    <div class="card-eyebrow">${icon('calendar-heart')}<span>הדייט הבא</span></div>
    ${toLog ? `<p class="nudge-line">${icon('pencil')}<span>איך היה "${esc(toLog.title)}"? </span><button type="button" class="link-btn" data-act="open" data-id="${toLog.id}">לתעד</button></p>` : ''}
    <p class="datecard-q">עוד אין דייט ביומן. מתי נתראה?</p>
    <div class="suggest">${ideas.map((i) => `<button type="button" class="chip chip-add" data-act="new" data-kind="date" data-title="${esc(i.t)}" title="${esc(i.d)}">${icon('plus')}${esc(i.t)}</button>`).join('')}</div>
    <div class="row-actions">
      <button type="button" class="btn" data-act="new" data-kind="date">לתכנן דייט</button>
      ${S.ai?.enabled ? `<button type="button" class="btn btn-quiet" data-act="ai-dates">${icon('wand-sparkles')}רעיונות בשבילנו</button>` : ''}
    </div>
  </section>`;
}

function thanksComposer(c) {
  const today = todayStr();
  const sentToday = items('thanks').some((t) => isMine(t) && !t.data?.by && t.created_at.slice(0, 10) === today);
  const fromPartner = items('thanks').filter((t) => !isMine(t)).sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
  if (sentToday) {
    return `<section class="card thanks-done"><p>${icon('check')}<span>${c.g('אמרת', 'אמרת')} היום תודה ל${esc(c.partnerName)}.</span></p>
      ${fromPartner ? `<button type="button" class="link-btn" data-act="go" data-href="#/us">לצנצנת התודות</button>` : ''}</section>`;
  }
  return `<section class="card thanks-card">
    <div class="card-eyebrow">${icon('heart')}<span>תודה אחת היום</span></div>
    <form class="thanks-quick" data-form="quick-thanks" novalidate>
      <label class="lbl" for="quick-thanks">על מה ${c.g('תרצה', 'תרצי')} להגיד ל${esc(c.partnerName)} תודה היום?</label>
      <textarea id="quick-thanks" name="body" rows="2" placeholder="על הרגע ש..."></textarea>
      <div class="thanks-actions"><button type="submit" class="btn">${icon('send')}לשלוח</button></div>
    </form>
  </section>`;
}

function weekBlock(c) {
  const w = weekStats();
  const segs = [
    { key: 'date', label: 'דייט', v: w.date, text: w.date.n ? (w.date.n === 1 ? 'יש דייט השבוע' : `${w.date.n} דייטים השבוע`) : 'עוד אין', act: w.date.n ? '' : 'new', kind: 'date' },
    { key: 'thanks', label: 'תודות', v: w.thanks, text: `${w.thanks.n} מתוך ${w.thanks.target}`, act: 'new', kind: 'thanks' },
    { key: 'questions', label: 'שאלות היום', v: w.questions, text: w.questions.n ? `${nDays(w.questions.n)} ששנינו ענינו` : (w.questions.any ? 'רק אחד מאיתנו ענה' : 'עוד לא ענינו'), act: 'answer-q' },
    { key: 'talk', label: 'שיחת השבוע', v: w.talk, text: w.talk.n ? 'היה' : 'עוד לא', act: w.talk.n ? '' : 'go', href: '#/talk' },
  ];
  const lit = segs.filter((s) => s.v.value >= 1).length;
  return `<section class="week">
    ${sectionHead('השבוע שלנו', { sub: lit === 4 ? 'שבוע מלא באור. כל הכבוד לשניכם.' : 'כל פעולה קטנה מוסיפה אור.' })}
    <div class="week-body">
      ${iris(segs.map((s) => ({ value: s.v.value })), { size: 128 })}
      <ul class="week-list">${segs.map((s) => `<li class="${s.v.value >= 1 ? 'is-lit' : ''}">
        <span class="wl-dot" aria-hidden="true"></span>
        <span class="wl-txt"><b>${s.label}</b><small>${esc(s.text)}</small></span>
        ${s.act && s.v.value < 1 ? `<button type="button" class="wl-go" data-act="${s.act}" ${s.kind ? `data-kind="${s.kind}"` : ''} ${s.href ? `data-href="${s.href}"` : ''} aria-label="${s.label}">${icon('plus')}</button>` : ''}
      </li>`).join('')}</ul>
    </div>
  </section>`;
}

function focusBlock() {
  const active = items('growth').filter((g) => g.status === 'active').sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
  if (!active.length) return '';
  return `<section>${sectionHead('המיקוד שלנו', { action: { act: 'go', label: 'הכל', attrs: 'data-href="#/us"' } })}${growthCard(active[0])}</section>`;
}

function upcomingBlock() {
  const list = upcoming(40).slice(0, 5);
  if (!list.length) return '';
  return `<section>${sectionHead('עוד מעט')}
    <ul class="soon">${list.map((u) => `<li class="soon-row ${u.tone ? `tone-${u.tone}` : ''}" ${u.id ? `data-act="open" data-id="${u.id}"` : ''}>
      <span class="soon-ic">${icon(u.icon)}</span>
      <span class="soon-txt"><b>${esc(u.title)}</b>${u.sub ? `<small>${esc(u.sub)}</small>` : ''}</span>
      <span class="soon-when">${esc(relDay(u.date))}</span>
    </li>`).join('')}</ul>
  </section>`;
}

function letterBlock(c) {
  const ws = weekStats().ws;
  const letter = items('letter').find((l) => l.data?.week === ws);
  const count = items('letter').length;
  if (letter) {
    const unread = !isMine(letter) && !letter.partner_seen_at;
    return `<section class="card letter-card ${unread ? 'is-fresh' : ''}">
      <div class="card-eyebrow">${icon('mail-open')}<span>מבט מהצד</span></div>
      <h3 class="letter-card-title">${esc(letter.title || 'מכתב השבוע')}</h3>
      <p class="letter-card-open">${esc(clip(letter.data?.opening || letter.body, 140))}</p>
      <div class="row-actions"><a class="btn" href="#/letter/${letter.id}">לקרוא</a>${count > 1 ? '<a class="btn btn-quiet" href="#/letters">כל המכתבים</a>' : ''}</div>
    </section>`;
  }
  if (S.ai?.enabled) {
    return `<section class="card letter-card">
      <div class="card-eyebrow">${icon('mail')}<span>מבט מהצד</span></div>
      <p class="letter-card-open">פעם בשבוע, מכתב שמסתכל עלינו מהצד: מה בלט, איפה אנחנו, ומה כדאי לעשות עכשיו.</p>
      <div class="row-actions"><button type="button" class="btn" data-act="letter">לפתוח את המכתב של השבוע</button>${count ? '<a class="btn btn-quiet" href="#/letters">מכתבים קודמים</a>' : ''}</div>
    </section>`;
  }
  return `<section class="card letter-card is-off">
    <div class="card-eyebrow">${icon('mail')}<span>מבט מהצד</span></div>
    <p class="letter-card-open">מכתב שבועי שמסתכל עלינו מהצד ומציע כיוון. מופעל בהגדרות, פעם אחת.</p>
    <a class="link-btn" href="#/settings#ai">להפעלה</a>
  </section>`;
}

function memoryBlock() {
  const m = memoryOfDay();
  if (!m) return '';
  const k = KINDS[m.kind];
  const when = m.event_date || m.created_at.slice(0, 10);
  const text = m.kind === 'photo' ? '' : esc(clip(m.body || m.title, 160));
  return `<section class="card memory" data-act="open" data-id="${m.id}">
    <div class="card-eyebrow">${icon('rotate-ccw')}<span>זוכרים? ${esc(relDay(when))}</span></div>
    ${m.kind === 'photo' ? `<img class="memory-img" data-photo="${esc(m.data?.path || '')}" alt="">` : ''}
    ${m.data?.photo ? `<img class="memory-img" data-photo="${esc(m.data.photo)}" alt="">` : ''}
    ${m.title && m.kind !== 'moment' ? `<h3 class="row-title">${esc(m.title)}</h3>` : ''}
    ${text && m.kind === 'moment' ? `<p class="memory-text">${text}</p>` : ''}
    <p class="meta">${esc(k?.name || '')} · ${fmtDate(when, true)}</p>
  </section>`;
}

export const home = {
  html(r, c) {
    return `<div class="view view-home">
      ${hero(c)}
      ${quest(c)}
      ${waitingBlock(c)}
      ${questionCard(c)}
      ${nextDateCard(c)}
      ${thanksComposer(c)}
      ${weekBlock(c)}
      ${focusBlock()}
      ${upcomingBlock()}
      ${letterBlock(c)}
      ${memoryBlock()}
      <p class="verse" aria-label="פסוק">מְאוֹר עֵינַיִם יְשַׂמַּח לֵב</p>
    </div>`;
  },
  mount(root, r, c) {
    // nudges are read just by seeing them
    const w = waiting();
    const nudges = w.notes.filter((n) => n.kind === 'nudge');
    if (nudges.length) setTimeout(() => markSeen(nudges), 2500);
  },
};

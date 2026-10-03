// אור עיניים · sheets: add/edit anything, read a note, answer today's question, AI helpers
import { icon } from './icons.js';
import { STAGES, DATE_IDEAS, APP } from './content.js';
import {
  S, sb, addItem, updateItem, deleteItem, uploadPhoto, hydratePhotos, markSeen, saveSettings, updateMe,
  authorOf, isMine, settings, ai, items,
} from './store.js';
import {
  KINDS, QUICK_ADD, kindFields, kindDefaults, kindNewTitle,
} from './kinds.js';
import {
  openSheet, closeSheet, confirmSheet, toast, burst, formHtml, wireForm, readForm, formError, busy, avatar, chip,
} from './ui.js';
import { esc, nl2br, todayStr, fmtDateLong, timeAgo, nameOf, byG, hebDate, weekStart, fmtDate } from './util.js';
import { dailyQuestion, answersFor, ideasForNow } from './logic.js';

const aiOn = () => !!S.ai?.enabled;

export function aiErrorText(e) {
  const code = e?.code;
  if (code === 'no_key') return 'מבט מהצד עוד לא הופעל. אפשר להפעיל אותו בהגדרות.';
  if (code === 'bad_key') return 'המפתח של מבט מהצד לא עובד. כדאי לבדוק אותו בהגדרות.';
  if (code === 'busy') return 'יש עומס רגעי. כדאי לנסות שוב בעוד דקה.';
  if (code === 'network') return 'אין חיבור לרשת כרגע.';
  return 'משהו השתבש בדרך. כדאי לנסות שוב.';
}

// ---------- add / edit ----------
export function openEditor(kind, c, item = null, preset = {}) {
  const def = KINDS[kind];
  if (!def) return;
  const isNew = !item?.id;
  const defaults = kindDefaults(kind, c);
  const base = isNew
    ? { ...defaults, ...preset, data: { ...(defaults.data || {}), ...(preset.data || {}) } }
    : item;
  const fields = kindFields(kind, c, base);
  const helpers = editorHelpers(kind, c, isNew);
  const extra = isNew ? '' : `<button type="button" class="btn btn-quiet btn-danger-text" data-del>${icon('trash-2')}מחיקה</button>`;
  openSheet({
    title: isNew ? kindNewTitle(kind, c, base) : `עריכה: ${def.name}`,
    body: `${helpers}${formHtml(fields, base, { submit: isNew ? 'שמירה' : 'עדכון', extra })}`,
    onMount: (sheet) => {
      const form = sheet.querySelector('form');
      wireForm(form);
      hydratePhotos(sheet);
      wireHelpers(sheet, kind, c);
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const missing = fields.filter((f) => f.required && !String(form.querySelector(`[name="${f.k}"]`)?.value || '').trim());
        if (missing.length) {
          formError(form, `חסר: ${missing.map((f) => f.label).join(', ')}`);
          form.querySelector(`[name="${missing[0].k}"]`)?.focus();
          return;
        }
        const btn = form.querySelector('button[type="submit"]');
        busy(btn, true, 'שומרים...');
        try {
          const { patch, files } = readForm(form, fields);
          for (const [k, file] of Object.entries(files)) {
            const up = await uploadPhoto(file);
            patch.data = patch.data || {};
            patch.data[k.slice(5)] = up.path;
          }
          if (isNew) {
            const row = { kind, ...base, ...patch, data: { ...(base.data || {}), ...(patch.data || {}) } };
            delete row.id;
            if (kind === 'date' && row.status === 'done' && !row.event_date) row.event_date = todayStr();
            await addItem(row);
            closeSheet();
            if (kind === 'thanks' || kind === 'love') { burst(btn); toast(kind === 'thanks' ? `התודה בדרך ל${c.partnerName}` : `נשמר. ${c.partnerName} ${c.pg('יראה', 'תראה')} את זה`); }
            else toast('נשמר');
          } else {
            await updateItem(item.id, patch);
            closeSheet();
            toast('עודכן');
          }
        } catch (err) {
          console.error(err);
          busy(btn, false);
          formError(form, 'לא הצלחנו לשמור. כדאי לבדוק את החיבור ולנסות שוב.');
        }
      });
      sheet.querySelector('[data-del]')?.addEventListener('click', async () => {
        const ok = await confirmSheet({ title: 'למחוק?', text: 'אי אפשר לשחזר אחרי מחיקה.', confirm: 'מחיקה', danger: true });
        if (!ok) return;
        try { await deleteItem(item.id); toast('נמחק'); } catch (_) { toast('המחיקה לא הצליחה', { tone: 'warn' }); }
      });
    },
  });
}

function editorHelpers(kind, c, isNew) {
  if (kind === 'date' && isNew) {
    const ideas = ideasForNow(4, `${todayStr()}-editor`);
    return `<div class="helper">
      <p class="helper-title">${icon('lightbulb')}רעיונות לעכשיו</p>
      <div class="suggest">${ideas.map((i) => `<button type="button" class="chip chip-add" data-fill-title="${esc(i.t)}" title="${esc(i.d)}">${esc(i.t)}</button>`).join('')}</div>
      ${aiOn() ? `<button type="button" class="link-btn" data-ai-ideas>${icon('wand-sparkles')}רעיונות שמתאימים רק לנו</button>` : ''}
    </div>`;
  }
  if (kind === 'thanks' && aiOn()) {
    return `<div class="helper helper-inline"><button type="button" class="link-btn" data-ai-thanks>${icon('wand-sparkles')}לדייק את התודה</button><div data-ai-out></div></div>`;
  }
  if (kind === 'growth' && aiOn()) {
    return `<div class="helper helper-inline"><button type="button" class="link-btn" data-ai-steps>${icon('wand-sparkles')}להציע צעדים קטנים</button></div>`;
  }
  return '';
}

function wireHelpers(sheet, kind, c) {
  sheet.querySelectorAll('[data-fill-title]').forEach((b) => b.addEventListener('click', () => {
    const t = sheet.querySelector('[name="title"]');
    if (t) { t.value = b.dataset.fillTitle; t.focus(); }
  }));
  sheet.querySelector('[data-ai-ideas]')?.addEventListener('click', () => closeSheet(() => openDateIdeas(c)));
  sheet.querySelector('[data-ai-thanks]')?.addEventListener('click', async (e) => {
    const ta = sheet.querySelector('[name="body"]');
    const out = sheet.querySelector('[data-ai-out]');
    if (!ta.value.trim()) { ta.focus(); out.innerHTML = '<p class="hint">כדאי לכתוב קודם כמה מילים משלך.</p>'; return; }
    busy(e.currentTarget, true, 'חושבים...');
    try {
      const { result } = await ai('thanks_help', { text: ta.value });
      out.innerHTML = `<div class="ai-pick">${(result.versions || []).map((v) => `<button type="button" class="ai-option" data-use>${esc(v)}</button>`).join('')}${result.tip ? `<p class="hint">${esc(result.tip)}</p>` : ''}</div>`;
      out.querySelectorAll('[data-use]').forEach((b) => b.addEventListener('click', () => { ta.value = b.textContent; out.innerHTML = ''; ta.focus(); }));
    } catch (err) { out.innerHTML = `<p class="hint">${aiErrorText(err)}</p>`; }
    busy(e.currentTarget, false);
  });
  sheet.querySelector('[data-ai-steps]')?.addEventListener('click', async (e) => {
    const title = sheet.querySelector('[name="title"]').value.trim();
    if (!title) { sheet.querySelector('[name="title"]').focus(); return; }
    busy(e.currentTarget, true, 'חושבים...');
    try {
      const { result } = await ai('growth_steps', { text: title });
      const list = sheet.querySelector('.steps-edit');
      const empties = [...list.querySelectorAll('.step-row')].filter((li) => !li.querySelector('.step-text').value.trim());
      empties.forEach((li) => li.remove());
      (result.steps || []).forEach((s) => {
        const li = document.createElement('li');
        li.className = 'step-row';
        li.innerHTML = `<input type="checkbox" class="step-done" aria-label="בוצע"><input type="text" class="step-text" value="${esc(s)}"><button type="button" class="icon-btn step-del" aria-label="הסרה">${icon('x')}</button>`;
        list.appendChild(li);
      });
    } catch (err) { toast(aiErrorText(err), { tone: 'warn' }); }
    busy(e.currentTarget, false);
  });
}

// ---------- open an item ----------
export function openItem(it, c) {
  if (!it) return;
  if (it.kind === 'letter') { location.hash = `#/letter/${it.id}`; return; }
  if (it.kind === 'thanks' || it.kind === 'love' || it.kind === 'nudge') return openNote(it, c);
  if (it.kind === 'photo') return openPhoto(it, c);
  if (it.kind === 'checkin') return openCheckin(it, c);
  if (it.kind === 'answer') { location.hash = '#/answers'; return; }
  openEditor(it.kind, c, it);
}

function openNote(it, c) {
  const by = authorOf(it);
  const mine = isMine(it) && !it.data?.by;
  if (!isMine(it)) markSeen([it]);
  const reacted = !!it.data?.reaction;
  const title = it.kind === 'thanks' ? 'תודה' : c.g('חשבו עליך', 'חשבו עלייך');
  const body = it.kind === 'nudge'
    ? `<p class="note-big">${esc(nameOf(by))} ${byG(by, 'חשב', 'חשבה')} ${byG(c.me, 'עליך', 'עלייך')}.</p>`
    : `<p class="note-big">${nl2br(it.body)}</p>`;
  openSheet({
    title: it.kind === 'love' ? (by === 'yiska' ? 'מה אני אוהבת בך' : 'מה אני אוהב בך') : title,
    className: 'sheet-note',
    body: `${body}
      <p class="meta note-sig">${avatar(by, { size: 'sm' })}<span>${esc(nameOf(by))}</span><span class="sep">·</span><span>${fmtDateLong(it.created_at.slice(0, 10))}</span></p>
      <div class="row-actions">
        ${!isMine(it) && it.kind !== 'nudge' ? `<button type="button" class="btn ${reacted ? 'btn-quiet' : ''}" data-react>${icon('heart')}${reacted ? 'נגע ללב' : 'נגע לי בלב'}</button>` : ''}
        ${it.kind !== 'nudge' && !isMine(it) ? `<button type="button" class="btn btn-quiet" data-reply>${icon('send')}לכתוב תודה בחזרה</button>` : ''}
        ${mine ? `<button type="button" class="btn btn-quiet" data-edit>${icon('pencil')}עריכה</button>` : ''}
      </div>`,
    onMount: (sheet) => {
      sheet.querySelector('[data-react]')?.addEventListener('click', async (e) => {
        try {
          await updateItem(it.id, { data: { reaction: reacted ? null : 'heart' } });
          if (!reacted) burst(e.currentTarget);
          closeSheet();
        } catch (_) { toast('לא הצלחנו לשמור', { tone: 'warn' }); }
      });
      sheet.querySelector('[data-reply]')?.addEventListener('click', () => closeSheet(() => openEditor('thanks', c)));
      sheet.querySelector('[data-edit]')?.addEventListener('click', () => closeSheet(() => openEditor(it.kind, c, it)));
    },
  });
}

function openPhoto(it, c) {
  openSheet({
    title: it.title || 'תמונה',
    className: 'sheet-photo',
    body: `<figure class="lightbox"><img data-photo="${esc(it.data?.path || '')}" alt="${esc(it.title || '')}"></figure>
      <p class="meta">${avatar(authorOf(it), { size: 'xs' })}<span>${it.event_date ? fmtDate(it.event_date, true) : timeAgo(it.created_at)}</span></p>
      <div class="row-actions">
        <button type="button" class="btn btn-quiet" data-edit>${icon('pencil')}כיתוב ותאריך</button>
        <button type="button" class="btn btn-quiet btn-danger-text" data-del>${icon('trash-2')}מחיקה</button>
      </div>`,
    onMount: (sheet) => {
      hydratePhotos(sheet);
      sheet.querySelector('[data-edit]').addEventListener('click', () => closeSheet(() => openEditor('photo', c, it)));
      sheet.querySelector('[data-del]').addEventListener('click', async () => {
        const ok = await confirmSheet({ title: 'למחוק את התמונה?', text: 'היא תימחק לשנינו.', confirm: 'מחיקה', danger: true });
        if (!ok) return;
        try {
          await deleteItem(it.id);
          if (it.data?.path) await sb.storage.from('photos').remove([it.data.path]);
          toast('נמחקה');
        } catch (_) { toast('המחיקה לא הצליחה', { tone: 'warn' }); }
      });
    },
  });
}

function openCheckin(it) {
  const d = it.data || {};
  const list = (arr) => (arr || []).filter(Boolean).map((x) => `<li>${esc(x)}</li>`).join('');
  openSheet({
    title: `שיחת השבוע · ${fmtDate(d.week || it.created_at.slice(0, 10), true)}`,
    body: `<div class="recap">
      ${d.good ? `<h3>מה היה טוב</h3><p>${nl2br(d.good)}</p>` : ''}
      ${d.hard ? `<h3>מה היה קשה</h3><p>${nl2br(d.hard)}</p>` : ''}
      ${d.agreed ? `<h3>מה סיכמנו</h3><p>${nl2br(d.agreed)}</p>` : ''}
      ${d.asks ? `<h3>הבקשות לשבוע</h3><ul>${list([d.asks.orel ? `אוראל: ${d.asks.orel}` : '', d.asks.yiska ? `יסכה: ${d.asks.yiska}` : ''])}</ul>` : ''}
      ${d.close ? `<h3>מחכים ל...</h3><ul>${list([d.close.orel ? `אוראל: ${d.close.orel}` : '', d.close.yiska ? `יסכה: ${d.close.yiska}` : ''])}</ul>` : ''}
    </div>`,
  });
}

// ---------- quick add ----------
export function openQuickAdd(c) {
  openSheet({
    title: 'מה בא לך להוסיף?',
    className: 'sheet-quick',
    body: QUICK_ADD.map((g) => `<div class="qa-group"><p class="qa-title">${g.group}</p><div class="qa-wrap">${g.kinds.map((k) =>
      `<button type="button" class="qa" data-qa="${k}">${icon(KINDS[k].icon)}<span>${k === 'love' ? c.g('מה אני אוהב', 'מה אני אוהבת') : k === 'wish' ? 'משאלה או רמז' : KINDS[k].name}</span></button>`).join('')}</div></div>`).join(''),
    onMount: (sheet) => {
      sheet.querySelectorAll('[data-qa]').forEach((b) => b.addEventListener('click', () => {
        const k = b.dataset.qa;
        if (k === 'photo') closeSheet(() => pickPhotos(c));
        else closeSheet(() => openEditor(k, c));
      }));
    },
  });
}

// ---------- photos ----------
export function pickPhotos(c, preset = {}) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = true;
  input.onchange = async () => {
    const files = [...(input.files || [])].slice(0, 20);
    if (!files.length) return;
    toast(files.length > 1 ? `מעלים ${files.length} תמונות...` : 'מעלים...', { ms: 1800 });
    let ok = 0;
    for (const f of files) {
      try {
        const up = await uploadPhoto(f);
        const when = f.lastModified ? new Date(f.lastModified) : new Date();
        await addItem({ kind: 'photo', title: preset.title || null, event_date: preset.event_date || todayStr(), data: { path: up.path, w: up.w, h: up.h, taken: when.toISOString() } });
        ok++;
      } catch (e) { console.error(e); }
    }
    toast(ok === files.length ? (ok > 1 ? `${ok} תמונות נוספו לאלבום` : 'התמונה נוספה לאלבום') : `נוספו ${ok} מתוך ${files.length}`, { tone: ok ? 'good' : 'warn' });
  };
  input.click();
}

// ---------- today's question ----------
export function openAnswer(c) {
  const day = todayStr();
  const q = dailyQuestion(day);
  const { me } = answersFor(day);
  openSheet({
    title: 'השאלה של היום',
    body: `<p class="q-big">${esc(q.t)}</p>
      <form class="form" id="answer-form" novalidate>
        <div class="field"><label class="lbl" for="answer-text">${c.g('התשובה שלך', 'התשובה שלך')}</label>
          <textarea id="answer-text" rows="5" autofocus placeholder="אין תשובה לא נכונה">${esc(me?.body || '')}</textarea></div>
        <p class="hint">${c.partnerName} ${c.pg('יראה', 'תראה')} את התשובה שלך אחרי ${c.pg('שיענה', 'שתענה')} בעצמ${c.pg('ו', 'ה')}.</p>
        <p class="form-error" role="alert" hidden></p>
        <div class="form-actions"><button type="submit" class="btn btn-block">${me ? 'עדכון' : 'שמירה'}</button></div>
      </form>`,
    onMount: (sheet) => {
      const form = sheet.querySelector('form');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = sheet.querySelector('#answer-text').value.trim();
        if (!text) { formError(form, 'כמה מילים מספיקות.'); return; }
        const btn = form.querySelector('button[type="submit"]');
        busy(btn, true, 'שומרים...');
        try {
          if (me) await updateItem(me.id, { body: text });
          else await addItem({ kind: 'answer', body: text, data: { date: day, qid: q.id, q: q.t } });
          closeSheet();
          toast('נשמר');
        } catch (_) { busy(btn, false); formError(form, 'לא הצלחנו לשמור. כדאי לנסות שוב.'); }
      });
    },
  });
}

export async function customQuestion(c, btn) {
  busy(btn, true, 'חושבים על שאלה...');
  try {
    const { result } = await ai('question');
    if (!result?.question) throw new Error('empty');
    await saveSettings({ q_custom: { date: todayStr(), text: result.question, why: result.why || '' } });
    toast('השאלה של היום הוחלפה לשאלה אישית');
  } catch (e) { toast(aiErrorText(e), { tone: 'warn' }); }
  busy(btn, false);
}

// ---------- onboarding: our dates ----------
export function openOnboarding(c, { first = false } = {}) {
  const st = settings();
  openSheet({
    title: first ? 'רגע לפני שמתחילים' : 'התאריכים שלנו',
    body: `${first ? `<p class="muted">כמה פרטים קטנים, כדי שהאפליקציה תכיר אתכם. אפשר לשנות הכל אחר כך בהגדרות.</p>` : ''}
      <form class="form" id="onboard-form" novalidate>
        <div class="field"><label class="lbl" for="ob-met">מתי הכרנו</label><input id="ob-met" type="date" value="${esc(st.met_date || '')}"></div>
        <div class="field"><label class="lbl" for="ob-first">הדייט הראשון</label><input id="ob-first" type="date" value="${esc(st.first_date || '')}"><p class="hint">מכאן סופרים את הימים שלנו.</p></div>
        <div class="field"><label class="lbl" for="ob-bday">יום ההולדת שלך</label><input id="ob-bday" type="date" value="${esc(S.me?.birthday || '')}"></div>
        <fieldset class="field"><legend class="lbl">באיזה שלב אנחנו מרגישים</legend>
          <div class="chips">${STAGES.map((s) => `<label class="chip-radio"><input type="radio" name="ob-stage" value="${s.key}" ${(st.stage || 'discover') === s.key ? 'checked' : ''}><span>${s.name}</span></label>`).join('')}</div>
        </fieldset>
        <div class="field"><label class="lbl" for="ob-loc">איפה אנחנו בתקופה הזאת <span class="opt">(לא חובה)</span></label><input id="ob-loc" type="text" value="${esc(st.location || '')}" placeholder="עיר, מדינה"></div>
        <p class="form-error" role="alert" hidden></p>
        <div class="form-actions"><button type="submit" class="btn btn-block">${first ? 'מתחילים' : 'שמירה'}</button></div>
      </form>`,
    onMount: (sheet) => {
      const form = sheet.querySelector('form');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('button[type="submit"]');
        busy(btn, true, 'שומרים...');
        try {
          const patch = {
            met_date: sheet.querySelector('#ob-met').value || null,
            first_date: sheet.querySelector('#ob-first').value || sheet.querySelector('#ob-met').value || null,
            stage: sheet.querySelector('input[name="ob-stage"]:checked')?.value || 'discover',
            location: sheet.querySelector('#ob-loc').value.trim() || null,
          };
          await saveSettings(patch);
          const bday = sheet.querySelector('#ob-bday').value || null;
          if (bday !== (S.me?.birthday || null)) await updateMe({ birthday: bday });
          closeSheet();
          toast('נשמר');
        } catch (_) { busy(btn, false); formError(form, 'לא הצלחנו לשמור. כדאי לנסות שוב.'); }
      });
    },
  });
}

// ---------- welcome for the one who joins second ----------
export function openWelcome(c) {
  openSheet({
    title: `${c.g('ברוך הבא', 'ברוכה הבאה')} הביתה`,
    body: `<p class="note-big">${esc(c.partnerName)} ${c.pg('הכין', 'הכינה')} לנו כאן בית קטן.</p>
      <p class="muted">כל מה שנכתוב כאן משותף לשנינו, חוץ ממחברת הרמזים, שכל אחד רואה רק את שלו. דבר אחד קטן לפני שמתחילים:</p>
      <form class="form" id="welcome-form" novalidate>
        <div class="field"><label class="lbl" for="w-bday">יום ההולדת שלך</label><input id="w-bday" type="date"></div>
        <div class="form-actions"><button type="submit" class="btn btn-block">נכנסים</button></div>
      </form>`,
    onMount: (sheet) => {
      sheet.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const v = sheet.querySelector('#w-bday').value || null;
        try { if (v) await updateMe({ birthday: v }); } catch (_) { /* can be set later in settings */ }
        closeSheet();
      });
    },
  });
}

// ---------- invite the other one ----------
export async function openInvite(c) {
  let code = '';
  try { const { data } = await sb.rpc('invite_code'); code = data || ''; } catch (_) { /* shown without code */ }
  const url = location.origin + location.pathname.replace(/index\.html$/, '');
  const text = `${c.partnerName}, ${c.g('בניתי', 'בניתי')} לנו בית קטן: ${APP.name}. ${c.pg('היכנס', 'היכנסי')} ל-${url}, ${c.pg('בחר', 'בחרי')} "אני ${c.partnerName}" ו${c.pg('הצטרף', 'הצטרפי')} עם קוד הבית: ${code}`;
  openSheet({
    title: `להזמין את ${c.partnerName}`,
    body: `<ol class="steps-list">
        <li>${c.pg('הוא נכנס', 'היא נכנסת')} לכתובת <b dir="ltr">${esc(url.replace('https://', ''))}</b></li>
        <li>${c.pg('בוחר', 'בוחרת')} "אני ${c.partnerName}" ואז "פעם ראשונה כאן"</li>
        <li>${c.pg('מקליד', 'מקלידה')} את קוד הבית, מייל וסיסמה</li>
      </ol>
      ${code ? `<div class="codebox"><span class="lbl">קוד הבית</span><b dir="ltr">${esc(code)}</b></div>` : ''}
      <div class="row-actions">
        <button type="button" class="btn" data-share>${icon('send')}לשלוח ל${c.partnerName}</button>
        <button type="button" class="btn btn-quiet" data-copy>העתקה</button>
      </div>`,
    onMount: (sheet) => {
      sheet.querySelector('[data-share]').addEventListener('click', async () => {
        if (navigator.share) {
          try { await navigator.share({ title: APP.name, text }); return; } catch (_) { return; }
        }
        try { await navigator.clipboard.writeText(text); toast('ההזמנה הועתקה. אפשר להדביק בווטסאפ'); } catch (_) { toast('לא הצלחנו להעתיק', { tone: 'warn' }); }
      });
      sheet.querySelector('[data-copy]').addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(text); toast('הועתק'); } catch (_) { toast('לא הצלחנו להעתיק', { tone: 'warn' }); }
      });
    },
  });
}

// ---------- AI: date ideas ----------
export function openDateIdeas(c) {
  openSheet({
    title: 'רעיונות לדייט הבא',
    body: `<form class="form" id="ideas-form">
        <div class="field"><label class="lbl" for="idea-mood">מה בא לנו?</label><input id="idea-mood" type="text" placeholder="למשל: משהו רגוע בחוץ, או הרפתקה קטנה"></div>
        <fieldset class="field"><legend class="lbl">תקציב</legend><div class="chips">${['חינם', 'זול', 'בינוני', 'מפנק'].map((b, i) => `<label class="chip-radio"><input type="radio" name="idea-budget" value="${b}" ${i === 1 ? 'checked' : ''}><span>${b}</span></label>`).join('')}</div></fieldset>
        <div class="form-actions"><button type="submit" class="btn btn-block">${icon('wand-sparkles')}להציע רעיונות</button></div>
      </form>
      <div class="ideas-out" aria-live="polite"></div>`,
    onMount: (sheet) => {
      const form = sheet.querySelector('form');
      const out = sheet.querySelector('.ideas-out');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('button[type="submit"]');
        busy(btn, true, 'חושבים עליכם...');
        out.innerHTML = '<div class="thinking"><i></i><i></i><i></i></div>';
        try {
          const { result } = await ai('date_ideas', { mood: sheet.querySelector('#idea-mood').value, budget: sheet.querySelector('input[name="idea-budget"]:checked')?.value });
          out.innerHTML = (result.ideas || []).map((i, n) => `<article class="idea">
              <h3>${esc(i.title)}</h3><p>${esc(i.description)}</p>
              ${i.why ? `<p class="idea-why">${esc(i.why)}</p>` : ''}
              <p class="meta">${[i.cost, i.duration, i.where].filter(Boolean).map(esc).join(' · ')}</p>
              <button type="button" class="pill-btn" data-plan="${n}">${icon('calendar-heart')}לתכנן את זה</button>
            </article>`).join('');
          out.querySelectorAll('[data-plan]').forEach((b) => b.addEventListener('click', () => {
            const i = result.ideas[Number(b.dataset.plan)];
            closeSheet(() => openEditor('date', c, null, { title: i.title, data: { place: i.where || '' } }));
          }));
        } catch (err) { out.innerHTML = `<p class="hint">${aiErrorText(err)}</p>`; }
        busy(btn, false);
      });
    },
  });
}

// ---------- AI: preparing a hard conversation (private) ----------
export function openTalkPrep(c) {
  openSheet({
    title: 'הכנה לשיחה שקשה להתחיל',
    body: `<p class="muted">רק ${c.g('אתה רואה', 'את רואה')} את זה. שום דבר לא נשמר.</p>
      <form class="form" id="prep-form">
        <div class="field"><label class="lbl" for="prep-text">מה ${c.g('היית רוצה', 'היית רוצה')} להעלות?</label>
          <textarea id="prep-text" rows="4" placeholder="בלי לסנן. רק בשבילך."></textarea></div>
        <div class="form-actions"><button type="submit" class="btn btn-block">${icon('wand-sparkles')}לעזור לי לנסח</button></div>
      </form>
      <div class="prep-out" aria-live="polite"></div>`,
    onMount: (sheet) => {
      const form = sheet.querySelector('form');
      const out = sheet.querySelector('.prep-out');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = sheet.querySelector('#prep-text').value.trim();
        if (!text) return;
        const btn = form.querySelector('button[type="submit"]');
        busy(btn, true, 'חושבים...');
        out.innerHTML = '<div class="thinking"><i></i><i></i><i></i></div>';
        try {
          const { result: r } = await ai('talk_prep', { text });
          out.innerHTML = `<div class="prep">
            ${r.opening ? `<h3>איך לפתוח</h3><p class="prep-quote">${esc(r.opening)}</p>` : ''}
            ${r.feel ? `<h3>מה אני ${c.g('מרגיש', 'מרגישה')}</h3><p>${esc(r.feel)}</p>` : ''}
            ${r.need ? `<h3>מה אני ${c.g('צריך', 'צריכה')}</h3><p>${esc(r.need)}</p>` : ''}
            ${r.listen?.length ? `<h3>שאלות להקשבה</h3><ul>${r.listen.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
            ${r.avoid ? `<h3>כדאי להימנע</h3><p>${esc(r.avoid)}</p>` : ''}
            ${r.timing ? `<h3>מתי ואיפה</h3><p>${esc(r.timing)}</p>` : ''}
          </div>`;
        } catch (err) { out.innerHTML = `<p class="hint">${aiErrorText(err)}</p>`; }
        busy(btn, false);
      });
    },
  });
}

// ---------- savings: add an amount ----------
export function openSavingAdd(it) {
  const cur = it.data?.currency || '₪';
  openSheet({
    title: `להוסיף ל: ${it.title}`,
    className: 'sheet-small',
    body: `<form class="form" novalidate>
      <div class="field"><label class="lbl" for="save-amt">כמה (${esc(cur)})</label><input id="save-amt" type="number" inputmode="decimal" min="0" step="any" autofocus></div>
      <p class="form-error" role="alert" hidden></p>
      <div class="form-actions"><button type="submit" class="btn btn-block">הוספה</button></div></form>`,
    onMount: (sheet) => {
      const form = sheet.querySelector('form');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const v = Number(String(sheet.querySelector('#save-amt').value).replace(',', '.'));
        if (!v) { formError(form, 'כדאי להזין סכום'); return; }
        const saved = (Number(it.data?.saved) || 0) + v;
        const log = [...(it.data?.log || []), { amount: v, at: new Date().toISOString(), by: S.me?.person }].slice(-100);
        try {
          await updateItem(it.id, { data: { saved, log } });
          closeSheet();
          const t = Number(it.data?.target) || 0;
          toast(t && saved >= t ? 'הגעתם ליעד. מגיע לכם לחגוג' : 'נוסף לחיסכון', { tone: 'good' });
        } catch (_) { formError(form, 'לא הצלחנו לשמור'); }
      });
    },
  });
}

// ---------- "thinking of you" ----------
let lastNudge = 0;
export async function sendNudge(c, el) {
  if (!S.members[c.partner]?.joined_at) { openInvite(c); return; }
  if (Date.now() - lastNudge < 60 * 1000) { toast('כבר נשלח לפני רגע'); return; }
  lastNudge = Date.now();
  burst(el);
  try {
    await addItem({ kind: 'nudge', for_person: c.partner, body: null });
    toast(`${c.partnerName} ${c.pg('ידע', 'תדע')} ש${c.g('חשבת', 'חשבת')} ${c.pg('עליו', 'עליה')}`);
  } catch (_) { toast('לא נשלח. כדאי לנסות שוב', { tone: 'warn' }); }
}

// ---------- the weekly letter ----------
export async function openOrWriteLetter(c, btn) {
  const ws = weekStart();
  const existing = items('letter').find((l) => l.data?.week === ws);
  if (existing) { location.hash = `#/letter/${existing.id}`; return; }
  if (!aiOn()) { location.hash = '#/settings'; toast('כדי לקבל מכתב, צריך להפעיל את מבט מהצד'); return; }
  busy(btn, true, 'כותבים לכם...');
  try {
    const res = await ai('letter', { week: ws });
    if (res.item) {
      S.items.set(res.item.id, res.item);
      location.hash = `#/letter/${res.item.id}`;
    }
  } catch (e) { toast(aiErrorText(e), { tone: 'warn' }); }
  busy(btn, false);
}

export { aiOn, hebDate };

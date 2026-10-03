// אור עיניים · הגדרות
import { icon } from '../icons.js';
import { STAGES, WEEK_DAYS, APP } from '../content.js';
import { APP_VERSION } from '../config.js';
import { S, settings, saveSettings, updateMe, setAiKey, ai, refreshAiStatus, signOut, exportAll } from '../store.js';
import { esc, fmtDate, safeLocal, todayStr } from '../util.js';
import { toast, busy, sectionHead, avatar, confirmSheet } from '../ui.js';
import { aiErrorText, openInvite } from '../sheets.js';

export function applyTheme(mode = safeLocal('oe-theme') || 'system') {
  const root = document.documentElement;
  if (mode === 'light' || mode === 'dark') root.setAttribute('data-theme', mode);
  else root.removeAttribute('data-theme');
}

export const settingsView = {
  html(r, c) {
    const st = settings();
    const theme = safeLocal('oe-theme') || 'system';
    const ai = S.ai || {};
    const partnerJoined = !!S.members[c.partner]?.joined_at;
    return `<div class="view view-page view-settings">
      <a class="back" href="#/">${icon('chevron-right')}<span>היום</span></a>
      <header class="page-head"><h1 class="page-title">הגדרות</h1><p class="sec-sub">הכל כאן משותף לשנינו, חוץ מהמראה ומהחשבון האישי.</p></header>

      <section class="card" id="dates">
        <h2 class="sec-title">התאריכים והשלב שלנו</h2>
        <form class="form" data-form="settings-core" novalidate>
          <div class="two">
            <div class="field"><label class="lbl" for="s-met">מתי הכרנו</label><input id="s-met" name="met_date" type="date" value="${esc(st.met_date || '')}"></div>
            <div class="field"><label class="lbl" for="s-first">הדייט הראשון</label><input id="s-first" name="first_date" type="date" value="${esc(st.first_date || '')}"></div>
          </div>
          <fieldset class="field" id="stage"><legend class="lbl">השלב שלנו</legend>
            <div class="stage-pick">${STAGES.map((s) => `<label class="stage-opt"><input type="radio" name="stage" value="${s.key}" ${(st.stage || 'discover') === s.key ? 'checked' : ''}><span><b>${esc(s.name)}</b><small>${esc(s.line)}</small></span></label>`).join('')}</div>
          </fieldset>
          <div class="field"><label class="lbl" for="s-day">היום הקבוע לשיחת השבוע</label>
            <select id="s-day" name="weekly_day">${WEEK_DAYS.map((d) => `<option value="${d.key}" ${(st.weekly_day || 'fri') === d.key ? 'selected' : ''}>${d.name}</option>`).join('')}</select></div>
          <div class="field"><label class="lbl" for="s-loc">איפה אנחנו בתקופה הזאת</label><input id="s-loc" name="location" type="text" value="${esc(st.location || '')}" placeholder="עיר, מדינה"></div>
          <div class="field"><label class="lbl" for="s-about">מה חשוב שמבט מהצד יידע עלינו</label>
            <textarea id="s-about" name="about_us" rows="4" placeholder="למשל: שומרים שבת וכשרות, אוהבים טבע ואוכל טוב, מעדיפים ערבים שקטים...">${esc(st.about_us || '')}</textarea>
            <p class="hint">עוזר למכתבים, לשאלות ולרעיונות להתאים בדיוק לכם.</p></div>
          <div class="form-actions"><button type="submit" class="btn">שמירה</button></div>
        </form>
      </section>

      <section class="card" id="me">
        <h2 class="sec-title">${avatar(c.me, { size: 'sm' })}${esc(c.meName)}</h2>
        <form class="form" data-form="settings-me" novalidate>
          <div class="field"><label class="lbl" for="s-bday">יום ההולדת שלך</label><input id="s-bday" name="birthday" type="date" value="${esc(S.me?.birthday || '')}"></div>
          <div class="form-actions"><button type="submit" class="btn btn-quiet">שמירה</button></div>
        </form>
        <p class="meta">מחובר${c.g('', 'ת')} בתור <span dir="ltr">${esc(S.user?.email || '')}</span></p>
      </section>

      <section class="card" id="ai">
        <h2 class="sec-title">${icon('wand-sparkles')}מבט מהצד</h2>
        <p class="muted">מכתב שבועי, שאלות אישיות, רעיונות לדייטים ועזרה בניסוח. עובד עם מפתח של Claude מ-console.anthropic.com. העלות לזוג היא סנטים בודדים בחודש.</p>
        <p class="ai-state ${ai.enabled ? 'is-on' : ''}">${ai.enabled ? `${icon('circle-check')}פעיל${ai.updated_at ? ` מאז ${fmtDate(ai.updated_at.slice(0, 10), true)}` : ''}` : `${icon('circle')}עוד לא פעיל`}</p>
        <form class="form" data-form="settings-ai" novalidate>
          <div class="field"><label class="lbl" for="s-key">${ai.enabled ? 'להחליף מפתח' : 'מפתח API'}</label>
            <input id="s-key" name="key" type="password" dir="ltr" autocomplete="off" placeholder="sk-ant-..."></div>
          <p class="hint">המפתח נשמר בשרת בלבד, ואי אפשר לקרוא אותו מהאפליקציה.</p>
          <div class="field"><label class="lbl" for="s-model">מודל</label>
            <select id="s-model" name="ai_model">${[['claude-sonnet-5-5', 'Claude Sonnet 5.5 · מאוזן (מומלץ)'], ['claude-opus-5-5', 'Claude Opus 5.5 · הכי מעמיק'], ['claude-haiku-4-5-20251001', 'Claude Haiku 4.5 · הכי מהיר']].map(([v, l]) => `<option value="${v}" ${(st.ai_model || 'claude-sonnet-5-5') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
          <div class="form-actions"><button type="submit" class="btn">שמירה ובדיקה</button>${ai.enabled ? '<button type="button" class="btn btn-quiet btn-danger-text" data-act="ai-off">כיבוי</button>' : ''}</div>
        </form>
      </section>

      <section class="card" id="links">
        <h2 class="sec-title">${icon('link')}קישורים משותפים</h2>
        <form class="form" data-form="settings-links" novalidate>
          <div class="field"><label class="lbl" for="s-pl">הפלייליסט שלנו</label><input id="s-pl" name="playlist_url" type="url" dir="ltr" value="${esc(st.playlist_url || '')}" placeholder="https://open.spotify.com/playlist/..."></div>
          <div class="field"><label class="lbl" for="s-al">אלבום משותף נוסף <span class="opt">(למשל Google Photos)</span></label><input id="s-al" name="album_url" type="url" dir="ltr" value="${esc(st.album_url || '')}" placeholder="https://photos.app.goo.gl/..."></div>
          <div class="form-actions"><button type="submit" class="btn btn-quiet">שמירה</button></div>
        </form>
      </section>

      <section class="card">
        <h2 class="sec-title">${icon('users')}${partnerJoined ? `${esc(c.partnerName)} כאן` : `להזמין את ${esc(c.partnerName)}`}</h2>
        <p class="muted">${partnerJoined ? `${esc(c.partnerName)} ${c.pg('מחובר', 'מחוברת')}. כל מה שנכתב משותף לשניכם, חוץ ממחברת הרמזים.` : `ברגע ש${esc(c.partnerName)} ${c.pg('יצטרף', 'תצטרף')}, כל מה שכבר כתבת יחכה ${c.pg('לו', 'לה')}.`}</p>
        <button type="button" class="btn btn-quiet" data-act="invite">${icon('send')}${partnerJoined ? 'קוד הבית' : 'לשלוח הזמנה'}</button>
      </section>

      <section class="card">
        <h2 class="sec-title">${icon('sun')}מראה</h2>
        <div class="seg" role="group" aria-label="ערכת צבעים">${[['system', 'לפי המכשיר'], ['light', 'יום'], ['dark', 'לילה']].map(([v, l]) => `<button type="button" class="seg-btn ${theme === v ? 'is-on' : ''}" data-act="theme" data-value="${v}" aria-pressed="${theme === v}">${l}</button>`).join('')}</div>
      </section>

      <section class="card">
        <h2 class="sec-title">${icon('download')}להתקין כאפליקציה</h2>
        <p class="muted"><b>באייפון:</b> לפתוח בספארי, ללחוץ על כפתור השיתוף, ואז "הוספה למסך הבית".</p>
        <p class="muted"><b>באנדרואיד:</b> לפתוח בכרום, תפריט שלוש הנקודות, ואז "התקנת אפליקציה".</p>
      </section>

      <section class="card about-name">
        <h2 class="sec-title">על השם</h2>
        ${APP.about.map((l) => `<p>${esc(l)}</p>`).join('')}
        <p class="verse-inline">${APP.verse} <small>(${APP.verseRef})</small></p>
      </section>

      <section class="card">
        <h2 class="sec-title">${icon('download')}גיבוי</h2>
        <p class="muted">קובץ אחד עם כל מה שכתבנו. כדאי לשמור עותק מדי פעם.</p>
        <button type="button" class="btn btn-quiet" data-act="export">להוריד גיבוי</button>
      </section>

      <div class="settings-foot">
        <button type="button" class="btn btn-quiet btn-danger-text" data-act="signout">${icon('log-out')}יציאה מהחשבון</button>
        <p class="meta">אור עיניים · גרסה ${APP_VERSION}</p>
      </div>
    </div>`;
  },
  mount(root, r, c) {
    const form = (name) => root.querySelector(`[data-form="${name}"]`);
    form('settings-core')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      const btn = f.querySelector('[type="submit"]');
      busy(btn, true, 'שומרים...');
      try {
        await saveSettings({
          met_date: f.met_date.value || null,
          first_date: f.first_date.value || f.met_date.value || null,
          stage: f.querySelector('input[name="stage"]:checked')?.value || 'discover',
          weekly_day: f.weekly_day.value,
          location: f.location.value.trim() || null,
          about_us: f.about_us.value.trim() || null,
        });
        toast('נשמר');
      } catch (_) { toast('לא הצלחנו לשמור', { tone: 'warn' }); }
      busy(btn, false);
    });
    form('settings-me')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      try { await updateMe({ birthday: f.birthday.value || null }); toast('נשמר'); } catch (_) { toast('לא הצלחנו לשמור', { tone: 'warn' }); }
    });
    form('settings-links')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      try { await saveSettings({ playlist_url: f.playlist_url.value.trim() || null, album_url: f.album_url.value.trim() || null }); toast('נשמר'); } catch (_) { toast('לא הצלחנו לשמור', { tone: 'warn' }); }
    });
    form('settings-ai')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      const btn = f.querySelector('[type="submit"]');
      busy(btn, true, 'בודקים...');
      try {
        await saveSettings({ ai_model: f.ai_model.value });
        const key = f.key.value.trim();
        if (key) await setAiKey(key);
        if (S.ai?.enabled) {
          await ai('ping');
          toast('מבט מהצד פעיל ועובד', { tone: 'good' });
        } else toast('נשמר');
        f.key.value = '';
      } catch (err) {
        toast(aiErrorText(err), { tone: 'warn', ms: 4200 });
      }
      busy(btn, false);
      refreshAiStatus();
    });
    if (location.hash.includes('#', 2)) {
      const id = location.hash.split('#')[2];
      setTimeout(() => root.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 80);
    }
  },
};

export async function aiOff() {
  const ok = await confirmSheet({ title: 'לכבות את מבט מהצד?', text: 'המפתח יימחק מהשרת. המכתבים הקודמים יישארו.', confirm: 'כיבוי', danger: true });
  if (!ok) return;
  try { await setAiKey(''); toast('כובה'); } catch (_) { toast('לא הצלחנו לכבות', { tone: 'warn' }); }
}

export function downloadBackup() {
  const blob = new Blob([JSON.stringify(exportAll(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `or-einayim-${todayStr()}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export async function doSignOut() {
  const ok = await confirmSheet({ title: 'לצאת מהחשבון?', text: 'כל המידע נשאר שמור. אפשר להיכנס שוב בכל רגע.', confirm: 'יציאה' });
  if (!ok) return;
  await signOut();
  location.hash = '#/';
  location.reload();
}

export { openInvite };

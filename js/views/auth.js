// אור עיניים · כניסה: who's here, sign in, or join with the home code
import { icon } from '../icons.js';
import { APP, PEOPLE } from '../content.js';
import { joinStatus, joinHome, signIn } from '../store.js';
import { esc, safeLocal } from '../util.js';
import { avatar, busy } from '../ui.js';

const A = { step: 'who', person: safeLocal('oe-last-person') || null, mode: 'join', joined: null, error: '' };

export const brandMark = (size = 44) => `<svg class="mark" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">
  <circle cx="32" cy="32" r="30" class="mark-iris"/>
  <circle cx="32" cy="32" r="13" class="mark-pupil"/>
  <circle cx="26.5" cy="26.5" r="4.6" class="mark-light"/>
</svg>`;

const g = (p, m, f) => (PEOPLE[p]?.g === 'f' ? f : m);

function whoScreen() {
  return `<div class="auth-who">
    <p class="auth-q">מי נכנס?</p>
    <div class="who-grid">${['orel', 'yiska'].map((p) => `<button type="button" class="who" data-auth="pick" data-person="${p}">
      ${avatar(p, { size: 'lg' })}<b>אני ${PEOPLE[p].name}</b>${A.joined && !A.joined.includes(p) ? '<small>פעם ראשונה</small>' : ''}
    </button>`).join('')}</div>
  </div>`;
}

function loginScreen() {
  const p = A.person;
  return `<form class="form auth-form" data-auth-form="login" novalidate>
    <p class="auth-hello">${avatar(p, { size: 'md' })}<span>שלום ${PEOPLE[p].name}</span></p>
    <div class="field"><label class="lbl" for="a-email">מייל</label><input id="a-email" name="email" type="email" dir="ltr" autocomplete="email" required value="${esc(safeLocal(`oe-email-${p}`) || '')}"></div>
    <div class="field"><label class="lbl" for="a-pass">סיסמה</label><input id="a-pass" name="password" type="password" dir="ltr" autocomplete="current-password" required></div>
    <p class="form-error" role="alert" ${A.error ? '' : 'hidden'}>${esc(A.error)}</p>
    <div class="form-actions"><button type="submit" class="btn btn-block">כניסה</button></div>
    <div class="auth-links">
      <button type="button" class="link-btn" data-auth="join">פעם ראשונה כאן? הצטרפות עם קוד הבית</button>
      <button type="button" class="link-btn" data-auth="reset">שכחתי סיסמה</button>
      <button type="button" class="link-btn" data-auth="back">${g(p, 'זה לא אני', 'זו לא אני')}</button>
    </div>
  </form>`;
}

function joinScreen() {
  const p = A.person;
  const reset = A.mode === 'reset';
  return `<form class="form auth-form" data-auth-form="join" novalidate>
    <p class="auth-hello">${avatar(p, { size: 'md' })}<span>${reset ? 'סיסמה חדשה' : `${g(p, 'ברוך הבא', 'ברוכה הבאה')}, ${PEOPLE[p].name}`}</span></p>
    <p class="muted">${reset ? 'עם קוד הבית אפשר לבחור סיסמה חדשה.' : `קוד הבית נמצא אצל ${p === 'orel' ? 'יסכה' : 'אוראל'}, או בהודעה שקיבלת.`}</p>
    <div class="field"><label class="lbl" for="j-code">קוד הבית</label><input id="j-code" name="code" type="text" dir="ltr" autocomplete="off" autocapitalize="characters" placeholder="XXXX-XXXX-XXXX" required></div>
    <div class="field"><label class="lbl" for="j-email">מייל</label><input id="j-email" name="email" type="email" dir="ltr" autocomplete="email" required value="${esc(safeLocal(`oe-email-${p}`) || '')}"></div>
    <div class="field"><label class="lbl" for="j-pass">${reset ? 'סיסמה חדשה' : 'סיסמה'}</label><input id="j-pass" name="password" type="password" dir="ltr" autocomplete="new-password" minlength="8" required>
      <p class="hint">לפחות 8 תווים.</p></div>
    <p class="form-error" role="alert" ${A.error ? '' : 'hidden'}>${esc(A.error)}</p>
    <div class="form-actions"><button type="submit" class="btn btn-block">${reset ? 'עדכון וכניסה' : 'הצטרפות'}</button></div>
    <div class="auth-links"><button type="button" class="link-btn" data-auth="login">${icon('chevron-right')}יש לי כבר חשבון</button></div>
  </form>`;
}

function errText(e, ctx) {
  const code = e?.code || '';
  const msg = String(e?.message || '');
  if (ctx === 'login') {
    if (/invalid login|invalid credentials/i.test(msg)) return 'המייל או הסיסמה לא נכונים.';
    if (/fetch|network/i.test(msg)) return 'אין חיבור לרשת כרגע.';
    return 'הכניסה לא הצליחה. כדאי לנסות שוב.';
  }
  return {
    code: 'קוד הבית לא נכון.',
    email: 'המייל לא נראה תקין.',
    password_short: 'הסיסמה צריכה לפחות 8 תווים.',
    taken: 'מישהו כבר הצטרף בשם הזה עם מייל אחר.',
    email_exists: 'המייל הזה כבר רשום.',
    network: 'אין חיבור לרשת כרגע.',
  }[code] || 'משהו השתבש. כדאי לנסות שוב.';
}

export function renderAuth(root, onSignedIn) {
  const paint = () => {
    root.innerHTML = `<div class="auth">
      <div class="auth-brand">${brandMark(64)}<h1 class="auth-title">${APP.name}</h1>
        <p class="auth-verse">${APP.verse}</p><p class="auth-sub">הבית של יסכה ואוראל</p></div>
      <div class="auth-card">${A.step === 'who' ? whoScreen() : A.step === 'login' ? loginScreen() : joinScreen()}</div>
    </div>`;
    const first = root.querySelector('input:not([value=""]) ~ input, #a-pass, #j-code');
    if (first && A.step !== 'who' && matchMedia('(pointer: fine)').matches) first.focus();
  };

  root.onclick = async (e) => {
    const b = e.target.closest('[data-auth]');
    if (!b) return;
    const act = b.dataset.auth;
    A.error = '';
    if (act === 'pick') {
      A.person = b.dataset.person;
      safeLocal('oe-last-person', A.person);
      A.step = A.joined && !A.joined.includes(A.person) ? 'join' : 'login';
      A.mode = 'join';
    } else if (act === 'join') { A.step = 'join'; A.mode = 'join'; }
    else if (act === 'reset') { A.step = 'join'; A.mode = 'reset'; }
    else if (act === 'login') { A.step = 'login'; }
    else if (act === 'back') { A.step = 'who'; }
    paint();
  };

  root.onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const kind = f.dataset.authForm;
    const btn = f.querySelector('[type="submit"]');
    const email = f.email.value.trim().toLowerCase();
    const password = f.password.value;
    const showErr = (t) => { const el = f.querySelector('.form-error'); el.textContent = t; el.hidden = false; };
    if (!email || !password) { showErr('צריך מייל וסיסמה.'); return; }
    busy(btn, true, kind === 'login' ? 'נכנסים...' : 'רגע...');
    try {
      if (kind === 'join') {
        await joinHome({ person: A.person, email, password, code: f.code.value });
      }
      await signIn(email, password);
      safeLocal(`oe-email-${A.person}`, email);
      onSignedIn();
    } catch (err) {
      busy(btn, false);
      showErr(errText(err, kind));
    }
  };

  paint();
  joinStatus().then((s) => {
    A.joined = s.joined || [];
    if (A.step === 'who') paint();
    // picked before the answer arrived: someone who never joined belongs on the join screen
    else if (A.step === 'login' && A.person && !A.joined.includes(A.person) && !root.querySelector('#a-pass')?.value) {
      A.step = 'join'; A.mode = 'join'; paint();
    }
  }).catch(() => { /* offline: the buttons still work */ });
}

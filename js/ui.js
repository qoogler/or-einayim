// אור עיניים · UI primitives: sheets, toasts, forms, chips, avatars, the iris ring
import { icon } from './icons.js';
import { PEOPLE } from './content.js';
import { esc } from './util.js';

// ---------- sheets (bottom sheet on phones, dialog on wide screens) ----------
let sheetOpen = false;
let afterClose = null;
let onHideCb = null;
const root = () => document.getElementById('sheet-root');

function paintSheet({ title, body, onMount, onHide = null, className = '' }) {
  onHideCb = onHide;
  const r = root();
  r.innerHTML = `
    <div class="sheet-backdrop" data-act="sheet-close"></div>
    <section class="sheet ${className}" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <div class="sheet-grip" aria-hidden="true"></div>
      <header class="sheet-head">
        <h2 id="sheet-title">${title}</h2>
        <button class="icon-btn" type="button" data-act="sheet-close" aria-label="סגירה">${icon('x')}</button>
      </header>
      <div class="sheet-body">${body}</div>
    </section>`;
  r.hidden = false;
  document.body.classList.add('has-sheet');
  requestAnimationFrame(() => r.classList.add('open'));
  const sheet = r.querySelector('.sheet');
  onMount?.(sheet);
  const first = sheet.querySelector('[autofocus]');
  if (first && matchMedia('(pointer: fine)').matches) setTimeout(() => first.focus(), 60);
  return sheet;
}

export function openSheet(opts) {
  const sheet = paintSheet(opts);
  if (!sheetOpen) {
    sheetOpen = true;
    history.pushState({ oeSheet: true }, '', location.href);
  }
  return sheet;
}

let closing = false;
function hideSheet() {
  closing = false;
  sheetOpen = false;
  const r = root();
  r.classList.remove('open');
  document.body.classList.remove('has-sheet');
  setTimeout(() => { if (!sheetOpen) { r.hidden = true; r.innerHTML = ''; } }, 220);
  const h = onHideCb; onHideCb = null;
  const cb = afterClose; afterClose = null;
  setTimeout(() => { h?.(); cb?.(); }, 0);
}

export function closeSheet(then) {
  if (then) afterClose = then;
  if (!sheetOpen) { const cb = afterClose; afterClose = null; cb?.(); return; }
  if (closing) return;
  closing = true;
  if (history.state?.oeSheet) history.back();
  else hideSheet();
}
export const isSheetOpen = () => sheetOpen;

window.addEventListener('popstate', () => { if (sheetOpen) hideSheet(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheetOpen) closeSheet(); });

export function confirmSheet({ title, text = '', confirm = 'אישור', danger = false }) {
  return new Promise((resolve) => {
    let result = false;
    openSheet({
      title,
      className: 'sheet-small',
      body: `${text ? `<p class="muted">${text}</p>` : ''}
        <div class="row-actions">
          <button type="button" class="btn ${danger ? 'btn-danger' : ''}" data-confirm="yes">${confirm}</button>
          <button type="button" class="btn btn-quiet" data-confirm="no">ביטול</button>
        </div>`,
      onMount: (s) => {
        s.querySelector('[data-confirm="yes"]').onclick = () => { result = true; closeSheet(); };
        s.querySelector('[data-confirm="no"]').onclick = () => { result = false; closeSheet(); };
      },
      onHide: () => resolve(result),
    });
  });
}

// ---------- toast ----------
export function toast(text, { tone = 'info', ms = 2800 } = {}) {
  const host = document.getElementById('toasts');
  if (!host) return;
  const el = document.createElement('div');
  el.className = `toast toast-${tone}`;
  el.setAttribute('role', 'status');
  el.textContent = text;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); }, ms);
}

// ---------- a little light when something good is sent ----------
export function burst(fromEl) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r = fromEl?.getBoundingClientRect?.() || { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const layer = document.createElement('div');
  layer.className = 'burst';
  for (let i = 0; i < 14; i++) {
    const s = document.createElement('i');
    const a = (Math.PI * 2 * i) / 14 + Math.random() * 0.4;
    const d = 38 + Math.random() * 46;
    s.style.cssText = `left:${x}px;top:${y}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 20}px;--s:${0.5 + Math.random() * 0.8};animation-delay:${Math.random() * 60}ms`;
    layer.appendChild(s);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 1100);
}

// ---------- small building blocks ----------
export function avatar(person, { size = 'md', online = false, title = '' } = {}) {
  const p = PEOPLE[person];
  if (!p) return '';
  return `<span class="av av-${person} av-${size}" title="${esc(title || p.name)}">${p.initial}${online ? '<i class="dot" aria-label="כאן עכשיו"></i>' : ''}</span>`;
}

export function bar(pct, tone = '') {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  return `<div class="bar ${tone}" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100"><i style="width:${p}%"></i></div>`;
}

export function sectionHead(title, { sub = '', action = null, id = '' } = {}) {
  const act = action
    ? `<button type="button" class="link-btn" data-act="${action.act}" ${action.attrs || ''}>${action.icon ? icon(action.icon) : ''}${action.label}</button>`
    : '';
  return `<div class="sec-head" ${id ? `id="${id}"` : ''}>
    <div><h2 class="sec-title">${title}</h2>${sub ? `<p class="sec-sub">${sub}</p>` : ''}</div>${act}
  </div>`;
}

export function empty(text, actions = '') {
  return `<div class="empty"><p>${text}</p>${actions ? `<div class="empty-actions">${actions}</div>` : ''}</div>`;
}

export function chip(label, { tone = '', act = '', attrs = '', iconName = '' } = {}) {
  const tag = act ? 'button' : 'span';
  return `<${tag} ${act ? `type="button" data-act="${act}"` : ''} class="chip ${tone}" ${attrs}>${iconName ? icon(iconName) : ''}${esc(label)}</${tag}>`;
}

export function suggestChips(list, kind, extra = '') {
  return `<div class="suggest">${list.map((v) =>
    `<button type="button" class="chip chip-add" data-act="suggest" data-kind="${kind}" data-value="${esc(v)}" ${extra}>${icon('plus')}${esc(v)}</button>`).join('')}</div>`;
}

// ---------- the iris: weekly rhythm as an eye that fills with light ----------
function arc(cx, cy, r, a0, a1) {
  const p = (a) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
export function iris(segments, { size = 132 } = {}) {
  const C = 60, R = 47, gap = 9;
  const n = segments.length;
  const span = 360 / n;
  const done = segments.reduce((a, s) => a + Math.min(1, s.value), 0) / n;
  const paths = segments.map((s, i) => {
    const a0 = -90 + i * span + gap / 2;
    const a1 = a0 + span - gap;
    const v = Math.max(0, Math.min(1, s.value));
    const fill = v > 0 ? `<path d="${arc(C, C, R, a0, a0 + (a1 - a0) * Math.max(v, 0.04))}" class="iris-fill" />` : '';
    return `<path d="${arc(C, C, R, a0, a1)}" class="iris-track" />${fill}`;
  }).join('');
  const glow = 0.25 + done * 0.75;
  return `<svg class="iris" viewBox="0 0 120 120" width="${size}" height="${size}" role="img" aria-label="קצב השבוע: ${Math.round(done * 100)}%">
    <circle cx="60" cy="60" r="33" class="iris-body" />
    <circle cx="60" cy="60" r="17" class="iris-pupil" />
    <circle cx="${60 - 7}" cy="${60 - 7}" r="${4 + done * 3}" class="iris-light" style="opacity:${glow.toFixed(2)}" />
    ${paths}
  </svg>`;
}

// ---------- forms built from field definitions ----------
// field: { k: 'title' | 'data.place', type, label, ph, options, required, rows, hint }
export const getVal = (obj, k) => (k.startsWith('data.') ? obj?.data?.[k.slice(5)] : obj?.[k]);
const fid = (k) => `f-${k.replace(/\./g, '-')}`;

export function fieldHtml(f, value) {
  const id = fid(f.k);
  const req = f.required ? 'required' : '';
  const ph = f.ph ? `placeholder="${esc(f.ph)}"` : '';
  const label = f.label ? `<label class="lbl" for="${id}">${f.label}${f.optional ? ' <span class="opt">(לא חובה)</span>' : ''}</label>` : '';
  const hint = f.hint ? `<p class="hint">${f.hint}</p>` : '';
  const v = value ?? f.default ?? '';
  switch (f.type) {
    case 'textarea':
      return `<div class="field">${label}<textarea id="${id}" name="${f.k}" rows="${f.rows || 3}" ${ph} ${req} ${f.autofocus ? 'autofocus' : ''}>${esc(v)}</textarea>${hint}</div>`;
    case 'date':
    case 'time':
    case 'number':
    case 'url':
    case 'email':
    case 'password':
      return `<div class="field">${label}<input id="${id}" name="${f.k}" type="${f.type}" value="${esc(v)}" ${ph} ${req}
        ${f.type === 'number' ? 'inputmode="decimal" step="any" min="0"' : ''} ${f.type === 'url' ? 'inputmode="url" dir="ltr"' : ''}
        ${f.type === 'email' ? 'dir="ltr" autocomplete="email"' : ''} ${f.autocomplete ? `autocomplete="${f.autocomplete}"` : ''} ${f.autofocus ? 'autofocus' : ''}>${hint}</div>`;
    case 'select':
      return `<div class="field">${label}<select id="${id}" name="${f.k}">${(f.options || []).map((o) => {
        const [val, lab] = Array.isArray(o) ? o : [o, o];
        return `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(lab)}</option>`;
      }).join('')}</select>${hint}</div>`;
    case 'chips':
      return `<fieldset class="field"><legend class="lbl">${f.label || ''}</legend><div class="chips" role="radiogroup">${(f.options || []).map((o, i) => {
        const [val, lab] = Array.isArray(o) ? o : [o, o];
        const checked = String(val) === String(v) || (!v && i === 0 && f.firstDefault);
        return `<label class="chip-radio"><input type="radio" name="${f.k}" value="${esc(val)}" ${checked ? 'checked' : ''}><span>${esc(lab)}</span></label>`;
      }).join('')}</div>${hint}</fieldset>`;
    case 'toggle':
      return `<div class="field field-toggle"><label class="toggle"><input id="${id}" type="checkbox" name="${f.k}" ${v === true || v === 'private' ? 'checked' : ''}><span class="toggle-ui" aria-hidden="true"></span><span>${f.label}</span></label>${hint}</div>`;
    case 'steps': {
      const steps = Array.isArray(v) ? v : [];
      const row = (s = { text: '', done: false }) =>
        `<li class="step-row"><input type="checkbox" class="step-done" ${s.done ? 'checked' : ''} aria-label="בוצע"><input type="text" class="step-text" value="${esc(s.text)}" placeholder="צעד קטן ומדיד"><button type="button" class="icon-btn step-del" aria-label="הסרה">${icon('x')}</button></li>`;
      return `<div class="field" data-steps="${f.k}"><span class="lbl">${f.label}</span><ul class="steps-edit">${steps.map(row).join('')}${steps.length ? '' : row()}</ul>
        <button type="button" class="link-btn step-add">${icon('plus')}עוד צעד</button>${hint}</div>`;
    }
    case 'photo':
      return `<div class="field">${label}<label class="photo-pick" for="${id}">${v ? `<img data-photo="${esc(v)}" alt="">` : `${icon('camera')}<span>${f.ph || 'להוסיף תמונה'}</span>`}</label>
        <input id="${id}" name="${f.k}" type="file" accept="image/*" hidden data-photo-input>${hint}</div>`;
    default:
      return `<div class="field">${label}<input id="${id}" name="${f.k}" type="text" value="${esc(v)}" ${ph} ${req} ${f.autofocus ? 'autofocus' : ''} ${f.maxlength ? `maxlength="${f.maxlength}"` : ''}>${hint}</div>`;
  }
}

export function formHtml(fields, values = {}, { submit = 'שמירה', extra = '', id = 'item-form' } = {}) {
  return `<form class="form" id="${id}" novalidate>
    ${fields.map((f) => fieldHtml(f, getVal(values, f.k))).join('')}
    <p class="form-error" role="alert" hidden></p>
    <div class="form-actions"><button type="submit" class="btn btn-block">${submit}</button>${extra}</div>
  </form>`;
}

export function wireForm(form) {
  // steps editor
  form.querySelectorAll('[data-steps]').forEach((box) => {
    const list = box.querySelector('.steps-edit');
    box.querySelector('.step-add').onclick = () => {
      const li = document.createElement('li');
      li.className = 'step-row';
      li.innerHTML = `<input type="checkbox" class="step-done" aria-label="בוצע"><input type="text" class="step-text" placeholder="צעד קטן ומדיד"><button type="button" class="icon-btn step-del" aria-label="הסרה">${icon('x')}</button>`;
      list.appendChild(li);
      li.querySelector('.step-text').focus();
    };
    list.addEventListener('click', (e) => { const del = e.target.closest('.step-del'); if (del) del.closest('li').remove(); });
  });
  // photo preview
  form.querySelectorAll('[data-photo-input]').forEach((inp) => {
    inp.addEventListener('change', () => {
      const file = inp.files?.[0];
      if (!file) return;
      const pick = form.querySelector(`label[for="${inp.id}"]`);
      pick.innerHTML = `<img alt="" src="${URL.createObjectURL(file)}">`;
    });
  });
}

export function readForm(form, fields) {
  const out = { data: {} };
  const files = {};
  const set = (k, v) => { if (k.startsWith('data.')) out.data[k.slice(5)] = v; else out[k] = v; };
  for (const f of fields) {
    if (f.type === 'chips') {
      const el = form.querySelector(`input[name="${f.k}"]:checked`);
      set(f.k, el ? el.value : null);
    } else if (f.type === 'toggle') {
      const el = form.querySelector(`input[name="${f.k}"]`);
      set(f.k, f.k === 'visibility' ? (el.checked ? 'private' : 'shared') : el.checked);
    } else if (f.type === 'steps') {
      const steps = [...form.querySelectorAll(`[data-steps="${f.k}"] .step-row`)].map((li) => ({
        text: li.querySelector('.step-text').value.trim(),
        done: li.querySelector('.step-done').checked,
      })).filter((s) => s.text);
      set(f.k, steps);
    } else if (f.type === 'photo') {
      const el = form.querySelector(`input[name="${f.k}"]`);
      if (el?.files?.[0]) files[f.k] = el.files[0];
    } else {
      const el = form.querySelector(`[name="${f.k}"]`);
      if (!el) continue;
      let v = el.value.trim();
      if (f.type === 'number') v = v === '' ? null : Number(v.replace(',', '.'));
      else if (v === '') v = null;
      set(f.k, v);
    }
  }
  if (!Object.keys(out.data).length) delete out.data;
  return { patch: out, files };
}

export function formError(form, text) {
  const el = form.querySelector('.form-error');
  if (!el) return;
  el.textContent = text || '';
  el.hidden = !text;
}

export function busy(btn, on, label) {
  if (!btn) return;
  if (on) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.classList.add('is-busy'); if (label) btn.textContent = label; }
  else { btn.disabled = false; btn.classList.remove('is-busy'); if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
}

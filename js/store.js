// אור עיניים · data layer: Supabase auth, shared state, live sync, presence, photos, AI
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { other, todayStr, hebDate, resizeImage, uid, safeLocal } from './util.js';

export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'or-einayim-auth' },
  realtime: { params: { eventsPerSecond: 5 } },
});

export const S = {
  session: null,
  user: null,
  me: null,            // my row in members
  members: {},         // person -> members row
  couple: { settings: {} },
  items: new Map(),
  ready: false,
  online: {},          // person -> true while their app is open
  ai: null,            // { enabled }
  syncing: false,
};

const listeners = new Set();
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = (evt) => { for (const fn of listeners) { try { fn(evt); } catch (e) { console.error(e); } } };

const CACHE_KEY = 'oe-cache-v1';

// ---------- identity helpers ----------
export const myPerson = () => S.me?.person ?? null;
export const partnerPerson = () => (S.me ? other(S.me.person) : null);
export const personOfUser = (userId) => Object.values(S.members).find((m) => m.user_id === userId)?.person ?? null;
export const authorOf = (it) => (it?.data?.by) || personOfUser(it?.author_id) || null;
export const isMine = (it) => it?.author_id === S.user?.id;
export const settings = () => S.couple?.settings ?? {};

// ---------- cache (instant paint on open) ----------
function cacheSave() {
  try {
    const items = [...S.items.values()].filter((i) => !String(i.id).startsWith('tmp-')).slice(0, 2500);
    localStorage.setItem(CACHE_KEY, JSON.stringify({ uid: S.user?.id, members: S.members, couple: S.couple, items }));
  } catch (_) { /* storage full or blocked: fine */ }
}
export function cacheLoad(userId) {
  const c = safeLocal(CACHE_KEY);
  if (!c || c.uid !== userId) return false;
  S.members = c.members || {};
  S.couple = c.couple || { settings: {} };
  S.items = new Map((c.items || []).map((i) => [i.id, i]));
  S.me = Object.values(S.members).find((m) => m.user_id === userId) || null;
  return !!S.me;
}
export const cacheClear = () => safeLocal(CACHE_KEY, null);

// ---------- auth ----------
export async function getSession() {
  const { data } = await sb.auth.getSession();
  S.session = data.session;
  S.user = data.session?.user ?? null;
  return S.session;
}
export async function signIn(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) throw error;
  S.session = data.session; S.user = data.user;
  return data;
}
export async function signOut() {
  try { await sb.removeAllChannels(); } catch (_) { /* ignore */ }
  await sb.auth.signOut();
  cacheClear();
  S.session = null; S.user = null; S.me = null; S.items = new Map(); S.members = {}; S.ready = false;
}
async function callFn(name, body, withAuth) {
  const headers = { 'Content-Type': 'application/json', apikey: SUPABASE_KEY };
  if (withAuth) {
    const { data } = await sb.auth.getSession();
    if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, { method: 'POST', headers, body: JSON.stringify(body) });
  } catch (_) {
    throw Object.assign(new Error('network'), { code: 'network' });
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw Object.assign(new Error(json.error || 'error'), { code: json.error || 'error', detail: json.detail, status: res.status });
  return json;
}
export const joinStatus = () => callFn('join', { action: 'status' });
export const joinHome = (payload) => callFn('join', payload);

// ---------- load + live sync ----------
export async function loadAll() {
  S.syncing = true;
  const [mem, cpl] = await Promise.all([
    sb.from('members').select('*'),
    sb.from('couple').select('*').eq('id', 1).maybeSingle(),
  ]);
  if (mem.error) throw mem.error;
  S.members = Object.fromEntries((mem.data || []).map((m) => [m.person, m]));
  S.me = (mem.data || []).find((m) => m.user_id === S.user?.id) || null;
  if (!S.me) { S.syncing = false; return false; }
  S.couple = cpl.data || { settings: {} };

  const all = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await sb.from('items').select('*').order('created_at', { ascending: false }).range(from, from + page - 1);
    if (error) throw error;
    all.push(...data);
    if (data.length < page) break;
  }
  S.items = new Map(all.map((i) => [i.id, i]));
  S.ready = true;
  S.syncing = false;
  cacheSave();
  emit({ type: 'load' });
  refreshAiStatus();
  sb.from('members').update({ last_seen_at: new Date().toISOString() }).eq('user_id', S.user.id).then(() => {});
  return true;
}

let dbChannel = null;
let presenceChannel = null;
const saveSoon = (() => { let t; return () => { clearTimeout(t); t = setTimeout(cacheSave, 800); }; })();

export function subscribe() {
  if (dbChannel) return;
  dbChannel = sb.channel('oe-db')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, (p) => {
      if (p.eventType === 'DELETE') S.items.delete(p.old.id);
      else S.items.set(p.new.id, p.new);
      saveSoon();
      emit({ type: 'items', event: p.eventType, item: p.new, remote: p.new?.author_id !== S.user?.id });
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'couple' }, (p) => {
      if (p.new) S.couple = p.new;
      saveSoon();
      emit({ type: 'couple' });
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, (p) => {
      if (p.new?.person) S.members[p.new.person] = p.new;
      if (p.new?.user_id === S.user?.id) S.me = p.new;
      saveSoon();
      emit({ type: 'members' });
    })
    .subscribe((status) => {
      liveOk = status === 'SUBSCRIBED';
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') emit({ type: 'sync-error' });
    });
  ensurePresence();
  // Safety net: if live sync can't connect on this network, refresh quietly every 45 seconds.
  setInterval(() => { if (!liveOk && !document.hidden) resync(); }, 45 * 1000);
}
let liveOk = false;

async function ensurePresence() {
  let room = settings().room;
  if (!room) {
    room = uid().replace(/-/g, '').slice(0, 16);
    try { await saveSettings({ room }); } catch (_) { return; }
  }
  if (presenceChannel) return;
  presenceChannel = sb.channel(`oe-here-${room}`, { config: { presence: { key: S.me.person } } });
  presenceChannel
    .on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState();
      S.online = Object.fromEntries(Object.keys(state).map((k) => [k, true]));
      emit({ type: 'presence' });
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await presenceChannel.track({ at: Date.now() });
    });
}

// Re-sync after the phone wakes up or the network returns
export async function resync() {
  if (!S.user || S.syncing) return;
  try { await loadAll(); } catch (e) { console.warn('resync failed', e); }
}

// ---------- items ----------
const LOCAL_FIELDS = ['id', 'author_id', 'created_at', 'updated_at', '_pending'];
const clean = (obj) => Object.fromEntries(Object.entries(obj).filter(([k, v]) => !LOCAL_FIELDS.includes(k) && v !== undefined));

export async function addItem(fields) {
  const tmpId = `tmp-${uid()}`;
  const now = new Date().toISOString();
  const draft = {
    id: tmpId, author_id: S.user.id, visibility: 'shared', data: {}, pinned: false,
    created_at: now, updated_at: now, ...fields, _pending: true,
  };
  S.items.set(tmpId, draft);
  emit({ type: 'items', event: 'INSERT', item: draft, local: true });
  const { data, error } = await sb.from('items').insert(clean({ ...fields, data: fields.data || {} })).select().single();
  S.items.delete(tmpId);
  if (error) { emit({ type: 'items', event: 'DELETE', local: true }); throw error; }
  S.items.set(data.id, data);
  saveSoon();
  emit({ type: 'items', event: 'INSERT', item: data, local: true });
  return data;
}

export async function updateItem(id, patch) {
  const prev = S.items.get(id);
  if (!prev) return null;
  const next = { ...prev, ...patch, data: patch.data ? { ...(prev.data || {}), ...patch.data } : prev.data };
  S.items.set(id, next);
  emit({ type: 'items', event: 'UPDATE', item: next, local: true });
  const body = clean({ ...patch, ...(patch.data ? { data: next.data } : {}) });
  const { data, error } = await sb.from('items').update(body).eq('id', id).select().single();
  if (error) { S.items.set(id, prev); emit({ type: 'items', event: 'UPDATE', item: prev, local: true }); throw error; }
  S.items.set(id, data);
  saveSoon();
  return data;
}

export async function deleteItem(id) {
  const prev = S.items.get(id);
  S.items.delete(id);
  emit({ type: 'items', event: 'DELETE', local: true });
  const { error } = await sb.from('items').delete().eq('id', id);
  if (error) { if (prev) S.items.set(id, prev); emit({ type: 'items', event: 'UPDATE', local: true }); throw error; }
  if (prev?.data?.photo) sb.storage.from('photos').remove([prev.data.photo]).then(() => {});
  saveSoon();
}

export const items = (kind) => [...S.items.values()].filter((i) => i.kind === kind);
export const itemsOf = (kinds) => [...S.items.values()].filter((i) => kinds.includes(i.kind));
export const getItem = (id) => S.items.get(id) || null;

// Mark the partner's notes as seen by me
export async function markSeen(list) {
  const ids = list.filter((i) => !isMine(i) && !i.partner_seen_at && !String(i.id).startsWith('tmp-')).map((i) => i.id);
  if (!ids.length) return;
  const now = new Date().toISOString();
  ids.forEach((id) => { const it = S.items.get(id); if (it) S.items.set(id, { ...it, partner_seen_at: now }); });
  await sb.from('items').update({ partner_seen_at: now }).in('id', ids);
}

// ---------- settings + profile ----------
export async function saveSettings(patch) {
  const { data, error } = await sb.rpc('merge_settings', { p_patch: patch });
  if (error) throw error;
  S.couple = { ...S.couple, settings: data };
  saveSoon();
  emit({ type: 'couple' });
  return data;
}
export async function updateMe(patch) {
  const { data, error } = await sb.from('members').update(patch).eq('user_id', S.user.id).select().single();
  if (error) throw error;
  S.me = data; S.members[data.person] = data;
  saveSoon();
  emit({ type: 'members' });
  return data;
}

// ---------- AI ----------
export async function refreshAiStatus() {
  const { data } = await sb.rpc('ai_status');
  S.ai = data || { enabled: false };
  emit({ type: 'ai' });
  return S.ai;
}
export async function setAiKey(key) {
  const { data, error } = await sb.rpc('set_ai_key', { p_key: key });
  if (error) throw error;
  S.ai = data;
  emit({ type: 'ai' });
  return data;
}
export function ai(task, payload = {}) {
  return callFn('ai', { task, today: todayStr(), hebrew_today: hebDate(new Date()), ...payload }, true);
}

// ---------- photos ----------
const urlCache = new Map();
export async function uploadPhoto(file) {
  const { blob, w, h } = await resizeImage(file);
  const path = `${new Date().getFullYear()}/${uid()}.jpg`;
  const { error } = await sb.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false });
  if (error) throw error;
  return { path, w, h };
}
export async function photoUrls(paths) {
  const now = Date.now();
  const need = [...new Set(paths)].filter((p) => p && (!urlCache.has(p) || urlCache.get(p).exp < now));
  if (need.length) {
    const { data } = await sb.storage.from('photos').createSignedUrls(need, 60 * 60 * 24);
    (data || []).forEach((d) => { if (d.signedUrl) urlCache.set(d.path, { url: d.signedUrl, exp: now + 1000 * 60 * 60 * 23 }); });
  }
  return Object.fromEntries(paths.map((p) => [p, urlCache.get(p)?.url || '']));
}
export async function hydratePhotos(root) {
  const els = [...root.querySelectorAll('img[data-photo]:not([src])')];
  if (!els.length) return;
  const urls = await photoUrls(els.map((e) => e.dataset.photo));
  els.forEach((e) => { const u = urls[e.dataset.photo]; if (u) e.src = u; });
}

// ---------- export ----------
export function exportAll() {
  return {
    exported_at: new Date().toISOString(),
    app: 'אור עיניים',
    members: Object.values(S.members).map(({ person, display_name, birthday }) => ({ person, display_name, birthday })),
    settings: S.couple.settings,
    items: [...S.items.values()].filter((i) => !String(i.id).startsWith('tmp-')),
  };
}

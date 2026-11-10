// 데이터 읽기·쓰기는 모두 이 파일을 거친다 (PRD 9장: api.js 한 파일).
// MODE 'supabase' = 실제 운영, 'demo' = Supabase 미연결(예시 데이터 + 브라우저 저장)
import { CONFIG } from './config.js';
import { publicItems, SCHEMA_VERSION, uid } from './model.js';

export const MODE = CONFIG.supabaseUrl && CONFIG.supabaseAnonKey ? 'supabase' : 'demo';
const DEMO_KEY = 'lis-portfolio-demo-v2';
const EVENTS_KEY = 'lis-portfolio-demo-events';
const EXCLUDE_KEY = 'lis-portfolio-exclude-stats';

export const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch { /* 저장소 없음 */ } },
};

// 네트워크가 느리거나 막혀 있어도 화면이 '불러오는 중'에서 멈추지 않도록 시간 제한
export function withTimeout(promise, ms, label = '요청') {
  let t;
  return Promise.race([
    promise.finally(() => clearTimeout(t)),
    new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`${label} 시간이 초과되었습니다(${ms / 1000}초)`)), ms); }),
  ]);
}

let sb = null;
async function client() {
  if (!sb) {
    const { createClient } = await withTimeout(import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'), 10000, 'Supabase 연결 도구 불러오기');
    sb = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
  }
  return sb;
}

const fromRow = r => ({
  id: r.id, kind: r.kind, data: r.data || {}, visibility: r.visibility || 'public',
  status: r.status || 'published', isSample: !!r.is_sample, sort: r.sort || 0, updatedAt: r.updated_at,
});
const toRow = i => ({
  id: i.id, kind: i.kind, data: i.data, visibility: i.visibility, status: i.status,
  is_sample: !!i.isSample, sort: i.sort || 0,
});

async function fetchJSON(path) {
  const r = await fetch(path, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${path} 을(를) 불러오지 못했습니다 (${r.status})`);
  return r.json();
}

// ---------- 공개 화면 ----------
export async function getPublicData() {
  if (MODE === 'supabase') {
    try {
      const c = await client();
      const { data, error } = await withTimeout(c.from('public_items').select('*'), 8000, '공개 데이터 불러오기');
      if (error) throw error;
      return { items: data.map(fromRow), source: 'live' };
    } catch (e) {
      const s = await fetchJSON(CONFIG.snapshotPath);
      return { items: publicItems(s.items || []), source: 'snapshot', checkedAt: s.checkedAt || s.exportedAt };
    }
  }
  const local = store.get(DEMO_KEY);
  if (local?.items) return { items: publicItems(local.items), source: 'demo-local' };
  const s = await fetchJSON(CONFIG.snapshotPath);
  return { items: publicItems(s.items || []), source: 'demo' };
}

// ---------- 로그인 ----------
export async function getSession() {
  if (MODE === 'demo') return { user: { email: '데모 모드' } };
  const c = await client();
  const { data } = await c.auth.getSession();
  return data.session;
}
export async function signIn(email, password) {
  const c = await client();
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}
export async function signOut(everywhere = false) {
  if (MODE === 'demo') return;
  const c = await client();
  await c.auth.signOut({ scope: everywhere ? 'global' : 'local' });
}
export async function resetPassword(email) {
  const c = await client();
  const { error } = await c.auth.resetPasswordForEmail(email, { redirectTo: location.href.split('#')[0] });
  if (error) throw error;
}

// ---------- 관리 화면 ----------
async function demoState() {
  let s = store.get(DEMO_KEY);
  if (!s?.items) {
    const seed = await fetchJSON(CONFIG.demoSeedPath);
    s = { items: seed.items, notes: Object.fromEntries((seed.careerNotes || []).map(n => [n.itemId, n.note])) };
    store.set(DEMO_KEY, s);
  }
  return s;
}

export async function loadAll() {
  if (MODE === 'demo') {
    const s = await demoState();
    return { items: structuredClone(s.items), notes: { ...(s.notes || {}) } };
  }
  const c = await client();
  const [{ data: rows, error: e1 }, { data: notes, error: e2 }] = await Promise.all([
    c.from('items').select('*'), c.from('career_notes').select('*'),
  ]);
  if (e1 || e2) throw e1 || e2;
  return { items: rows.map(fromRow), notes: Object.fromEntries(notes.map(n => [n.item_id, n.note])) };
}

export class ConflictError extends Error {
  constructor() { super('다른 기기에서 먼저 수정된 항목입니다.'); this.code = 'conflict'; }
}

// item.updatedAt = 편집을 시작할 때 받은 값. 저장소의 값과 다르면 다른 기기가 먼저 저장한 것(F-6.3).
export async function saveItem(item, { force = false } = {}) {
  const now = new Date().toISOString();
  if (MODE === 'demo') {
    const s = await demoState();
    const i = s.items.findIndex(x => x.id === item.id);
    if (!force && i >= 0 && item.updatedAt && s.items[i].updatedAt !== item.updatedAt) throw new ConflictError();
    const saved = { ...structuredClone(item), updatedAt: now };
    if (i >= 0) s.items[i] = saved; else s.items.push(saved);
    if (!store.set(DEMO_KEY, s)) throw new Error('브라우저 저장 공간이 부족합니다. JSON으로 백업한 뒤 큰 이미지를 지워 주세요.');
    return saved;
  }
  const c = await client();
  if (!force && item.updatedAt) {
    const { data } = await c.from('items').select('updated_at').eq('id', item.id).maybeSingle();
    if (data && new Date(data.updated_at).getTime() !== new Date(item.updatedAt).getTime()) throw new ConflictError();
  }
  const { data, error } = await c.from('items').upsert(toRow(item)).select().single();
  if (error) throw error;
  return fromRow(data);
}

export async function saveMany(items) {
  // 순서 변경처럼 여러 항목을 한 번에 저장할 때 (충돌 검사 없음)
  if (MODE === 'demo') {
    const s = await demoState();
    const now = new Date().toISOString();
    items.forEach(it => {
      const i = s.items.findIndex(x => x.id === it.id);
      const saved = { ...structuredClone(it), updatedAt: now };
      if (i >= 0) s.items[i] = saved; else s.items.push(saved);
    });
    store.set(DEMO_KEY, s);
    return s.items.filter(x => items.some(it => it.id === x.id));
  }
  const c = await client();
  const { data, error } = await c.from('items').upsert(items.map(toRow)).select();
  if (error) throw error;
  return data.map(fromRow);
}

export async function deleteItem(id) {
  if (MODE === 'demo') {
    const s = await demoState();
    s.items = s.items.filter(x => x.id !== id);
    delete s.notes?.[id];
    store.set(DEMO_KEY, s);
    return;
  }
  const c = await client();
  const { error } = await c.from('items').delete().eq('id', id);
  if (error) throw error;
}

export async function saveNote(itemId, note) {
  if (MODE === 'demo') {
    const s = await demoState();
    s.notes = s.notes || {};
    if (note) s.notes[itemId] = note; else delete s.notes[itemId];
    store.set(DEMO_KEY, s);
    return;
  }
  const c = await client();
  if (!note) { await c.from('career_notes').delete().eq('item_id', itemId); return; }
  const { error } = await c.from('career_notes').upsert({ item_id: itemId, note });
  if (error) throw error;
}

// ---------- JSON 백업 (F-6.11) ----------
export async function exportAll() {
  const { items, notes } = await loadAll();
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    items,
    careerNotes: Object.entries(notes).map(([itemId, note]) => ({ itemId, note })),
  };
}

export function checkBackup(obj) {
  const errors = [];
  if (!obj || typeof obj !== 'object') errors.push('JSON 형식이 아닙니다.');
  else {
    if (obj.schemaVersion !== SCHEMA_VERSION) errors.push(`schemaVersion이 ${SCHEMA_VERSION}이 아닙니다(파일: ${obj.schemaVersion ?? '없음'}).`);
    if (!Array.isArray(obj.items)) errors.push('items 목록이 없습니다.');
    else obj.items.forEach((it, n) => {
      if (!it.id || !it.kind || typeof it.data !== 'object') errors.push(`${n + 1}번째 항목에 id·kind·data가 없습니다.`);
    });
  }
  return errors;
}

export async function replaceAll(backup) {
  const notes = Object.fromEntries((backup.careerNotes || []).map(n => [n.itemId, n.note]));
  if (MODE === 'demo') {
    store.set(DEMO_KEY, { items: backup.items, notes });
    return;
  }
  const c = await client();
  const { error: e1 } = await c.from('items').delete().not('id', 'is', null);
  if (e1) throw e1;
  for (let i = 0; i < backup.items.length; i += 200) {
    const { error } = await c.from('items').insert(backup.items.slice(i, i + 200).map(toRow));
    if (error) throw error;
  }
  const rows = Object.entries(notes).map(([item_id, note]) => ({ item_id, note }));
  if (rows.length) {
    const { error } = await c.from('career_notes').insert(rows);
    if (error) throw error;
  }
}

export function resetDemo() { store.del(DEMO_KEY); store.del(EVENTS_KEY); }

// ---------- 증빙 파일 (F-6.8) ----------
// 이미지는 캔버스로 다시 그려 WebP로 바꾼다. 이 과정에서 촬영 위치 등 EXIF 정보가 빠진다.
async function toWebp(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise(r => canvas.toBlob(r, 'image/webp', 0.82));
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.webp', { type: 'image/webp' });
}

export async function uploadFile(file, isPublic) {
  if (file.size > 10 * 1024 * 1024) throw new Error('파일은 10MB까지 올릴 수 있습니다.');
  if (!/^(application\/pdf|image\/(jpeg|png|webp))$/.test(file.type)) throw new Error('PDF·JPG·PNG·WebP만 올릴 수 있습니다.');
  const f = await toWebp(file);
  if (MODE === 'demo') {
    if (f.size > 400 * 1024) throw new Error('데모 모드에서는 400KB 이하 파일만 브라우저에 저장할 수 있습니다. 링크로 등록하거나 Supabase를 연결하세요.');
    const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
    return { url, size: f.size, name: f.name };
  }
  const c = await client();
  const bucket = isPublic ? 'evidence-public' : 'evidence-private';
  const path = `${uid()}-${f.name.replace(/[^\w.-]+/g, '_')}`;
  const { error } = await c.storage.from(bucket).upload(path, f, { contentType: f.type });
  if (error) throw error;
  const url = isPublic ? c.storage.from(bucket).getPublicUrl(path).data.publicUrl : `private:${path}`;
  return { url, size: f.size, name: f.name };
}

// 비공개 버킷 파일은 소유자에게만 1시간짜리 서명 주소로 연다
export async function resolveFileUrl(url) {
  if (!url?.startsWith('private:')) return url;
  if (MODE === 'demo') return '';
  const c = await client();
  const { data } = await c.storage.from('evidence-private').createSignedUrl(url.slice(8), 3600);
  return data?.signedUrl || '';
}

// ---------- 방문 통계 (F-9) ----------
export function isStatsExcluded() {
  if (store.get(EXCLUDE_KEY)) return true;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('sb-') && k.endsWith('-auth-token')) return true; // 로그인한 소유자
    }
  } catch { /* 저장소 없음 */ }
  return false;
}
export function setStatsExcluded(v) { if (v) store.set(EXCLUDE_KEY, true); else store.del(EXCLUDE_KEY); }

function sessionId() {
  try {
    let s = sessionStorage.getItem('lis-sid');
    if (!s) { s = Math.random().toString(36).slice(2, 12); sessionStorage.setItem('lis-sid', s); }
    return s;
  } catch { return 'na'; }
}

export async function track(type, target = '') {
  if (isStatsExcluded()) return;
  let ref = '', referrer = '';
  try {
    ref = (new URLSearchParams(location.search).get('ref') || sessionStorage.getItem('lis-ref') || '').slice(0, 60);
    if (ref) sessionStorage.setItem('lis-ref', ref);
    referrer = document.referrer ? new URL(document.referrer).hostname.slice(0, 120) : '';
  } catch { /* 무시 */ }
  const evt = {
    type, target: String(target).slice(0, 120), referrer, ref,
    device: matchMedia('(max-width: 767px)').matches ? 'mobile' : 'desktop', session: sessionId(),
  };
  try {
    if (MODE === 'demo') {
      const list = store.get(EVENTS_KEY) || [];
      list.push({ ...evt, created_at: new Date().toISOString() });
      store.set(EVENTS_KEY, list.slice(-2000));
      return;
    }
    const c = await client();
    await c.from('events').insert(evt);
  } catch { /* 통계 실패는 화면에 영향 없음 */ }
}

export async function loadEvents(days = 30) {
  const since = new Date(Date.now() - days * 864e5).toISOString();
  if (MODE === 'demo') return (store.get(EVENTS_KEY) || []).filter(e => e.created_at >= since);
  const c = await client();
  const { data, error } = await c.from('events').select('*').gte('created_at', since).order('created_at').limit(10000);
  if (error) throw error;
  return data;
}

// 관리 화면 (F-6 콘텐츠 관리, F-7 편집/공개 미리보기, F-9 통계)
import * as api from './api.js';
import {
  KINDS, ROLES, METRIC_KEYS, PROJECT_TYPES, RESUME_KINDS, byKind, profileOf, publicItems, isVisible,
  validate, piiWarnings, missingCore, slugify, uid, period, fmtMonth, get,
} from './model.js';
import { mountPortfolio, esc } from './render.js';
import { icon, sidebarState } from './icons.js';

const app = document.getElementById('admin');
const S = { items: [], notes: {}, tab: 'project', editing: null, dirty: false, lastSaved: null, preview: null, returnTo: null };
const LAST_BACKUP = 'lis-portfolio-last-backup';

// ---------- 대화상자·알림 (페이지 안에서 직접 그림: 브라우저 confirm 대신) ----------
function dialog({ title, body = '', buttons = [{ label: '확인', value: true, primary: true }] }) {
  return new Promise(resolve => {
    const prev = document.activeElement;
    const m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = `<div class="box" role="dialog" aria-modal="true" aria-labelledby="dlg-t"><h2 id="dlg-t">${esc(title)}</h2><div>${body}</div>
      <div class="btns">${buttons.map((b, i) => `<button type="button" class="btn${b.primary ? ' primary' : ''}${b.danger ? ' danger' : ''}" data-i="${i}">${esc(b.label)}</button>`).join('')}</div></div>`;
    document.body.appendChild(m);
    const done = v => { m.remove(); document.removeEventListener('keydown', onKey); prev?.focus?.(); resolve(v); };
    const onKey = e => { if (e.key === 'Escape') done(null); };
    document.addEventListener('keydown', onKey);
    m.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) done(buttons[b.dataset.i].value); else if (e.target === m) done(null); });
    (m.querySelector('.btn.primary') || m.querySelector('.btn')).focus();
  });
}
const ask = (title, body, okLabel = '확인', danger = false) => dialog({ title, body, buttons: [{ label: '취소', value: false }, { label: okLabel, value: true, primary: !danger, danger }] });

let toastTimer;
function toast(msg, action) {
  document.querySelector('.toast')?.remove();
  clearTimeout(toastTimer);
  const t = document.createElement('div');
  t.className = 'toast'; t.setAttribute('role', 'status');
  t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ''}`;
  document.body.appendChild(t);
  if (action) t.querySelector('button').onclick = () => { t.remove(); action.run(); };
  toastTimer = setTimeout(() => t.remove(), action ? 10000 : 3500);
}

// 파일 저장: 다운로드가 막힌 환경(미리보기 링크 등)에서는 복사 창을 띄운다
async function offerJSON(obj, filename) {
  const text = JSON.stringify(obj, null, 2);
  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  } catch { /* 아래 복사 창으로 */ }
  const v = await dialog({
    title: 'JSON 백업', body: `<p class="small">다운로드가 시작되지 않았다면 아래 내용을 복사해 <b>${esc(filename)}</b> 파일로 저장하세요.</p><textarea readonly style="width:100%;height:160px;font-size:12px">${esc(text)}</textarea>`,
    buttons: [{ label: '닫기', value: false }, { label: '복사', value: true, primary: true }],
  });
  if (v) { try { await navigator.clipboard.writeText(text); toast('복사했습니다.'); } catch { toast('복사하지 못했습니다. 직접 선택해 복사하세요.'); } }
  api.store.set(LAST_BACKUP, new Date().toISOString());
}

// ---------- 시작·로그인 ----------
async function start() {
  if (api.MODE === 'supabase') {
    const session = await api.getSession().catch(() => null);
    if (!session) return renderLogin();
  }
  await reload();
  window.addEventListener('hashchange', () => setPreview(location.hash === '#preview'));
  // 상단 고정 헤더: 스크롤을 시작하면 아래 그림자
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const on = window.scrollY > 4;
      app.querySelectorAll('.abar, .mbar').forEach(el => el.classList.toggle('scrolled', on));
      ticking = false;
    });
  }, { passive: true });
  document.addEventListener('keydown', e => {
    const shell = app.querySelector('#shell');
    if (e.key === 'Escape' && shell?.classList.contains('drawer-open') && !document.querySelector('.modal')) {
      shell.classList.remove('drawer-open');
      app.querySelector('[data-drawer-open]')?.focus();
    }
  });
  window.addEventListener('beforeunload', e => { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });
  setPreview(location.hash === '#preview');
}

function renderLogin(msg = '') {
  app.innerHTML = `<form class="login form" id="login">
    <h1 style="margin:0">관리 화면 로그인</h1>
    <p class="muted small" style="margin:0">소유자 계정으로 로그인하면 어느 기기에서나 같은 내용을 편집할 수 있습니다.</p>
    ${msg ? `<div class="errors">${esc(msg)}</div>` : ''}
    <div class="fld"><label for="lg-e">이메일</label><input id="lg-e" type="email" autocomplete="username" required></div>
    <div class="fld"><label for="lg-p">비밀번호</label><input id="lg-p" type="password" autocomplete="current-password" required></div>
    <button class="btn primary" type="submit">로그인</button>
    <button class="btn" type="button" id="lg-r">비밀번호 재설정 메일 받기</button>
    <a class="small" href="index.html">← 포트폴리오로</a></form>`;
  app.querySelector('#login').onsubmit = async e => {
    e.preventDefault();
    try { await api.signIn(app.querySelector('#lg-e').value, app.querySelector('#lg-p').value); start(); }
    catch (err) { renderLogin('로그인하지 못했습니다: ' + (err.message || err)); }
  };
  app.querySelector('#lg-r').onclick = async () => {
    const email = app.querySelector('#lg-e').value;
    if (!email) return renderLogin('이메일을 먼저 입력하세요.');
    try { await api.resetPassword(email); toast('재설정 메일을 보냈습니다.'); } catch (err) { renderLogin(err.message); }
  };
}

async function reload() {
  try {
    const { items, notes } = await api.loadAll();
    S.items = items; S.notes = notes;
  } catch (e) {
    app.innerHTML = `<div class="login"><h1>불러오지 못했습니다</h1><p>${esc(e.message || e)}</p><button class="btn" onclick="location.reload()">다시 시도</button></div>`;
    throw e;
  }
}

// ---------- 레이아웃 ----------
const TAB_ICONS = {
  profile: 'user', project: 'folder', education: 'graduation', experience: 'briefcase', activity: 'users', award: 'award',
  certificate: 'certificate', language: 'language', tool: 'wrench', competency: 'target', stats: 'chart', backup: 'database',
};
const SB_KEY = 'lis-sb-admin';
const TABS = [
  ['기본', [['profile', '프로필']]],
  ['프로젝트', [['project', '프로젝트']]],
  ['이력', RESUME_KINDS.map(k => [k, KINDS[k].label])],
  ['설정', [['competency', '역량·직무'], ['stats', '방문 통계'], ['backup', '백업·설정']]],
];

function setPreview(on) {
  S.preview?.destroy?.();
  S.preview = null;
  document.body.classList.toggle('admin', !on);
  if (on) return renderPreview();
  renderShell();
}

function alertsHTML() {
  const out = [];
  if (api.MODE === 'demo') out.push('데모 모드입니다. 편집 내용은 이 브라우저에만 저장되고 공개 사이트에는 반영되지 않습니다. README의 Supabase 연결을 마치면 어느 기기에서나 편집할 수 있습니다.');
  const pubSamples = S.items.filter(i => i.isSample && isVisible(i));
  if (pubSamples.length) out.push(`‘예시’ 데이터 ${pubSamples.length}건이 공개 중입니다. 실제 내용으로 고친 뒤 ‘예시 해제’하거나 비공개로 바꾸세요.`);
  const miss = missingCore(S.items);
  if (miss.length) out.push(`주 희망 직무의 핵심 역량 중 공개된 실제 프로젝트가 없는 역량: ${miss.map(m => m.competency).join(', ')}`);
  const lb = api.store.get(LAST_BACKUP);
  const days = lb ? Math.floor((Date.now() - new Date(lb)) / 864e5) : null;
  if (days === null || days > 30) out.push(days === null ? '아직 JSON 전체 백업을 받은 적이 없습니다. ‘백업·설정’에서 받아 두세요.' : `마지막 JSON 백업 후 ${days}일이 지났습니다.`);
  return out.map(t => `<div class="alert">${esc(t)}</div>`).join('');
}

function tabLabel(id) {
  for (const [, list] of TABS) for (const [t, l] of list) if (t === id) return l;
  return '';
}

function renderShell() {
  const collapsed = sidebarState.get(SB_KEY);
  const toggleLabel = collapsed ? '메뉴 펼치기' : '메뉴 접기';
  app.innerHTML = `<div class="shell${collapsed ? ' collapsed' : ''}" id="shell">
    <aside class="sb" id="sb" aria-label="관리 메뉴">
      <div class="sb-head">
        <span class="sb-avatar">${icon('pencil', 16)}</span>
        <span class="sb-name">포트폴리오 관리</span>
        <button type="button" class="sb-toggle desk" data-sb-toggle aria-controls="sb" aria-expanded="${!collapsed}" aria-label="${toggleLabel}" title="${toggleLabel}">${icon(collapsed ? 'expand' : 'collapse')}</button>
        <button type="button" class="sb-toggle sb-close" data-drawer-close aria-label="메뉴 닫기">${icon('close')}</button>
      </div>
      <nav class="sb-nav" aria-label="편집 메뉴">${TABS.map(([g, list]) => `<span class="sb-grp">${g}</span>${list.map(([id, label]) => {
        const n = KINDS[id] ? byKind(S.items, id).length : '';
        return `<button type="button" class="sb-link" data-tab="${id}" data-label="${esc(label)}" aria-label="${esc(label)}${n !== '' ? ` ${n}건` : ''}" ${S.tab === id ? 'aria-current="page"' : ''}>${icon(TAB_ICONS[id])}<span class="sb-label">${esc(label)}</span><span class="sb-count">${n}</span></button>`;
      }).join('')}`).join('')}</nav>
      <div class="sb-foot">
        <button type="button" class="sb-link" data-preview data-label="공개 미리보기" aria-label="공개 미리보기">${icon('eye')}<span class="sb-label">공개 미리보기</span></button>
        <a class="sb-link" href="index.html" target="_blank" rel="noopener" data-label="공개 사이트(새 창)" aria-label="공개 사이트 새 창으로 열기">${icon('external')}<span class="sb-label">공개 사이트</span></a>
        ${api.MODE === 'supabase' ? `<button type="button" class="sb-link" data-logout data-label="로그아웃" aria-label="로그아웃">${icon('logout')}<span class="sb-label">로그아웃</span></button>` : ''}
      </div>
    </aside>
    <div class="sb-backdrop" data-drawer-close></div>
    <div class="main">
      <div class="mbar">
        <button type="button" class="sb-toggle" data-drawer-open aria-controls="sb" aria-expanded="false" aria-label="메뉴 열기">${icon('menu')}</button>
        <span class="mtitle">포트폴리오 관리</span><span class="mcur">${esc(tabLabel(S.tab))}</span>
      </div>
      <header class="abar"><div class="abar-in">
        <h1>${esc(tabLabel(S.tab))}</h1>
        <div class="seg" role="group" aria-label="화면 모드"><button type="button" aria-pressed="true">편집</button><button type="button" data-preview>공개 미리보기</button></div>
        <span class="small muted" id="saved">${S.lastSaved ? '마지막 저장 ' + S.lastSaved : ''}</span>
      </div><div class="edit-banner">편집 중 — 방문자에게 보이지 않는 화면입니다</div></header>
      <div class="alerts">${alertsHTML()}</div>
      <main class="panel apanel" id="panel"></main>
    </div></div>`;

  const shell = app.querySelector('#shell');
  const setDrawer = open => {
    shell.classList.toggle('drawer-open', open);
    app.querySelector('[data-drawer-open]').setAttribute('aria-expanded', String(open));
    if (open) (app.querySelector('.sb-link[aria-current]') || app.querySelector('.sb-link')).focus();
  };
  app.querySelectorAll('[data-preview]').forEach(b => { b.onclick = async () => { if (await leaveOk()) go('preview'); }; });
  app.querySelector('[data-logout]')?.addEventListener('click', async () => {
    const v = await dialog({ title: '로그아웃', body: '<p>공용 PC라면 ‘모든 기기에서 로그아웃’을 고르세요.</p>', buttons: [{ label: '취소', value: null }, { label: '모든 기기에서', value: 'all' }, { label: '이 기기만', value: 'one', primary: true }] });
    if (!v) return;
    await api.signOut(v === 'all'); location.reload();
  });
  app.querySelector('.sb').addEventListener('click', async e => {
    if (e.target.closest('[data-sb-toggle]')) {
      const now = !shell.classList.contains('collapsed');
      shell.classList.toggle('collapsed', now);
      sidebarState.set(SB_KEY, now);
      const b = app.querySelector('[data-sb-toggle]'); const label = now ? '메뉴 펼치기' : '메뉴 접기';
      b.setAttribute('aria-expanded', String(!now)); b.setAttribute('aria-label', label); b.title = label;
      b.innerHTML = icon(now ? 'expand' : 'collapse');
      return;
    }
    if (e.target.closest('[data-drawer-close]')) { setDrawer(false); return; }
    const b = e.target.closest('[data-tab]'); if (!b) return;
    if (!(await leaveOk())) return;
    S.tab = b.dataset.tab; S.editing = null; S.returnTo = null; renderShell();
    if (matchMedia('(max-width: 767px)').matches) window.scrollTo(0, 0);
  });
  app.querySelector('[data-drawer-open]').onclick = () => setDrawer(true);
  app.querySelector('.sb-backdrop').onclick = () => setDrawer(false);
  app.querySelectorAll('.abar, .mbar').forEach(el => el.classList.toggle('scrolled', window.scrollY > 4));
  drawPanel();
}

function go(hash) { if (location.hash !== '#' + hash) location.hash = hash; else setPreview(hash === 'preview'); }

async function leaveOk() {
  if (!S.dirty) return true;
  const ok = await ask('저장하지 않은 변경 사항', '<p>나가면 이 화면에서 바꾼 내용이 사라집니다. (입력 중인 내용은 이 기기에 임시 보관되어 다음에 다시 불러올 수 있습니다.)</p>', '나가기', true);
  if (ok) S.dirty = false;
  return ok;
}

function renderPreview() {
  app.innerHTML = '<div id="pv"></div><button type="button" class="btn primary preview-exit">편집으로 돌아가기</button>';
  app.querySelector('.preview-exit').onclick = () => { history.pushState(null, '', location.pathname); setPreview(false); };
  S.preview = mountPortfolio(app.querySelector('#pv'), publicItems(S.items), { useHash: false, footerNote: '공개 미리보기 — 방문자에게 보이는 화면과 같습니다' });
}

function drawPanel() {
  const panel = app.querySelector('#panel');
  if (S.editing) return drawForm(panel);
  if (S.tab === 'profile') { S.editing = profileOf(S.items).id ? structuredClone(profileOf(S.items)) : newItem('profile'); return drawForm(panel); }
  if (S.tab === 'stats') return drawStats(panel);
  if (S.tab === 'backup') return drawBackup(panel);
  drawList(panel);
}

// ---------- 목록 ----------
function newItem(kind) {
  const sorts = byKind(S.items, kind).map(i => i.sort || 0);
  const base = { id: uid(), kind, data: {}, visibility: 'private', status: 'published', isSample: false, sort: (sorts.length ? Math.max(...sorts) : 0) + 1, updatedAt: null, _new: true };
  if (['education', 'experience', 'activity', 'award', 'certificate', 'language', 'tool', 'competency'].includes(kind)) base.visibility = 'public';
  if (kind === 'profile') Object.assign(base, { visibility: 'public', data: { contacts: { email: '', links: [] }, interests: [], primaryRoles: ['public', 'academic'], resumePublic: true } });
  if (kind === 'competency') base.data.roles = {};
  return base;
}

function metaLine(it) {
  const d = it.data;
  if (it.kind === 'project') return [period(d.startDate, d.endDate), d.type, d.featured ? `대표 ${d.featuredOrder || ''}` : ''].filter(Boolean).join(' · ');
  if (it.kind === 'competency') return Object.entries(d.roles || {}).filter(([, v]) => v).map(([r, v]) => `${ROLES.find(x => x.id === r)?.name} ${v === 'core' ? '●' : '○'}`).join(' · ');
  if (d.startDate) return period(d.startDate, d.endDate);
  return fmtMonth(d.date) || d.category || '';
}
function badges(it) {
  return [
    it.visibility !== 'public' ? '<span class="badge lock">비공개</span>' : '',
    it.status === 'draft' ? '<span class="badge">초안</span>' : '',
    it.isSample ? '<span class="badge">예시</span>' : '',
    S.notes[it.id] ? '<span class="badge lock">취업 메모</span>' : '',
    (n => (n ? `<span class="badge" title="아직 채우지 않은 필수 칸">빈 칸 ${n}</span>` : ''))(validate(it, S.items).missing.length),
  ].join('');
}

function drawList(panel) {
  const kind = S.tab;
  const def = KINDS[kind];
  const list = byKind(S.items, kind);
  const sortable = ['project', 'tool', 'competency'].includes(kind);
  panel.innerHTML = `<div class="phead"><div><h2>${def.label}</h2><span class="muted small">${list.length}건${sortable ? ' · ↑↓로 순서 변경' : ' · 화면에는 기간 최신순으로 표시'}</span></div>
      <button type="button" class="btn primary" data-new>+ 새 ${def.label}</button></div>
    ${list.length ? `<ul class="rows">${list.map((it, i) => `<li class="rowi"><div class="main"><div class="ttl">${esc(def.title(it.data) || '(제목 없음)')}${badges(it)}</div><div class="meta">${esc(metaLine(it))}</div></div>
      <div class="acts">${sortable ? `<button type="button" class="btn small" data-up="${i}" aria-label="위로" ${i === 0 ? 'disabled' : ''}>↑</button><button type="button" class="btn small" data-down="${i}" aria-label="아래로" ${i === list.length - 1 ? 'disabled' : ''}>↓</button>` : ''}
      <button type="button" class="btn small" data-edit="${it.id}">수정</button><button type="button" class="btn small danger" data-del="${it.id}">삭제</button></div></li>`).join('')}</ul>`
      : `<p class="empty">아직 ${def.label} 항목이 없습니다.</p>`}`;
  panel.querySelector('[data-new]').onclick = () => { S.editing = newItem(kind); drawPanel(); };
  panel.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.edit) { S.editing = structuredClone(S.items.find(x => x.id === b.dataset.edit)); drawPanel(); }
    if (b.dataset.del) removeItem(b.dataset.del);
    if (b.dataset.up || b.dataset.down) {
      const i = Number(b.dataset.up ?? b.dataset.down), j = b.dataset.up ? i - 1 : i + 1;
      const a = structuredClone(list[i]), c = structuredClone(list[j]);
      [a.sort, c.sort] = [c.sort ?? j, a.sort ?? i];
      if (a.sort === c.sort) { a.sort = j; c.sort = i; }
      try { mergeSaved(await api.saveMany([a, c])); drawPanel(); } catch (err) { toast('순서를 저장하지 못했습니다: ' + err.message); }
    }
  };
}

function mergeSaved(saved) {
  (Array.isArray(saved) ? saved : [saved]).forEach(s => {
    const i = S.items.findIndex(x => x.id === s.id);
    if (i >= 0) S.items[i] = s; else S.items.push(s);
  });
  S.lastSaved = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  const el = app.querySelector('#saved'); if (el) el.textContent = '마지막 저장 ' + S.lastSaved;
}

async function removeItem(id) {
  const it = S.items.find(x => x.id === id);
  const title = KINDS[it.kind]?.title(it.data) || '';
  if (!(await ask('삭제할까요?', `<p><b>${esc(title)}</b>을(를) 삭제합니다. 삭제 후 10초 동안 되돌릴 수 있습니다.</p>`, '삭제', true))) return;
  const note = S.notes[id];
  try {
    await api.deleteItem(id);
    S.items = S.items.filter(x => x.id !== id); delete S.notes[id];
    if (it.kind === 'project') {
      // 삭제한 프로젝트를 가리키던 관련 프로젝트 연결은 화면에서 자동으로 빠진다
    }
    renderShell();
    toast('삭제했습니다.', { label: '되돌리기', run: async () => {
      try {
        mergeSaved(await api.saveItem({ ...it, updatedAt: null }, { force: true }));
        if (note) { await api.saveNote(id, note); S.notes[id] = note; }
        renderShell(); toast('되돌렸습니다.');
      } catch (err) { toast('되돌리지 못했습니다: ' + err.message); }
    } });
  } catch (err) { toast('삭제하지 못했습니다: ' + err.message); }
}

// ---------- 입력 폼 ----------
const competencies = () => byKind(S.items, 'competency');
const projectsList = () => byKind(S.items, 'project');
const toolsList = () => byKind(S.items, 'tool');

function fieldHTML(f, item) {
  const d = item.data;
  const v = f.path ? get(d, f.path) : d[f.key];
  const id = 'f-' + f.key;
  const req = f.required ? ' <span class="req" aria-hidden="true">*</span>' : '';
  const wrap = (inner, help = '') => `<div class="fld" data-key="${f.key}"><label for="${id}">${esc(f.label)}${req}</label>${inner}${help ? `<div class="help">${help}</div>` : ''}</div>`;
  const group = (inner, help = '') => `<div class="fld" data-key="${f.key}"><span class="lbl">${esc(f.label)}${req}</span>${inner}${help ? `<div class="help">${help}</div>` : ''}</div>`;
  switch (f.type) {
    case 'text': case 'slug': return wrap(`<input id="${id}" type="text" value="${esc(v ?? '')}" ${f.max ? `maxlength="${f.max}"` : ''}>`, f.type === 'slug' ? '비워 두면 제목으로 만듭니다. 상세 주소는 #p-이름 입니다.' : '');
    case 'number': return wrap(`<input id="${id}" type="number" step="${f.step || '1'}" value="${esc(v ?? '')}">`);
    case 'month': return wrap(`<input id="${id}" type="month" value="${esc(v ?? '')}">`);
    case 'textarea': return wrap(`<textarea id="${id}">${esc(v ?? '')}</textarea>`);
    case 'lines': return wrap(`<textarea id="${id}">${esc((v || []).join('\n'))}</textarea>`, '한 줄에 하나씩 적습니다.');
    case 'select': {
      if (!f.custom) return wrap(`<select id="${id}"><option value="">선택</option>${f.options.map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`);
      const own = v && !f.options.includes(v);
      return wrap(`<div class="sel-custom"><select id="${id}" data-custom-select><option value="">선택</option>${f.options.map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}
        <option value="__custom__" ${own ? 'selected' : ''}>직접 입력…</option></select>
        <input type="text" data-custom-input aria-label="${esc(f.label)} 직접 입력" placeholder="예: 교내 활동" maxlength="20" value="${own ? esc(v) : ''}" ${own ? '' : 'hidden'}></div>`,
        '목록에 없으면 ‘직접 입력…’을 고르세요.');
    }
    case 'bool': return `<div class="fld checks" data-key="${f.key}"><label><input id="${id}" type="checkbox" ${v ? 'checked' : ''}> ${esc(f.label)}</label></div>`;
    case 'competency': return wrap(`<select id="${id}"><option value="">선택</option>${competencies().map(c => `<option value="${esc(c.data.cid)}" ${c.data.cid === v ? 'selected' : ''}>${esc(c.data.name)}</option>`).join('')}</select>`);
    case 'competencies': return group(`<div class="checks">${competencies().map(c => `<label><input type="checkbox" value="${esc(c.data.cid)}" ${(v || []).includes(c.data.cid) ? 'checked' : ''}> ${esc(c.data.name)}</label>`).join('')}</div>`, '주 역량은 자동으로 포함됩니다.');
    case 'tools': return group(`<div class="checks">${toolsList().map(t => `<label><input type="checkbox" value="${esc(t.data.name)}" ${(v || []).includes(t.data.name) ? 'checked' : ''}> ${esc(t.data.name)}</label>`).join('') || '<span class="muted small">‘스킬’ 메뉴에서 도구를 먼저 등록하세요.</span>'}</div>`, '스킬 막대는 여기서 고른 횟수로 계산됩니다.');
    case 'projects': return group(`<ul class="projpick">${projectsList().map(p => `<li><label><input type="checkbox" value="${esc(p.id)}" ${(v || []).includes(p.id) ? 'checked' : ''}> ${esc(p.data.title)}</label>
        <span class="pp-acts"><button type="button" class="btn small" data-editproj="${esc(p.id)}" aria-label="${esc(p.data.title)} 프로젝트 수정">수정</button>
        <button type="button" class="btn small danger" data-delproj="${esc(p.id)}" aria-label="${esc(p.data.title)} 프로젝트 삭제">삭제</button></span></li>`).join('') || '<li class="muted small">프로젝트가 없습니다.</li>'}</ul>
      <button type="button" class="btn small" data-newproj>+ 새 프로젝트 만들고 연결</button>`, '체크하면 이 항목 아래에 프로젝트 링크가 붙고, 체크를 풀면 연결만 끊깁니다. ‘수정’은 프로젝트를 고친 뒤 이 화면으로 돌아오고, ‘삭제’는 프로젝트 자체를 지웁니다.');
    case 'roles': return group(`<div class="grid2">${ROLES.map(r => `<label class="small">${esc(r.name)}<select data-role="${r.id}"><option value="">해당 없음</option><option value="core" ${(v || {})[r.id] === 'core' ? 'selected' : ''}>● 핵심</option><option value="related" ${(v || {})[r.id] === 'related' ? 'selected' : ''}>○ 관련</option></select></label>`).join('')}</div>`);
    case 'metrics': return group(`<div class="rep" data-rep="metric">${(v || []).map(metricRow).join('')}</div><button type="button" class="btn small" data-add="metric">+ 성과 추가</button>`, '표준 key를 고르면 같은 종류의 성과를 같은 단위로 정리할 수 있습니다.');
    case 'evidence': return group(`<div class="rep" data-rep="ev">${(v || []).map(evRow).join('')}</div><button type="button" class="btn small" data-add="ev">+ 증빙 추가</button>`,
      '새 증빙은 기본 비공개입니다. 이용자·아동 얼굴, 실명, 연락처가 있으면 가리거나 비공개로 두세요. 이미지는 올릴 때 촬영 위치 정보가 지워집니다.');
    default: return '';
  }
}
const metricRow = m => `<div class="rep-row metric"><label><span class="lbl">항목</span><input data-f="label" value="${esc(m.label || '')}"></label>
  <label><span class="lbl">값</span><input data-f="value" type="number" step="any" value="${esc(m.value ?? '')}"></label>
  <label><span class="lbl">단위</span><input data-f="unit" value="${esc(m.unit || '')}"></label>
  <label><span class="lbl">표준 key</span><select data-f="key">${METRIC_KEYS.map(k => `<option value="${k.key}" ${k.key === (m.key || '') ? 'selected' : ''}>${esc(k.label)}</option>`).join('')}</select></label>
  <button type="button" class="btn small danger" data-rm aria-label="성과 삭제">삭제</button></div>`;
const evRow = e => `<div class="rep-row ev" data-size="${esc(e.size || '')}"><label><span class="lbl">종류</span><select data-f="type">${[['file', '파일'], ['image', '이미지'], ['link', '링크']].map(([k, l]) => `<option value="${k}" ${k === (e.type || 'file') ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
  <label><span class="lbl">제목</span><input data-f="title" value="${esc(e.title || '')}"></label>
  <label><span class="lbl">주소(URL)</span><input data-f="url" value="${esc(e.url || '')}" placeholder="https://… 또는 파일 올리기"></label>
  <label class="checks" style="margin:0"><input type="checkbox" data-f="public" ${e.public ? 'checked' : ''}> 공개</label>
  <div class="wide"><input data-f="description" value="${esc(e.description || '')}" placeholder="한 줄 설명(예: PDF 6쪽, 얼굴 모자이크)" style="flex:1;min-width:200px">
  <label class="btn small">파일 올리기<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" data-upload hidden></label>
  <label class="checks" style="margin:0"><input type="checkbox" data-pii ${e.public ? 'checked' : ''}> 제3자 개인정보 없음 확인</label>
  <button type="button" class="btn small danger" data-rm>삭제</button></div></div>`;
const linkRow = l => `<div class="rep-row link"><label><span class="lbl">이름</span><input data-f="label" value="${esc(l.label || '')}"></label><label><span class="lbl">주소</span><input data-f="url" value="${esc(l.url || '')}"></label><label class="checks" style="margin:0"><input type="checkbox" data-f="public" ${l.public !== false ? 'checked' : ''}> 공개</label><button type="button" class="btn small danger" data-rm>삭제</button></div>`;
const interestRow = i => `<div class="rep-row interest"><label><span class="lbl">아이콘</span><input data-f="icon" value="${esc(i.icon || '')}" maxlength="4"></label><label><span class="lbl">관심 분야</span><input data-f="label" value="${esc(i.label || '')}"></label><button type="button" class="btn small danger" data-rm>삭제</button></div>`;

function profileFormHTML(item) {
  const d = item.data; const c = d.contacts || {};
  const up = (key, label, accept, help) => `<div class="fld"><label for="pf-${key}">${label}</label><div style="display:flex;gap:8px;flex-wrap:wrap"><input id="pf-${key}" data-p="${key}" type="text" value="${esc(d[key] || '')}" placeholder="https://… 또는 파일 올리기" style="flex:1;min-width:200px">
    <label class="btn small">파일 올리기<input type="file" accept="${accept}" data-pupload="${key}" hidden></label></div>${help ? `<div class="help">${help}</div>` : ''}</div>`;
  return `
    <div class="grid2"><div class="fld"><label for="pf-name">이름 <span class="req">*</span></label><input id="pf-name" data-p="name" type="text" value="${esc(d.name || '')}"></div>
    <div class="fld"><label for="pf-tagline">희망 직무 한 줄</label><input id="pf-tagline" data-p="tagline" type="text" maxlength="40" value="${esc(d.tagline || '')}"></div></div>
    <div class="fld"><label for="pf-headline">한 줄 소개(콜아웃)</label><input id="pf-headline" data-p="headline" type="text" value="${esc(d.headline || '')}"></div>
    <div class="fld"><label for="pf-bio">자기소개(3~5문장)</label><textarea id="pf-bio" data-p="bio" maxlength="600">${esc(d.bio || '')}</textarea></div>
    <div class="fld"><span class="lbl">주 희망 직무(최대 2개)</span><div class="checks">${ROLES.map(r => `<label><input type="checkbox" data-role-pick value="${r.id}" ${(d.primaryRoles || []).includes(r.id) ? 'checked' : ''}> ${esc(r.name)}</label>`).join('')}</div><div class="help">역량 탭 순서와 희망 직무 태그가 이 선택을 따릅니다.</div></div>
    <div class="fld"><label for="pf-email">이메일 <span class="req">*</span></label><input id="pf-email" data-p="email" type="email" value="${esc(c.email || '')}"><div class="help">전화번호·주소는 입력받지 않습니다(개인정보 기준).</div></div>
    <div class="fld"><span class="lbl">링크(블로그·GitHub 등)</span><div class="rep" data-rep="link">${(c.links || []).map(linkRow).join('')}</div><button type="button" class="btn small" data-add="link">+ 링크 추가</button></div>
    <div class="fld"><span class="lbl">관심 분야(최대 4개)</span><div class="rep" data-rep="interest">${(d.interests || []).map(interestRow).join('')}</div><button type="button" class="btn small" data-add="interest">+ 관심 분야 추가</button></div>
    ${up('photo', '프로필 사진', 'image/jpeg,image/png,image/webp')}
    ${up('cover', '커버 이미지(비우면 회색)', 'image/jpeg,image/png,image/webp')}
    ${up('resumeFile', '이력서 PDF', 'application/pdf', '연락처·주소를 뺀 공개용 판본을 올리세요.')}
    <div class="fld checks"><label><input type="checkbox" data-p="resumePublic" ${d.resumePublic !== false ? 'checked' : ''}> 이력서 다운로드 버튼 공개</label></div>`;
}

function drawForm(panel) {
  const item = S.editing;
  const def = KINDS[item.kind];
  const isProfile = item.kind === 'profile';
  const draftKey = 'lis-draft-' + item.id;
  const draft = api.store.get(draftKey);
  panel.innerHTML = `<div class="phead"><div><h2>${isProfile ? '프로필' : `${def.label} ${item._new ? '추가' : '수정'}`}${badges(item)}</h2>
      ${!isProfile ? `<button type="button" class="btn small" data-back>${S.returnTo ? `← ${esc(KINDS[S.returnTo.item.kind].label)} 편집으로 돌아가기` : '← 목록'}</button>` : ''}</div></div>
    ${S.returnTo ? `<div class="alert">‘${esc(KINDS[S.returnTo.item.kind].title(S.returnTo.item.data) || KINDS[S.returnTo.item.kind].label)}’ 편집 중에 열었습니다. 저장하거나 취소하면 그 화면으로 돌아갑니다(입력하던 내용은 그대로 남아 있습니다).</div>` : ''}
    ${draft ? `<div class="alert" id="draftbar">저장하지 않은 입력이 이 기기에 남아 있습니다. <button type="button" class="btn small" data-draft="load">불러오기</button> <button type="button" class="btn small" data-draft="drop">버리기</button></div>` : ''}
    ${item.isSample ? `<div class="alert">이 항목은 ‘예시’ 데이터입니다. 실제 내용으로 고쳤다면 <button type="button" class="btn small" data-unsample>예시 해제</button></div>` : ''}
    <div id="errs"></div>
    <form class="form" id="frm" novalidate>
      ${isProfile ? profileFormHTML(item) : def.fields.map(f => fieldHTML(f, item)).join('')}
      ${!isProfile ? `<div class="grid2">
        <div class="fld"><label for="pub-vis">공개 범위</label><select id="pub-vis"><option value="public" ${item.visibility === 'public' ? 'selected' : ''}>공개</option><option value="private" ${item.visibility !== 'public' ? 'selected' : ''}>비공개(소유자만)</option></select></div>
        <div class="fld"><label for="pub-status">공개 상태</label><select id="pub-status"><option value="published" ${item.status !== 'draft' ? 'selected' : ''}>완성</option><option value="draft" ${item.status === 'draft' ? 'selected' : ''}>초안(공개 화면에 안 보임)</option></select></div></div>
        <div class="private-box fld"><label for="f-careernote">🔒 취업 메모 — 항상 비공개</label><textarea id="f-careernote" placeholder="지원처별 강조점, 면접 예상 질문, 자기소개서에 쓸 문장">${esc(S.pendingNote?.id === item.id ? S.pendingNote.note : (S.notes[item.id] || ''))}</textarea></div>` : ''}
      <div class="formbar"><button type="submit" class="btn primary">저장</button>${!isProfile ? '<button type="button" class="btn" data-back>취소</button>' : ''}<span class="small muted">저장하면 ${api.MODE === 'demo' ? '이 브라우저의 데모 데이터에' : '바로 공개 사이트에'} 반영됩니다(공개 항목만).</span></div>
    </form>`;

  S.pendingNote = null;
  const frm = panel.querySelector('#frm');
  const markDirty = () => { S.dirty = true; api.store.set(draftKey, { item: collect(), note: frm.querySelector('#f-careernote')?.value }); };
  frm.addEventListener('input', markDirty);
  frm.addEventListener('change', markDirty);

  panel.onclick = async e => {
    const b = e.target.closest('button,[data-add]'); if (!b) return;
    if (b.dataset.back !== undefined) { if (await leaveOk()) { api.store.del(draftKey); if (!restoreReturn()) { S.editing = null; drawPanel(); } } return; }
    if (b.dataset.delproj) { await deleteProjectInForm(b.dataset.delproj); return; }
    if (b.dataset.editproj || b.dataset.newproj !== undefined) {
      const proj = b.dataset.editproj ? S.items.find(x => x.id === b.dataset.editproj) : null;
      S.returnTo = { tab: S.tab, item: collect(), note: panel.querySelector('#f-careernote')?.value ?? null, dirty: S.dirty, linkNew: !proj };
      S.dirty = false;
      S.tab = 'project';
      S.editing = proj ? structuredClone(proj) : newItem('project');
      renderShell();
      return;
    }
    if (b.dataset.draft === 'load') { S.editing = draft.item; if (draft.note != null) S.notes[item.id] = draft.note; drawForm(panel); S.dirty = true; return; }
    if (b.dataset.draft === 'drop') { api.store.del(draftKey); panel.querySelector('#draftbar')?.remove(); return; }
    if (b.dataset.unsample !== undefined) { S.editing = { ...collect(), isSample: false }; S.dirty = true; drawForm(panel); toast('예시 표시를 뺐습니다. 저장해야 반영됩니다.'); return; }
    if (b.dataset.add) {
      const rep = panel.querySelector(`[data-rep="${b.dataset.add}"]`);
      const html = { metric: metricRow({}), ev: evRow({ type: 'file', public: false }), link: linkRow({ public: true }), interest: interestRow({}) }[b.dataset.add];
      rep.insertAdjacentHTML('beforeend', html); markDirty(); return;
    }
    if (b.dataset.rm !== undefined) { b.closest('.rep-row').remove(); markDirty(); }
  };

  panel.onchange = async e => {
    const inp = e.target;
    if (inp.matches('[data-upload], [data-pupload]') && inp.files[0]) {
      const row = inp.closest('.rep-row');
      const isPublic = row ? row.querySelector('[data-f=public]').checked : true;
      try {
        toast('올리는 중…');
        const res = await api.uploadFile(inp.files[0], isPublic);
        if (row) {
          row.querySelector('[data-f=url]').value = res.url;
          row.dataset.size = res.size;
          if (!row.querySelector('[data-f=title]').value) row.querySelector('[data-f=title]').value = res.name;
        } else panel.querySelector(`[data-p="${inp.dataset.pupload}"]`).value = res.url;
        markDirty(); toast('올렸습니다. 저장해야 반영됩니다.');
      } catch (err) { toast('올리지 못했습니다: ' + err.message); }
      inp.value = '';
    }
    if (inp.matches('[data-custom-select]')) {
      const t = inp.parentElement.querySelector('[data-custom-input]');
      t.hidden = inp.value !== '__custom__';
      if (!t.hidden) t.focus();
    }
    if (inp.matches('[data-role-pick]')) {
      const picked = [...panel.querySelectorAll('[data-role-pick]:checked')];
      if (picked.length > 2) { inp.checked = false; toast('주 희망 직무는 최대 2개입니다.'); }
    }
  };

  frm.onsubmit = async e => { e.preventDefault(); await save(panel, draftKey); };
}

// 관련 프로젝트 목록에서 프로젝트 자체를 삭제(편집 중인 내용은 유지, 10초 되돌리기)
async function deleteProjectInForm(pid) {
  const proj = S.items.find(x => x.id === pid);
  if (!proj) return;
  const usedBy = S.items.filter(i => i.id !== S.editing.id && (i.data.relatedProjects || []).includes(pid)).length;
  const ok = await ask('프로젝트를 삭제할까요?',
    `<p><b>${esc(proj.data.title)}</b> 프로젝트 자체를 삭제합니다. 공개 사이트의 프로젝트 목록에서도 사라집니다.${usedBy ? ` 다른 이력 ${usedBy}건에 연결된 링크도 함께 사라집니다.` : ''}</p><p class="small muted">연결만 끊으려면 삭제 대신 체크를 해제하세요. 삭제 후 10초 동안 되돌릴 수 있습니다.</p>`, '프로젝트 삭제', true);
  if (!ok) return;
  const panel = app.querySelector('#panel');
  const keep = () => { const cur = collect(); return { cur, note: panel.querySelector('#f-careernote')?.value ?? null, dirty: S.dirty }; };
  const redraw = ({ cur, note, dirty }) => {
    S.editing = cur; S.dirty = dirty;
    if (note != null) S.pendingNote = { id: cur.id, note };
    drawForm(app.querySelector('#panel'));
    app.querySelectorAll('.sb [data-tab]').forEach(btn => {
      if (KINDS[btn.dataset.tab]) btn.querySelector('.sb-count').textContent = byKind(S.items, btn.dataset.tab).length;
    });
  };
  const before = keep();
  const wasLinked = (before.cur.data.relatedProjects || []).includes(pid);
  const projNote = S.notes[pid];
  try {
    await api.deleteItem(pid);
    S.items = S.items.filter(x => x.id !== pid); delete S.notes[pid];
    before.cur.data.relatedProjects = (before.cur.data.relatedProjects || []).filter(x => x !== pid);
    redraw(before);
    toast('프로젝트를 삭제했습니다.', { label: '되돌리기', run: async () => {
      try {
        const state = keep();
        mergeSaved(await api.saveItem({ ...proj, updatedAt: null }, { force: true }));
        if (projNote) { await api.saveNote(pid, projNote); S.notes[pid] = projNote; }
        if (wasLinked) state.cur.data.relatedProjects = [...new Set([...(state.cur.data.relatedProjects || []), pid])];
        redraw(state);
        toast('되돌렸습니다.');
      } catch (err) { toast('되돌리지 못했습니다: ' + err.message); }
    } });
  } catch (err) { toast('삭제하지 못했습니다: ' + err.message); }
}

// 이력 항목 편집 중 '관련 프로젝트'에서 프로젝트를 열었다가 돌아오기
function restoreReturn(savedProject) {
  const rt = S.returnTo;
  if (!rt) return false;
  S.returnTo = null;
  const item = rt.item;
  if (savedProject && savedProject.kind === 'project' && rt.linkNew) {
    item.data.relatedProjects = [...new Set([...(item.data.relatedProjects || []), savedProject.id])];
  }
  S.tab = rt.tab;
  S.editing = item;
  S.dirty = rt.dirty || !!(savedProject && rt.linkNew);
  if (rt.note != null) {
    // 입력하던 취업 메모를 폼에 다시 채우기 위해 잠시 보관(저장 전까지 DB에는 반영되지 않음)
    S.pendingNote = { id: item.id, note: rt.note };
  }
  renderShell();
  return true;
}

function collect() {
  const panel = app.querySelector('#panel');
  const item = structuredClone(S.editing);
  const d = item.data = item.data || {};
  if (item.kind === 'profile') {
    panel.querySelectorAll('[data-p]').forEach(el => {
      const k = el.dataset.p;
      const v = el.type === 'checkbox' ? el.checked : el.value.trim();
      if (k === 'email') { d.contacts = d.contacts || {}; d.contacts.email = v; } else d[k] = v;
    });
    d.contacts = d.contacts || {};
    d.contacts.links = [...panel.querySelectorAll('[data-rep=link] .rep-row')].map(r => ({ label: r.querySelector('[data-f=label]').value.trim(), url: r.querySelector('[data-f=url]').value.trim(), public: r.querySelector('[data-f=public]').checked })).filter(l => l.url);
    d.interests = [...panel.querySelectorAll('[data-rep=interest] .rep-row')].map(r => ({ icon: r.querySelector('[data-f=icon]').value.trim(), label: r.querySelector('[data-f=label]').value.trim() })).filter(i => i.label).slice(0, 4);
    d.primaryRoles = [...panel.querySelectorAll('[data-role-pick]:checked')].map(x => x.value).slice(0, 2);
    item.visibility = 'public'; item.status = 'published';
    return item;
  }
  KINDS[item.kind].fields.forEach(f => {
    const box = panel.querySelector(`[data-key="${f.key}"]`); if (!box) return;
    let v;
    const el = box.querySelector('input, select, textarea');
    switch (f.type) {
      case 'number': v = el.value === '' ? null : Number(el.value); break;
      case 'bool': v = el.checked; break;
      case 'lines': v = el.value.split('\n').map(s => s.trim()).filter(Boolean); break;
      case 'competencies': case 'tools': case 'projects': v = [...box.querySelectorAll('input:checked')].map(x => x.value); break;
      case 'roles': v = Object.fromEntries([...box.querySelectorAll('[data-role]')].filter(s => s.value).map(s => [s.dataset.role, s.value])); break;
      case 'metrics': v = [...box.querySelectorAll('.rep-row')].map(r => ({ label: r.querySelector('[data-f=label]').value.trim(), value: Number(r.querySelector('[data-f=value]').value), unit: r.querySelector('[data-f=unit]').value.trim(), key: r.querySelector('[data-f=key]').value })).filter(m => m.label); break;
      case 'evidence': v = [...box.querySelectorAll('.rep-row')].map(r => ({ type: r.querySelector('[data-f=type]').value, title: r.querySelector('[data-f=title]').value.trim(), url: r.querySelector('[data-f=url]').value.trim(), description: r.querySelector('[data-f=description]').value.trim(), public: r.querySelector('[data-f=public]').checked, piiChecked: r.querySelector('[data-pii]').checked, size: Number(r.dataset.size) || undefined })).filter(x => x.title); break;
      case 'select': v = el.value === '__custom__' ? box.querySelector('[data-custom-input]').value.trim() : el.value; break;
      default: v = el.value.trim();
    }
    if (f.path) { d[f.path[0]] = d[f.path[0]] || {}; d[f.path[0]][f.path[1]] = v; } else d[f.key] = v;
  });
  if (item.kind === 'project') {
    if (!d.slug) d.slug = slugify(d.title);
    if (d.primarySkill && !(d.skills || []).includes(d.primarySkill)) d.skills = [d.primarySkill, ...(d.skills || [])];
    if (d.featured && !d.featuredOrder) d.featuredOrder = Math.min(3, projectsList().filter(p => p.data.featured && p.id !== item.id).length + 1);
    if (!d.featured) delete d.featuredOrder;
  }
  item.visibility = panel.querySelector('#pub-vis')?.value || item.visibility;
  item.status = panel.querySelector('#pub-status')?.value || item.status;
  return item;
}

async function save(panel, draftKey) {
  const item = collect();
  const { missing, errors: errs } = validate(item, S.items);
  const willShow = item.visibility === 'public' && item.status !== 'draft';
  // 공개 증빙의 개인정보 확인은 공개될 때만 저장을 막는다(초안·비공개는 나중에 확인해도 됨)
  if (item.kind === 'project' && willShow) {
    const unchecked = (item.data.evidence || []).filter(ev => ev.public && !ev.piiChecked);
    if (unchecked.length) errs.push(`공개 증빙 ‘${unchecked[0].title}’에 ‘제3자 개인정보 없음 확인’을 체크하세요. (지금 확인이 어렵다면 공개 상태를 ‘초안’으로 두고 저장하세요.)`);
  }
  const box = panel.querySelector('#errs');
  if (errs.length) {
    box.innerHTML = `<div class="errors" role="alert" tabindex="-1"><b>저장하지 못했습니다</b><ul>${errs.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`;
    box.firstElementChild.focus();
    return;
  }
  if (missing.length && willShow && item.kind !== 'profile') {
    const v = await dialog({
      title: '아직 채우지 않은 칸이 있어요',
      body: `<ul>${missing.map(m => `<li>${esc(m)}</li>`).join('')}</ul><p class="small">‘초안으로 저장’하면 공개 사이트에는 보이지 않고, 다 채운 뒤 공개 상태를 ‘완성’으로 바꾸면 나타납니다.</p>`,
      buttons: [{ label: '취소', value: null }, { label: '그대로 공개 저장', value: 'publish' }, { label: '초안으로 저장', value: 'draft', primary: true }],
    });
    if (!v) return;
    if (v === 'draft') item.status = 'draft';
  }
  box.innerHTML = '';
  if (item.visibility === 'public') {
    const pii = piiWarnings(item);
    if (pii.length && !(await ask('개인정보가 있는 것 같습니다', `<p>공개 내용에 <b>${esc(pii.join(', '))}</b>로 보이는 값이 있습니다. 포트폴리오에는 넣지 않는 것이 원칙입니다. 그래도 저장할까요?</p>`, '그래도 저장'))) return;
  }
  const noteEl = panel.querySelector('#f-careernote');
  const persist = async force => {
    const { _new, ...clean } = item;
    const saved = await api.saveItem(clean, { force });
    if (noteEl) { const n = noteEl.value.trim(); await api.saveNote(saved.id, n); if (n) S.notes[saved.id] = n; else delete S.notes[saved.id]; }
    mergeSaved(saved);
    api.store.del(draftKey);
    S.dirty = false;
    S.editing = item.kind === 'profile' ? structuredClone(saved) : null;
    if (restoreReturn(saved)) { toast('저장했습니다. 원래 편집 화면으로 돌아왔습니다.'); return; }
    renderShell();
    toast(missing.length ? `저장했습니다. 아직 빈 칸 ${missing.length}개: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? ' 외' : ''}` : '저장했습니다.');
  };
  try { await persist(false); }
  catch (err) {
    if (err.code === 'conflict') {
      const v = await dialog({ title: '다른 기기에서 수정된 항목', body: '<p>편집을 시작한 뒤 다른 기기에서 이 항목이 저장되었습니다. 지금 내용으로 덮어쓸까요, 아니면 다른 기기의 내용을 불러올까요?</p>', buttons: [{ label: '다시 불러오기', value: 'reload' }, { label: '덮어쓰기', value: 'force', primary: true }] });
      if (v === 'force') { try { await persist(true); } catch (e2) { toast('저장하지 못했습니다: ' + e2.message); } }
      if (v === 'reload') { await reload(); S.editing = structuredClone(S.items.find(x => x.id === item.id)) || null; S.dirty = false; renderShell(); }
      return;
    }
    toast('저장하지 못했습니다: ' + (err.message || err));
  }
}

// ---------- 방문 통계 (F-9) ----------
async function drawStats(panel) {
  panel.innerHTML = '<h2>방문 통계</h2><p class="muted">불러오는 중…</p>';
  let ev = [];
  try { ev = await api.loadEvents(30); } catch (e) { panel.innerHTML = `<h2>방문 통계</h2><p class="errors">불러오지 못했습니다: ${esc(e.message)}</p>`; return; }
  const days = [...Array(30)].map((_, i) => new Date(Date.now() - (29 - i) * 864e5).toISOString().slice(0, 10));
  const views = ev.filter(e => e.type === 'view');
  const perDay = days.map(d => new Set(views.filter(v => v.created_at.slice(0, 10) === d).map(v => v.session)).size);
  const count = (list, key) => Object.entries(list.reduce((m, e) => { const k = e[key] || '(직접 방문)'; m[k] = (m[k] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]);
  const titleOf = slug => projectsList().find(p => p.data.slug === slug)?.data.title || slug;
  const max = Math.max(1, ...perDay);
  const W = 640, H = 160, P = 28;
  const x = i => P + (i * (W - P * 2)) / 29, y = v => H - P - (v / max) * (H - P * 2);
  const path = perDay.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const visitors = new Set(views.map(v => v.session)).size;
  const table = (rows, label) => rows.length ? `<table class="mini"><tbody>${rows.slice(0, 5).map(([k, n]) => `<tr><td>${esc(label ? label(k) : k)}</td><td class="n">${n}</td></tr>`).join('')}</tbody></table>` : '<p class="muted small">아직 기록이 없습니다.</p>';
  const base = location.href.replace(/admin\.html.*$/, '').split('#')[0];
  panel.innerHTML = `<h2>방문 통계 <span class="muted small">최근 30일</span></h2>
    ${api.MODE === 'demo' ? '<p class="alert">데모 모드에서는 이 브라우저에서 생긴 기록만 보입니다.</p>' : ''}
    <div class="stat-grid" style="margin-top:12px">
      <div class="metric"><div class="v">${visitors}</div><div class="l">방문(세션)</div></div>
      <div class="metric"><div class="v">${ev.filter(e => e.type === 'project').length}</div><div class="l">프로젝트 상세 열람</div></div>
      <div class="metric"><div class="v">${ev.filter(e => e.type === 'evidence').length}</div><div class="l">증빙 열기</div></div>
      <div class="metric"><div class="v">${ev.filter(e => e.type === 'resume').length}</div><div class="l">이력서 다운로드</div></div>
    </div>
    <div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="최근 30일 일별 방문 수, 최대 ${max}">
      <line x1="${P}" x2="${W - P}" y1="${H - P}" y2="${H - P}" stroke="#d6d5d1"/>
      <text x="${P}" y="${H - 8}" font-size="11" fill="#5f5e5a">${days[0].slice(5)}</text><text x="${W - P}" y="${H - 8}" font-size="11" fill="#5f5e5a" text-anchor="end">${days[29].slice(5)}</text>
      <text x="${P}" y="${P - 10}" font-size="11" fill="#5f5e5a">최대 ${max}</text>
      <path d="${path}" fill="none" stroke="#2f2e2b" stroke-width="2"/></svg></div>
    <div class="grid2" style="margin-top:16px">
      <div><h3 class="sub">많이 본 프로젝트</h3>${table(count(ev.filter(e => e.type === 'project'), 'target'), titleOf)}</div>
      <div><h3 class="sub">유입 경로</h3>${table(count(views, 'referrer'))}</div>
      <div><h3 class="sub">지원처별 링크(ref)</h3>${table(count(views.filter(v => v.ref), 'ref'))}</div>
      <div><h3 class="sub">기기</h3>${table(count(views, 'device'), k => (k === 'mobile' ? '모바일' : '데스크톱'))}</div>
    </div>
    <h3 class="sub">지원처별 링크 만들기</h3>
    <div class="grid2"><div class="fld"><label for="ref-n">기관 이름(영문·숫자 권장)</label><input id="ref-n" type="text" placeholder="예: seoul-lib"></div>
    <div class="fld"><label for="ref-r">이 링크로 보여줄 직무 순서</label><select id="ref-r"><option value="">주 희망 직무 그대로</option>${ROLES.map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select></div></div>
    <code class="box" id="ref-out">${esc(base)}</code> <button type="button" class="btn small" id="ref-copy" style="margin-top:8px">복사</button>
    <p class="small muted">방문 통계에는 IP·쿠키·기기 식별값을 저장하지 않으며, 로그인한 소유자의 방문은 집계하지 않습니다.</p>`;
  const upd = () => {
    const q = new URLSearchParams();
    const n = panel.querySelector('#ref-n').value.trim(); const r = panel.querySelector('#ref-r').value;
    if (n) q.set('ref', n); if (r) q.set('role', r);
    panel.querySelector('#ref-out').textContent = base + (q.toString() ? '?' + q : '');
  };
  panel.querySelector('#ref-n').oninput = upd; panel.querySelector('#ref-r').onchange = upd;
  panel.querySelector('#ref-copy').onclick = async () => { try { await navigator.clipboard.writeText(panel.querySelector('#ref-out').textContent); toast('복사했습니다.'); } catch { toast('복사하지 못했습니다. 직접 선택해 복사하세요.'); } };
}

// ---------- 백업·설정 (F-6.11, F-6.13) ----------
function drawBackup(panel) {
  const lb = api.store.get(LAST_BACKUP);
  const sizeKB = Math.round(new Blob([JSON.stringify(S.items)]).size / 1024);
  const counts = Object.keys(KINDS).map(k => `${KINDS[k].label} ${byKind(S.items, k).length}`).join(' · ');
  panel.innerHTML = `<h2>백업·설정</h2>
    <h3 class="sub">JSON 전체 백업</h3>
    <p>프로필·이력·프로젝트·비공개 항목·취업 메모를 모두 담습니다. <b>공개 저장소에는 올리지 마세요.</b> 무료 요금제에는 자동 백업이 없어 이 파일이 복구 수단입니다.</p>
    <p class="small muted">마지막 백업: ${lb ? new Date(lb).toLocaleString('ko-KR') : '없음'} · 데이터 크기 약 ${sizeKB}KB · ${esc(counts)}</p>
    <button type="button" class="btn primary" id="bk-out">전체 백업 받기</button>
    <h3 class="sub">백업 불러오기</h3>
    <p>현재 데이터를 백업 파일 내용으로 <b>모두 바꿉니다</b>. 바꾸기 전에 현재 데이터를 자동으로 백업합니다.</p>
    <label class="btn">JSON 파일 고르기<input type="file" accept="application/json,.json" id="bk-in" hidden></label>
    <h3 class="sub">이 기기 통계 제외</h3>
    <label class="checks"><input type="checkbox" id="ex" ${api.isStatsExcluded() ? 'checked' : ''}> 이 기기에서 연 방문은 통계에 넣지 않기</label>
    ${api.MODE === 'demo' ? `<h3 class="sub">데모 초기화</h3><p>이 브라우저에 저장한 데모 데이터를 지우고 예시 데이터로 되돌립니다.</p><button type="button" class="btn danger" id="reset">데모 데이터 초기화</button>` : ''}`;
  panel.querySelector('#bk-out').onclick = async () => offerJSON(await api.exportAll(), `portfolio-backup-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}.json`);
  panel.querySelector('#ex').onchange = e => { api.setStatsExcluded(e.target.checked); toast(e.target.checked ? '이 기기를 통계에서 뺍니다.' : '이 기기도 통계에 넣습니다.'); };
  panel.querySelector('#reset')?.addEventListener('click', async () => {
    if (await ask('데모 데이터를 초기화할까요?', '<p>이 브라우저에서 고친 내용이 모두 사라집니다.</p>', '초기화', true)) { api.resetDemo(); await reload(); renderShell(); toast('초기화했습니다.'); }
  });
  panel.querySelector('#bk-in').onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    let obj; try { obj = JSON.parse(await f.text()); } catch { obj = null; }
    const errs = api.checkBackup(obj);
    if (errs.length) return dialog({ title: '불러올 수 없는 파일입니다', body: `<ul>${errs.slice(0, 6).map(x => `<li>${esc(x)}</li>`).join('')}</ul><p class="small">현재 데이터는 바뀌지 않았습니다.</p>` });
    const projects = obj.items.filter(i => i.kind === 'project').length;
    const ok = await ask('백업으로 바꿀까요?', `<p>내보낸 날: ${esc(String(obj.exportedAt).slice(0, 10))}<br>항목 ${obj.items.length}건(프로젝트 ${projects}건), 취업 메모 ${(obj.careerNotes || []).length}건</p><p>먼저 현재 데이터를 백업 파일로 받은 뒤 바꿉니다.</p>`, '바꾸기', true);
    if (!ok) return;
    await offerJSON(await api.exportAll(), `portfolio-before-import-${Date.now()}.json`);
    try { await api.replaceAll(obj); await reload(); renderShell(); toast('백업을 불러왔습니다.'); }
    catch (err) { toast('불러오지 못했습니다: ' + err.message); }
  };
}

start();

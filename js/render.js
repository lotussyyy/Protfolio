// 공개 화면 그리기 (방문자 화면과 관리 화면의 '공개 미리보기'가 같은 코드를 쓴다: F-7.3)
import {
  KINDS, ROLES, METRIC_KEYS, PROJECT_TYPES, byKind, byKindRecent, profileOf, summaryCards, toolUsage,
  competencyOrder, fmtMonth, period,
} from './model.js';
import { icon, sidebarState } from './icons.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sample = it => (it?.isSample ? '<span class="badge" title="예시 데이터">예시</span>' : '');
const icons = { file: '📄', image: '🖼️', link: '🔗' };
const SEC = [
  ['sec-about', '소개', 'user'], ['sec-summary', '한눈에 보기', 'grid'], ['sec-resume', '이력', 'timeline'],
  ['sec-featured', '대표 프로젝트', 'star'], ['projects', '전체 프로젝트', 'folder'],
];

function initials(name) { return esc((name || '?').trim().slice(0, 1)); }
function kb(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(n / 1024)) + 'KB'; }
function host(u) { try { return new URL(u).hostname; } catch { return ''; } }

export function mountPortfolio(root, items, opts = {}) {
  // opts: { useHash, roleOverride, track(type, target), footerNote, adminHref }
  const track = opts.track || (() => {});
  const prof = profileOf(items);
  const p = prof.data || {};
  const roles = opts.roleOverride ? [opts.roleOverride] : (p.primaryRoles || []);
  const comps = competencyOrder(byKind(items, 'competency'), roles);
  const compName = id => comps.find(c => c.data.cid === id)?.data.name || id;
  const projects = byKind(items, 'project');
  const bySlug = s => projects.find(x => x.data.slug === s);
  const projLink = id => {
    const pr = projects.find(x => x.id === id);
    return pr ? `<a href="#p-${esc(pr.data.slug)}" data-open="${esc(pr.data.slug)}">${esc(pr.data.title)}</a>` : '';
  };
  const related = d => {
    const links = (d.relatedProjects || []).map(projLink).filter(Boolean);
    return links.length ? `<p class="small">관련 프로젝트: ${links.join(', ')}</p>` : '';
  };

  // ----- 프로필 영역 -----
  const contacts = p.contacts || {};
  const roleTags = (p.primaryRoles || []).map(r => ROLES.find(x => x.id === r)?.name).filter(Boolean);
  const profileHTML = `
    <div class="cover" ${p.cover ? `style="background-image:url('${esc(p.cover)}')"` : ''} role="presentation"></div>
    <div class="page">
      <div class="avatar">${p.photo ? `<img src="${esc(p.photo)}" alt="${esc(p.name)} 프로필 사진">` : initials(p.name)}</div>
      <h1 class="name">${esc(p.name || '이름을 입력하세요')}${sample(prof)}</h1>
      <p class="tagline">${esc(p.tagline || '')}</p>
      ${p.headline ? `<div class="callout"><span class="icon" aria-hidden="true">💡</span><div>${esc(p.headline)}</div></div>` : ''}
      <div class="cols profile-block">
        <div>
          <h2>연락처</h2>
          <ul class="kv">
            ${contacts.email ? `<li><span class="k">이메일</span> <a href="mailto:${esc(contacts.email)}">${esc(contacts.email)}</a></li>` : ''}
            ${(contacts.links || []).map(l => `<li><span class="k">${esc(l.label)}</span> <a href="${esc(l.url)}" rel="noopener" target="_blank">${esc(l.url.replace(/^https?:\/\//, ''))}</a></li>`).join('')}
          </ul>
        </div>
        <div>
          ${roleTags.length ? `<h2>희망 직무</h2><div class="tags" style="margin-bottom:14px">${roleTags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
          ${(p.interests || []).length ? `<h2>관심 분야</h2><ul class="interests">${p.interests.map(i => `<li><span aria-hidden="true">${esc(i.icon)}</span>${esc(i.label)}</li>`).join('')}</ul>` : ''}
          ${p.resumeFile ? `<a class="btn" href="${esc(p.resumeFile)}" target="_blank" rel="noopener" data-resume>이력서 PDF 받기</a>` : ''}
        </div>
      </div>
      <section id="sec-about" aria-labelledby="h-about">
        <h2 class="sec-title" id="h-about"><span class="ico" aria-hidden="true">👋</span>소개</h2>
        ${(p.bio || '').split(/\n+/).filter(Boolean).map(t => `<p>${esc(t)}</p>`).join('') || '<p class="muted">자기소개를 입력하세요.</p>'}
      </section>
      <section id="sec-summary" aria-labelledby="h-summary"></section>
      <section id="sec-resume" aria-labelledby="h-resume"></section>
      <section id="sec-featured" aria-labelledby="h-featured"></section>
      <section id="projects" aria-labelledby="h-projects"></section>
      <footer class="foot">
        <span>익명 방문 통계를 수집합니다(쿠키·IP 미수집).</span>
        <span>${opts.footerNote ? esc(opts.footerNote) + ' · ' : ''}${opts.adminHref ? `<a href="${esc(opts.adminHref)}">관리</a>` : ''}</span>
      </footer>
    </div>`;

  // ----- 왼쪽 사이드바 (접으면 아이콘만, 현재 섹션 강조) -----
  const sbKey = opts.sidebarKey || 'lis-sb-public';
  const collapsed = sidebarState.get(sbKey);
  const sidebarHTML = `<aside class="sb" id="sb" aria-label="사이드바">
      <div class="sb-head">
        <span class="sb-avatar">${p.photo ? `<img src="${esc(p.photo)}" alt="">` : initials(p.name)}</span>
        <span class="sb-name">${esc(p.name || '')}</span>
        <button type="button" class="sb-toggle desk" data-sb-toggle aria-controls="sb" aria-expanded="${!collapsed}" aria-label="${collapsed ? '메뉴 펼치기' : '메뉴 접기'}" title="${collapsed ? '메뉴 펼치기' : '메뉴 접기'}">${icon(collapsed ? 'expand' : 'collapse')}</button>
        <button type="button" class="sb-toggle sb-close" data-drawer-close aria-label="메뉴 닫기">${icon('close')}</button>
      </div>
      <nav class="sb-nav" aria-label="목차">
        ${SEC.map(([id, l, ic]) => `<a class="sb-link" href="#${id}" data-scroll="${id}" data-nav="${id}" data-label="${esc(l)}" aria-label="${esc(l)}">${icon(ic)}<span class="sb-label">${esc(l)}</span></a>`).join('')}
      </nav>
      ${opts.adminHref ? `<div class="sb-foot"><a class="sb-link" href="${esc(opts.adminHref)}" data-label="관리" aria-label="관리">${icon('settings')}<span class="sb-label">관리</span></a></div>` : ''}
    </aside>`;
  // ----- 상단 고정 헤더 (스크롤하면 아래 그림자) -----
  const headerHTML = `<header class="topbar no-print" id="topbar">
      <button type="button" class="sb-toggle mob-only" data-drawer-open aria-controls="sb" aria-expanded="false" aria-label="메뉴 열기">${icon('menu')}</button>
      <div class="crumb"><span class="tb-name">${esc(p.name || '')}</span><span class="tb-sep" aria-hidden="true">/</span><span class="tb-cur" id="mcur" aria-live="polite"></span></div>
      <div class="tb-acts">
        ${contacts.email ? `<a class="btn small" href="mailto:${esc(contacts.email)}" title="${esc(contacts.email)}">연락하기</a>` : ''}
        ${p.resumeFile ? `<a class="btn small primary" href="${esc(p.resumeFile)}" target="_blank" rel="noopener" data-resume>이력서</a>` : ''}
      </div>
    </header>`;

  root.innerHTML = `<div class="shell${collapsed ? ' collapsed' : ''}" id="shell">${sidebarHTML}<div class="sb-backdrop" data-drawer-close></div>
    <div class="main">${headerHTML}${profileHTML}</div></div>
    <div class="detail" id="detail" hidden role="dialog" aria-modal="true" aria-labelledby="d-title"></div>`;
  const $ = s => root.querySelector(s);

  // ----- 요약 카드 (F-2) -----
  const cards = summaryCards(items);
  const hasSampleResume = items.some(i => i.isSample && ['education', 'experience', 'activity', 'award', 'certificate', 'language', 'tool'].includes(i.kind));
  $('#sec-summary').innerHTML = `<h2 class="sec-title" id="h-summary"><span class="ico" aria-hidden="true">📌</span>한눈에 보기</h2>
    ${cards.length ? `<div class="cards">${cards.map(c => `<a class="card" href="#${c.target}" data-scroll="${c.target}"><div class="label">${esc(c.label)}</div><div class="value">${esc(c.value)}</div><div class="sub">${esc(c.sub)}</div></a>`).join('')}</div>`
      : `<p class="empty">${hasSampleResume ? '지금은 예시 데이터만 있어 요약을 계산하지 않습니다. 실제 이력을 등록하면 계산됩니다.' : '이력을 등록하면 요약 카드가 자동으로 계산됩니다.'}</p>`}`;

  // ----- 이력 (F-8) -----
  const tl = (kind, row) => {
    const list = byKindRecent(items, kind);
    if (!list.length) return '';
    return `<h3 class="sub" id="${'sec-' + KINDS[kind].section}">${row.icon} ${KINDS[kind].label}</h3><ol class="timeline">${list.map(it => `
      <li class="tl"><div class="when">${row.when(it.data)}</div><div class="rail" aria-hidden="true"></div>
      <div class="what">${row.what(it.data, sample(it))}${related(it.data)}</div></li>`).join('')}</ol>`;
  };
  const eduHTML = tl('education', {
    icon: '🎓', when: d => period(d.startDate, d.endDate),
    what: (d, s) => `${d.gpa ? `<span class="right">${esc(d.gpa)}/${esc(d.gpaMax || 4.5)}</span>` : ''}<b>${esc(d.school)} ${esc(d.major)}</b>${s}
      <p>${[d.minor && `복수·부전공 ${d.minor}`, d.status].filter(Boolean).map(esc).join(' · ')}</p>${d.note ? `<p>${esc(d.note)}</p>` : ''}`,
  });
  const expHTML = tl('experience', {
    icon: '💼', when: d => period(d.startDate, d.endDate),
    what: (d, s) => `<b>${esc(d.organization)}</b>${s}<p>${[d.position, d.employmentType !== d.position && d.employmentType].filter(Boolean).map(esc).join(' · ')}</p>${d.description ? `<p>${esc(d.description)}</p>` : ''}`,
  });
  const actHTML = tl('activity', {
    icon: '🤝', when: d => period(d.startDate, d.endDate),
    what: (d, s) => `<b>${esc(d.title)}</b>${s}<p>${[d.organization, d.type, d.role, d.hours && `${d.hours}시간`].filter(Boolean).map(esc).join(' · ')}</p>`,
  });
  const awHTML = tl('award', {
    icon: '🏆', when: d => fmtMonth(d.date),
    what: (d, s) => `<b>${esc(d.title)}${d.rank ? ' ' + esc(d.rank) : ''}</b>${s}<p>${esc(d.issuer || '')}</p>`,
  });
  const usage = toolUsage(items, true);
  const tools = byKind(items, 'tool').sort((a, b) => (usage.get(b.data.name) || 0) - (usage.get(a.data.name) || 0));
  const maxUse = Math.max(1, ...tools.map(t => usage.get(t.data.name) || 0));
  const certs = byKindRecent(items, 'certificate');
  const langs = byKindRecent(items, 'language');
  const skillsHTML = (tools.length || certs.length || langs.length) ? `<div class="cols">
      <div>${tools.length ? `<h3 class="sub" id="sec-tools">🛠️ 스킬</h3><ul class="bars">${tools.map(t => {
        const n = usage.get(t.data.name) || 0;
        return `<li><span>${esc(t.data.name)}${sample(t)}</span><span class="n">${n ? `프로젝트 ${n}건` : '연결 전'}</span><span class="bar" aria-hidden="true"><span style="width:${(n / maxUse) * 100}%"></span></span></li>`;
      }).join('')}</ul><p class="small muted">막대 길이 = 그 스킬을 쓴 공개 프로젝트 수</p>` : ''}</div>
      <div>${certs.length || langs.length ? `<h3 class="sub" id="sec-certificates">📜 자격·어학</h3>
        <ul class="list-plain">${certs.map(c => `<li><span class="d">${esc(fmtMonth(c.data.date))}</span><span><b>${esc(c.data.name)}</b>${c.data.status === '예정' ? ' <span class="tag">취득 예정</span>' : ''}${sample(c)}<br><span class="small muted">${esc(c.data.issuer || '')}</span></span></li>`).join('')}
        ${langs.map(l => `<li><span class="d">${esc(fmtMonth(l.data.date))}</span><span><b>${esc(l.data.test)}</b>${l.data.score ? ' ' + esc(l.data.score) : ''}${sample(l)}</span></li>`).join('')}</ul>` : ''}</div>
    </div>` : '';
  const resumeBody = eduHTML + skillsHTML + expHTML + actHTML + awHTML;
  $('#sec-resume').innerHTML = resumeBody ? `<h2 class="sec-title" id="h-resume"><span class="ico" aria-hidden="true">🗂️</span>이력</h2>${resumeBody}` : '';
  if (!resumeBody) $('#sec-resume').hidden = true;

  // ----- 프로젝트 카드 -----
  const cover = (pr, cls = 'pcover') => `<div class="${cls}" ${pr.data.coverImage ? `style="background-image:url('${esc(pr.data.coverImage)}')"` : ''}>${pr.data.coverImage ? '' : esc(compName(pr.data.primarySkill))}</div>`;
  const tagList = pr => {
    const ids = [pr.data.primarySkill, ...(pr.data.skills || []).filter(s => s !== pr.data.primarySkill)].filter(Boolean);
    return `<div class="tags">${ids.map((s, i) => `<span class="tag${i === 0 ? ' main' : ''}">${esc(compName(s))}</span>`).join('')}</div>`;
  };
  const metricLine = m => `${m.label} ${Number(m.value).toLocaleString('ko-KR')}${m.unit || ''}`;
  const card = (pr, featured) => `<button type="button" class="pcard" data-open="${esc(pr.data.slug)}" aria-label="${esc(pr.data.title)} 자세히 보기">
      ${cover(pr)}<div class="pbody">
        <span class="ptitle">${esc(pr.data.title)}${sample(pr)}</span>
        ${featured && pr.data.metrics?.[0] ? `<span class="pkey">${esc(metricLine(pr.data.metrics[0]))}</span>` : ''}
        <p class="psum">${esc(pr.data.summary)}</p>
        ${featured && pr.data.role?.[0] ? `<span class="pmeta">맡은 일: ${esc(pr.data.role[0])}</span>` : ''}
        ${tagList(pr)}
        <span class="pmeta">${esc([period(pr.data.startDate, pr.data.endDate), pr.data.type].filter(Boolean).join(' · '))}</span>
      </div></button>`;

  const featured = projects.filter(x => x.data.featured).sort((a, b) => (a.data.featuredOrder || 9) - (b.data.featuredOrder || 9)).slice(0, 3);
  $('#sec-featured').innerHTML = featured.length ? `<h2 class="sec-title" id="h-featured"><span class="ico" aria-hidden="true">⭐</span>대표 프로젝트</h2>
    <div class="gallery featured">${featured.map(x => card(x, true)).join('')}</div>` : '';
  if (!featured.length) $('#sec-featured').hidden = true;

  // ----- 전체 프로젝트 (F-4) -----
  let viewPref = 'gallery';
  try { viewPref = localStorage.getItem('lis-view') || 'gallery'; } catch { /* 없음 */ }
  const st = { tab: 'all', view: viewPref, type: '', year: '', sort: 'recent', q: '' };
  const inComp = (pr, cid) => pr.data.primarySkill === cid || (pr.data.skills || []).includes(cid);
  const years = [...new Set(projects.map(x => (x.data.startDate || '').slice(0, 4)).filter(Boolean))].sort().reverse();
  // 기본 유형 순서를 앞에, 직접 입력한 유형(예: 교내 활동)은 뒤에
  const used = new Set(projects.map(x => x.data.type).filter(Boolean));
  const types = [...PROJECT_TYPES.filter(t => used.has(t)), ...[...used].filter(t => !PROJECT_TYPES.includes(t)).sort((a, b) => a.localeCompare(b, 'ko'))];

  function filtered() {
    const q = st.q.trim().toLowerCase();
    let list = projects.filter(pr => (st.tab === 'all' || inComp(pr, st.tab))
      && (!st.type || pr.data.type === st.type)
      && (!st.year || (pr.data.startDate || '').startsWith(st.year))
      && (!q || [pr.data.title, pr.data.summary, ...(pr.data.tools || []), ...(pr.data.skills || []).map(compName)].join(' ').toLowerCase().includes(q)));
    list.sort(st.sort === 'name' ? (a, b) => a.data.title.localeCompare(b.data.title, 'ko') : (a, b) => (b.data.startDate || '').localeCompare(a.data.startDate || ''));
    return list;
  }

  function drawList() {
    const list = filtered();
    $('#plist').innerHTML = !list.length ? '<p class="empty">조건에 맞는 프로젝트가 없습니다.</p>'
      : st.view === 'gallery' ? `<div class="gallery">${list.map(x => card(x)).join('')}</div>`
        : `<table class="db"><thead><tr><th scope="col">제목</th><th scope="col">기간</th><th scope="col">유형</th><th scope="col">역량</th><th scope="col">역할</th></tr></thead><tbody>
          ${list.map(pr => `<tr class="row" data-open="${esc(pr.data.slug)}"><td><a href="#p-${esc(pr.data.slug)}" data-open="${esc(pr.data.slug)}"><b>${esc(pr.data.title)}</b></a>${sample(pr)}</td><td>${esc(period(pr.data.startDate, pr.data.endDate))}</td><td>${esc(pr.data.type || '')}</td><td>${tagList(pr)}</td><td>${esc((pr.data.role || [])[0] || '')}</td></tr>`).join('')}
          </tbody></table><div class="db-cards">${list.map(x => card(x)).join('')}</div>`;
    root.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tab === st.tab)));
    root.querySelectorAll('.seg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === st.view)));
    $('#pcount').textContent = `${list.length}건`;
  }

  $('#projects').innerHTML = `<h2 class="sec-title" id="h-projects"><span class="ico" aria-hidden="true">📁</span>전체 프로젝트 <span class="muted small" id="pcount"></span></h2>
    <div class="tabs" role="group" aria-label="역량별 보기">
      <button type="button" data-tab="all">전체 ${projects.length}</button>
      ${comps.map(c => `<button type="button" data-tab="${esc(c.data.cid)}">${esc(c.data.name)} ${projects.filter(pr => inComp(pr, c.data.cid)).length}</button>`).join('')}
    </div>
    <div class="toolbar">
      <div class="seg" role="group" aria-label="보기 방식"><button type="button" data-view="gallery">갤러리</button><button type="button" data-view="table">표</button></div>
      <label class="sr-only" for="f-type">유형</label><select id="f-type"><option value="">모든 유형</option>${types.map(t => `<option>${esc(t)}</option>`).join('')}</select>
      <label class="sr-only" for="f-year">연도</label><select id="f-year"><option value="">모든 연도</option>${years.map(y => `<option>${y}</option>`).join('')}</select>
      <label class="sr-only" for="f-sort">정렬</label><select id="f-sort"><option value="recent">최신순</option><option value="name">이름순</option></select>
      <label class="sr-only" for="f-q">검색</label><input id="f-q" type="search" placeholder="제목·도구·역량 검색">
    </div>
    <div id="plist"></div>`;
  drawList();

  root.querySelector('.tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { st.tab = b.dataset.tab; drawList(); } });
  root.querySelector('.seg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    st.view = b.dataset.view; try { localStorage.setItem('lis-view', st.view); } catch { /* 없음 */ }
    drawList();
  });
  $('#f-type').onchange = e => { st.type = e.target.value; drawList(); };
  $('#f-year').onchange = e => { st.year = e.target.value; drawList(); };
  $('#f-sort').onchange = e => { st.sort = e.target.value; drawList(); };
  $('#f-q').oninput = e => { st.q = e.target.value; drawList(); };

  // ----- 상세 (F-5) -----
  const detail = $('#detail');
  let lastFocus = null;

  function evidenceHTML(ev, slug) {
    const meta = [ev.description, ev.size && kb(ev.size), ev.type === 'link' && host(ev.url)].filter(Boolean).map(esc).join(' · ');
    const inner = `<span class="i" aria-hidden="true">${icons[ev.type] || '📎'}</span><span><span class="t">${esc(ev.title)}</span><br><span class="m">${meta}</span>
      ${ev.type === 'image' && ev.url && !ev.url.startsWith('private:') ? `<br><img src="${esc(ev.url)}" alt="${esc(ev.title)}" loading="lazy">` : ''}
      ${!ev.url ? '<br><span class="m">파일이 아직 연결되지 않았습니다.</span>' : ''}</span>`;
    return ev.url && !ev.url.startsWith('private:')
      ? `<a class="ev" href="${esc(ev.url)}" target="_blank" rel="noopener" data-evidence="${esc(slug)}">${inner}</a>`
      : `<div class="ev">${inner}</div>`;
  }

  function openProject(slug, { fromHash = false } = {}) {
    const pr = bySlug(slug);
    if (!pr) return false;
    const d = pr.data;
    const idx = projects.indexOf(pr);
    const prev = projects[idx - 1], next = projects[idx + 1];
    const proc = d.process || {};
    lastFocus = document.activeElement;
    detail.innerHTML = `<article class="sheet">
      <div class="sheet-bar"><span class="small muted">프로젝트</span><span>
        <button type="button" class="btn small" data-expand>모두 펼치기</button>
        <button type="button" class="btn small" data-close aria-label="닫기">닫기 ✕</button></span></div>
      ${cover(pr)}
      <div class="sheet-in">
        <h1 id="d-title" tabindex="-1">${esc(d.title)}${sample(pr)}</h1>
        <p class="muted">${esc(d.summary || '')}</p>
        <dl class="props">
          <dt>기간</dt><dd>${esc(period(d.startDate, d.endDate))}${d.hours ? ` · ${esc(d.hours)}시간` : ''}</dd>
          <dt>유형</dt><dd>${esc(d.type || '')}${d.organization ? ` · ${esc(d.organization)}` : ''}</dd>
          <dt>역량</dt><dd>${tagList(pr)}</dd>
          ${(d.tools || []).length ? `<dt>도구·기준</dt><dd><div class="tags">${d.tools.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div></dd>` : ''}
          ${d.teamSize ? `<dt>팀·기여도</dt><dd>${d.teamSize > 1 ? `${esc(d.teamSize)}명 팀${d.contribution ? ` · 본인 기여도 ${esc(d.contribution)}%` : ''}` : '개인 작업'}</dd>` : ''}
        </dl>
        <h2><span aria-hidden="true">🙋</span>역할</h2>
        <ul>${(d.role || []).map(r => `<li>${esc(r)}</li>`).join('')}</ul>
        <h2><span aria-hidden="true">🔧</span>과정</h2>
        ${proc.problem ? `<p><b>문제 상황</b><br>${esc(proc.problem)}</p>` : ''}
        ${(proc.steps || []).length ? `<p><b>진행 단계</b></p>${proc.steps.map((s, i) => `<details class="step"${i === 0 ? ' open' : ''}><summary>${i + 1}. ${esc(s)}</summary></details>`).join('')}` : ''}
        ${proc.challenge ? `<p style="margin-top:16px"><b>어려웠던 점과 해결</b><br>${esc(proc.challenge)}</p>` : ''}
        <h2><span aria-hidden="true">📈</span>결과</h2>
        ${(d.metrics || []).length ? `<div class="metrics">${d.metrics.map(m => `<div class="metric"><div class="v">${esc(Number(m.value).toLocaleString('ko-KR'))}<span class="small"> ${esc(m.unit || '')}</span></div><div class="l">${esc(m.label)}</div></div>`).join('')}</div>` : ''}
        ${d.outcome ? `<p>${esc(d.outcome)}</p>` : ''}
        ${d.learned ? `<p><b>배운 점</b><br>${esc(d.learned)}</p>` : ''}
        <h2><span aria-hidden="true">📎</span>증빙</h2>
        ${(d.evidence || []).length ? `<div class="evid">${d.evidence.map(ev => evidenceHTML(ev, d.slug)).join('')}</div>` : '<p class="muted">공개된 증빙이 없습니다. 요청하시면 제공해 드립니다.</p>'}
        <div class="pager">
          ${prev ? `<button type="button" class="btn" data-open="${esc(prev.data.slug)}">← ${esc(prev.data.title)}</button>` : '<span></span>'}
          ${next ? `<button type="button" class="btn" data-open="${esc(next.data.slug)}">${esc(next.data.title)} →</button>` : ''}
        </div>
      </div></article>`;
    detail.hidden = false;
    document.body.style.overflow = 'hidden';
    detail.scrollTop = 0;
    detail.querySelector('#d-title').focus();
    track('project', slug);
    if (opts.useHash && !fromHash && location.hash !== '#p-' + slug) history.pushState(null, '', '#p-' + slug);
    return true;
  }

  function closeDetail({ fromHash = false } = {}) {
    if (detail.hidden) return;
    detail.hidden = true;
    detail.innerHTML = '';
    document.body.style.overflow = '';
    if (opts.useHash && !fromHash && location.hash.startsWith('#p-')) history.pushState(null, '', location.pathname + location.search);
    lastFocus?.focus?.();
  }

  // ----- 이벤트 연결 -----
  root.addEventListener('click', e => {
    const open = e.target.closest('[data-open]');
    if (open) { e.preventDefault(); openProject(open.dataset.open); return; }
    const sc = e.target.closest('[data-scroll]');
    if (sc) {
      e.preventDefault();
      root.querySelector('#' + CSS.escape(sc.dataset.scroll))?.scrollIntoView({ behavior: 'smooth' });
      if (sc.dataset.nav) setActive(sc.dataset.nav);
      setDrawer(false);
      return;
    }
    if (e.target.closest('[data-close]') || e.target === detail) { closeDetail(); return; }
    if (e.target.closest('[data-expand]')) { detail.querySelectorAll('details').forEach(x => { x.open = true; }); return; }
    if (e.target.closest('[data-evidence]')) track('evidence', e.target.closest('[data-evidence]').dataset.evidence);
    if (e.target.closest('[data-resume]')) track('resume', 'resume');
    if (e.target.closest('[data-sb-toggle]')) toggleSidebar();
    if (e.target.closest('[data-drawer-open]')) setDrawer(true);
    if (e.target.closest('[data-drawer-close]')) setDrawer(false);
  });

  // ----- 사이드바 동작 -----
  const shell = $('#shell');
  function toggleSidebar() {
    const now = !shell.classList.contains('collapsed');
    shell.classList.toggle('collapsed', now);
    sidebarState.set(sbKey, now);
    const b = $('[data-sb-toggle]');
    const label = now ? '메뉴 펼치기' : '메뉴 접기';
    b.setAttribute('aria-expanded', String(!now)); b.setAttribute('aria-label', label); b.title = label;
    b.innerHTML = icon(now ? 'expand' : 'collapse');
  }
  function setDrawer(open) {
    if (shell.classList.contains('drawer-open') === open) return;
    shell.classList.toggle('drawer-open', open);
    $('[data-drawer-open]').setAttribute('aria-expanded', String(open));
    if (open) $('.sb-nav .sb-link')?.focus();
    else if (matchMedia('(max-width: 767px)').matches) $('[data-drawer-open]').focus();
  }
  function setActive(id) {
    root.querySelectorAll('.sb-nav [data-nav]').forEach(a => a.setAttribute('aria-current', String(a.dataset.nav === id)));
    const label = SEC.find(x => x[0] === id)?.[1] || '';
    const cur = $('#mcur'); if (cur) cur.textContent = label;
  }
  // 내용이 없는 섹션은 메뉴에서도 뺀다
  SEC.forEach(([id]) => { const sec = root.querySelector('#' + id); const link = root.querySelector(`[data-nav="${id}"]`); if (link) link.hidden = !sec || sec.hidden; });
  // 스크롤 위치에 맞춰 메뉴 강조
  const secEls = SEC.map(([id]) => root.querySelector('#' + id)).filter(el => el && !el.hidden);
  const seen = new Map();
  let io = null;
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(entries => {
      entries.forEach(en => seen.set(en.target.id, en.isIntersecting));
      const cur = secEls.find(el => seen.get(el.id));
      if (cur) setActive(cur.id);
    }, { rootMargin: '-15% 0px -70% 0px' });
    secEls.forEach(el => io.observe(el));
  }
  if (secEls[0]) setActive(secEls[0].id);

  const topbar = $('#topbar');
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { topbar.classList.toggle('scrolled', window.scrollY > 4); ticking = false; });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const onKey = e => {
    if (e.key !== 'Escape') return;
    if (!detail.hidden) closeDetail();
    else if (shell.classList.contains('drawer-open')) setDrawer(false);
  };
  document.addEventListener('keydown', onKey);
  const beforePrint = () => root.querySelectorAll('details').forEach(x => { x.open = true; });
  window.addEventListener('beforeprint', beforePrint);

  return {
    openProject, closeDetail,
    destroy() { io?.disconnect(); window.removeEventListener('scroll', onScroll); document.removeEventListener('keydown', onKey); window.removeEventListener('beforeprint', beforePrint); document.body.style.overflow = ''; },
  };
}

export const metricKeyLabel = k => METRIC_KEYS.find(m => m.key === k)?.label || k;

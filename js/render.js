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
  ['sec-about', '소개', 'user'], ['sec-skills', '할 수 있는 일', 'target'], ['sec-summary', '핵심 요약', 'grid'], ['sec-resume', '이력', 'timeline'],
  ['sec-featured', '대표 프로젝트', 'star'], ['projects', '전체 프로젝트', 'folder'], ['sec-books', '추천 도서', 'book'],
];

// Split Text: 이름을 글자 단위로 나눠 차례로 떠오르게
const splitChars = (text, start = 0, step = 0.06) =>
  [...text].map((c, i) => `<span class="ch" aria-hidden="true" style="--d:${(start + i * step).toFixed(2)}s">${c === ' ' ? ' ' : esc(c)}</span>`).join('');
// Count-up: 숫자 부분을 감싸 두었다가 화면에 들어오면 0부터 올라가게
const wrapNums = html => html.replace(/\d[\d,]*(?:\.\d+)?/g, m => { const v = m.replace(/,/g, ''); return `<span class="count" data-to="${v}">${Number(v).toLocaleString('ko-KR', { maximumFractionDigits: 6 })}</span>`; });
const motionOn = () => document.documentElement.classList.contains('motion');
function countUp(el) {
  const to = Number(el.dataset.to);
  if (!motionOn() || !isFinite(to) || to === 0 || el.dataset.done) return;
  el.dataset.done = '1';
  const dec = (el.dataset.to.split('.')[1] || '').length;
  // 천 단위 쉼표(1,234). 소수 자릿수는 목표 값에 맞춘다
  const fmt = n => n.toLocaleString('ko-KR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const t0 = performance.now(), dur = 2000;   // 0 → 목표 값까지 2초
  const step = now => {
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);   // ease-out
    el.textContent = fmt(to * e);
    if (k < 1) requestAnimationFrame(step); else el.textContent = fmt(to);
  };
  el.textContent = fmt(0);
  requestAnimationFrame(step);
}
// Shared Element Transition: 목록의 표지(from)가 상세 화면의 큰 표지(to) 자리로 날아간다(뒤로 가면 반대로)
// 두 요소를 숨긴 채, to의 복제본을 화면에 띄워 위치·크기·모서리를 이어서 바꾼다
function flyBetween(from, to, { duration = 480, hideTo = true } = {}) {
  if (!motionOn() || !from || !to || !from.isConnected || !to.isConnected) return Promise.resolve();
  const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
  const onScreen = r => r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  if (!onScreen(a) || !b.width) return Promise.resolve();
  const ra = getComputedStyle(from).borderRadius, rb = getComputedStyle(to).borderRadius;
  const ghost = to.cloneNode(true);
  ghost.removeAttribute('id'); ghost.setAttribute('aria-hidden', 'true');
  ghost.classList.add('se-ghost');
  Object.assign(ghost.style, { position: 'fixed', left: 0, top: 0, margin: 0, zIndex: 200, pointerEvents: 'none', boxSizing: 'border-box' });
  document.body.appendChild(ghost);
  from.style.visibility = 'hidden'; if (hideTo) to.style.visibility = 'hidden';
  const box = r => ({ transform: `translate(${r.left}px, ${r.top}px)`, width: r.width + 'px', height: r.height + 'px' });
  const anim = ghost.animate([{ ...box(a), borderRadius: ra }, { ...box(b), borderRadius: rb }], { duration, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
  return anim.finished.catch(() => {}).then(() => { ghost.remove(); from.style.visibility = ''; to.style.visibility = ''; });
}

// Toast: 잠깐 떴다 사라지는 알림
let toastTimer;
export function showToast(msg) {
  document.querySelector('.ptoast')?.remove();
  clearTimeout(toastTimer);
  const t = document.createElement('div');
  t.className = 'ptoast'; t.setAttribute('role', 'status');
  t.innerHTML = `${icon('mail', 18)}<span>${esc(msg)}</span>`;
  document.body.appendChild(t);
  toastTimer = setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 220); }, 2500);
}
const COMP_ICON = { organization: 'timeline', reference: 'search', instruction: 'users', program: 'star', collection: 'book', archives: 'database', digital: 'chart' };
const CARD_ICON = { education: 'graduation', experience: 'briefcase', activity: 'users', award: 'award', certificate: 'certificate', tool: 'wrench' };

// Hero 이미지가 없을 때 쓰는 그림: 서가와 펼친 책(선이 그려지는 Line Drawing)
// 첫 화면 배경(Parallax 뒤층): 점 격자 + 옅은 서가 선. 장식이므로 스크린리더에서 숨긴다
function heroBackdrop() {
  const spines = [[40, 70, 18], [62, 50, 14], [80, 86, 22], [106, 60, 12], [700, 40, 20], [724, 76, 16], [744, 56, 24], [772, 90, 14]];
  return `<svg class="hero-bd" viewBox="0 0 820 520" preserveAspectRatio="xMidYMid slice" fill="none" stroke="currentColor" stroke-width="1.5">
    <circle cx="640" cy="120" r="150"/><circle cx="140" cy="430" r="110"/>
    ${spines.map(([x, h, w]) => `<rect x="${x}" y="${300 - h}" width="${w}" height="${h + 160}" rx="3"/>`).join('')}
    <path d="M20 460h200M680 460h130"/>
  </svg>`;
}
// 소개 옆 캐릭터: three.js로 실제 3D 렌더링한 토이 피규어 스타일 초상(만든 장면: tools/character-3d.html)
function aboutCharacter() {
  return `<img class="me-char" src="assets/me-3d.webp?v=3e7628ff" width="975" height="1219" alt="눈썹 위로 일자 앞머리를 내린 긴 갈색 생머리, 맑은 갈색 눈과 통통한 볼, 물결 깃의 흰 레이스 블라우스를 입은 3D 아트 토이 캐릭터" loading="lazy" decoding="async">`;
}
function heroIllustration() {
  const books = [[40, 70, 24], [68, 52, 18], [90, 82, 26], [120, 60, 20], [144, 74, 16], [164, 48, 22], [190, 66, 18], [212, 88, 24], [240, 58, 20]];
  const d = i => `style="--d:${(0.6 + i * 0.07).toFixed(2)}s"`;
  return `<svg class="hero-ill" viewBox="0 0 300 300" role="img" aria-label="서가와 펼친 책 그림" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="22" y="40" width="256" height="220" rx="14" class="frame" />
    ${books.map(([x, h, w], i) => `<rect class="draw" pathLength="1" ${d(i)} x="${x}" y="${150 - h}" width="${w}" height="${h}" rx="3"/>`).join('')}
    <path class="draw" pathLength="1" ${d(9)} d="M34 150h232"/>
    <path class="draw" pathLength="1" ${d(10)} d="M150 236c-22-14-50-16-78-12v-48c28-4 56-2 78 12 22-14 50-16 78-12v48c-28-4-56-2-78 12z"/>
    <path class="draw" pathLength="1" ${d(11)} d="M150 188v48"/>
    <path class="draw" pathLength="1" ${d(12)} d="M86 192c16-2 32 0 46 6M86 206c16-2 32 0 46 6M168 198c14-6 30-8 46-6M168 212c14-6 30-8 46-6"/>
  </svg>`;
}

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
  // 주소용 이름(slug)이 없는 프로젝트는 id로 대신한다
  const projects = byKind(items, 'project').map(pr => (pr.data.slug ? pr : { ...pr, data: { ...pr.data, slug: String(pr.id) } }));
  const bySlug = s => projects.find(x => x.data.slug === s);
  const projLink = id => {
    const pr = projects.find(x => x.id === id);
    return pr ? `<a href="#p-${esc(pr.data.slug)}" data-open="${esc(pr.data.slug)}">${esc(pr.data.title || '제목 없음')}</a>` : '';
  };
  const related = d => {
    const links = (d.relatedProjects || []).map(projLink).filter(Boolean);
    return links.length ? `<p class="small">관련 프로젝트: ${links.join(', ')}</p>` : '';
  };

  // ----- 프로필 영역 -----
  const contacts = p.contacts || {};
  const roleTags = (p.primaryRoles || []).map(r => ROLES.find(x => x.id === r)?.name).filter(Boolean);
  const nameEnd = +(0.12 + [...(p.name || '이름을 입력하세요')].length * 0.06 + 0.12).toFixed(2);
  const heroImg = p.cover || p.photo || '';
  const featuredTarget = items.some(i => i.kind === 'project' && i.data.featured) ? 'sec-featured' : 'projects';
  const profileHTML = `
    <div class="page">
      <div data-view="landing">
      <section class="hero" aria-labelledby="h-name">
        <div class="hero-bg" aria-hidden="true"><div class="hero-bg-layer" data-px="bg">${heroBackdrop()}</div></div>
        <div class="hero-text">
          ${roleTags.length ? `<p class="eyebrow" data-rise style="--d:0s"><span class="dot" aria-hidden="true"></span>${esc(roleTags.join(' · '))}</p>` : ''}
          <h1 class="name" id="h-name" aria-label="${esc(p.name || '이름을 입력하세요')}">${splitChars(p.name || '이름을 입력하세요', 0.12)}${sample(prof)}</h1>
          <p class="tagline" data-rise style="--d:${nameEnd}s">${esc(p.tagline || '')}</p>
          ${p.headline ? `<p class="lead" data-rise style="--d:${(nameEnd + 0.1).toFixed(2)}s">${esc(p.headline)}</p>` : ''}
          <div class="cta" data-rise style="--d:${(nameEnd + 0.2).toFixed(2)}s">
            <a class="btn primary" href="#portfolio" data-enter>포트폴리오 살펴보기 ${icon('arrow', 18)}</a>
            <button type="button" class="btn" data-contact-toggle aria-expanded="false" aria-controls="landing-contact">${icon('mail', 18)} 연락하기</button>
            ${p.resumeFile ? `<a class="btn" href="${esc(p.resumeFile)}" target="_blank" rel="noopener" data-resume>${icon('download', 18)} 이력서 PDF</a>` : ''}
          </div>
        </div>
        <figure class="hero-media" style="--d:${(nameEnd + 0.3).toFixed(2)}s">
          <div class="px-fg" data-px="fg">${heroImg ? `<img src="${esc(heroImg)}" alt="${esc(p.cover ? (p.name || '') + ' 포트폴리오 대표 이미지' : (p.name || '') + ' 프로필 사진')}">` : heroIllustration()}</div>
        </figure>
      </section>
      <section class="landing-contact" id="landing-contact" aria-labelledby="h-contact" hidden>
        <div class="lc-head"><h2 id="h-contact" tabindex="-1">${icon('mail', 18)} 연락하기</h2><button type="button" class="btn small ghost" data-contact-toggle aria-label="연락처 닫기">닫기 ✕</button></div>
        <ul class="kv">
          ${contacts.email ? `<li><span class="k">이메일</span> <a href="mailto:${esc(contacts.email)}">${esc(contacts.email)}</a><button type="button" class="copy-btn" data-copy="${esc(contacts.email)}" aria-label="이메일 주소 복사">복사</button></li>` : '<li class="muted">관리 화면에서 이메일을 입력하면 여기에 보입니다.</li>'}
          ${(contacts.links || []).map(l => `<li><span class="k">${esc(l.label)}</span> <a href="${esc(l.url)}" rel="noopener" target="_blank">${esc(l.url.replace(/^https?:\/\//, ''))}</a></li>`).join('')}
        </ul>
      </section>
      </div>
      <div data-view="portfolio" class="pf-view">
      <div class="pf-switch" role="group" aria-label="보기 방식">
        <button type="button" data-mode="cards">${icon('grid', 16)} 간단히 보기</button>
        <button type="button" data-mode="all">${icon('timeline', 16)} 한 눈에 보기</button>
      </div>
      <div class="topic-bar">
        <button type="button" class="btn small" data-topics>${icon('arrow', 16)} 모든 주제</button>
        <span class="tb-pager"></span>
      </div>
      <section id="sec-about" aria-labelledby="h-about">
        <h2 class="sec-title" id="h-about" data-reveal><span class="ico" aria-hidden="true">👋</span>소개</h2>
        <div class="about-intro">
          <div data-reveal>${(p.bio || '').split(/\n+/).filter(Boolean).map(t => `<p>${esc(t)}</p>`).join('') || '<p class="muted">자기소개를 입력하세요.</p>'}</div>
          <figure class="me-wrap" data-reveal style="--d:.15s">${aboutCharacter()}</figure>
        </div>
              <div class="cols profile-block" data-reveal>
        <div class="contact-box" id="pf-contact" tabindex="-1">
          <h2>연락처</h2>
          <ul class="kv">
            ${contacts.email ? `<li><span class="k">이메일</span> <a href="mailto:${esc(contacts.email)}">${esc(contacts.email)}</a><button type="button" class="copy-btn" data-copy="${esc(contacts.email)}" aria-label="이메일 주소 복사">복사</button></li>` : ''}
            ${(contacts.links || []).map(l => `<li><span class="k">${esc(l.label)}</span> <a href="${esc(l.url)}" rel="noopener" target="_blank">${esc(l.url.replace(/^https?:\/\//, ''))}</a></li>`).join('')}
          </ul>
        </div>
        <div>
          ${roleTags.length ? `<h2>희망 직무</h2><div class="tags" style="margin-bottom:14px">${roleTags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
          ${(p.interests || []).length ? `<h2>관심 분야</h2><ul class="interests">${p.interests.map(i => `<li><span aria-hidden="true">${esc(i.icon)}</span>${esc(i.label)}</li>`).join('')}</ul>` : ''}
        </div>
      </div>
      </section>
      <h2 class="sec-title topic-head" id="h-topics"><span class="ico" aria-hidden="true">🗂️</span>주제별로 살펴보기</h2>
      <div class="topic-grid" id="topic-cards" role="list" aria-labelledby="h-topics"></div>
      <section id="sec-skills" aria-labelledby="h-skills"></section>
      <section id="sec-summary" aria-labelledby="h-summary"></section>
      <section id="sec-resume" aria-labelledby="h-resume"></section>
      <section id="sec-featured" aria-labelledby="h-featured"></section>
      <section id="projects" aria-labelledby="h-projects"></section>
      <section id="sec-books" aria-labelledby="h-books"></section>
      </div>
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
      <div class="crumb"><button type="button" class="tb-name" data-home title="첫 화면으로">${esc(p.name || '')}</button><span class="tb-sep" aria-hidden="true">/</span><span class="tb-cur" id="mcur" aria-live="polite"></span></div>
      <div class="tb-acts">
        ${opts.themeToggle ? `<button type="button" class="theme-btn" data-theme-toggle aria-pressed="${document.documentElement.dataset.theme === 'dark'}" aria-label="다크 모드" title="다크 모드 켜기/끄기"><span class="sun">${icon('moon', 18)}</span><span class="moon">${icon('sun', 18)}</span></button>` : ''}
        <button type="button" class="btn small" data-contact-glow aria-controls="pf-contact">연락하기</button>
        ${p.resumeFile ? `<a class="btn small primary" href="${esc(p.resumeFile)}" target="_blank" rel="noopener" data-resume>이력서</a>` : ''}
      </div>
    </header>`;

  root.innerHTML = `<div class="shell${collapsed ? ' collapsed' : ''}" id="shell">${sidebarHTML}<div class="sb-backdrop" data-drawer-close></div>
    <div class="main">${headerHTML}${profileHTML}</div></div>
    <div class="detail" id="detail" hidden role="dialog" aria-modal="true" aria-labelledby="d-title"></div>`;
  const $ = s => root.querySelector(s);

  // ----- Scroll Reveal: 화면에 들어오면 나타나고, 숫자는 그때 올라간다 -----
  let revealIO = null;
  function reveal(container) {
    const els = [...container.querySelectorAll('[data-reveal]:not(.in)')];
    if (container.matches?.('[data-reveal]:not(.in)')) els.push(container);
    const show = el => { el.classList.add('in'); el.querySelectorAll('.count').forEach(countUp); };
    if (!motionOn() || !('IntersectionObserver' in window)) { els.forEach(el => el.classList.add('in')); return; }
    if (!revealIO) {
      revealIO = new IntersectionObserver(entries => entries.forEach(en => {
        if (en.isIntersecting) { show(en.target); revealIO.unobserve(en.target); }
      }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    }
    els.forEach(el => revealIO.observe(el));
  }

  // ----- 섹션 Scroll Reveal: 화면에 30% 들어오면 아래에서 20px 올라오며 나타남(한 번만) -----
  let secIO = null;
  function revealSections() {
    const els = [...root.querySelectorAll('.pf-view > section, .pf-view > .topic-head, .pf-view > .topic-grid')].filter(el => !el.classList.contains('sec-in'));
    els.forEach(el => el.setAttribute('data-sec-reveal', ''));
    if (!motionOn() || !('IntersectionObserver' in window)) { els.forEach(el => el.classList.add('sec-in')); return; }
    if (!secIO) {
      secIO = new IntersectionObserver(entries => entries.forEach(en => {
        if (!en.isIntersecting) return;
        // 30% 이상 보이면 실행. 화면보다 아주 긴 섹션은 화면 높이의 30%를 채우면 실행
        const vh = en.rootBounds ? en.rootBounds.height : innerHeight;
        if (en.intersectionRatio >= 0.3 || en.intersectionRect.height >= vh * 0.3) {
          en.target.classList.add('sec-in'); secIO.unobserve(en.target);
        }
      }), { threshold: [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3] });
    }
    els.forEach(el => secIO.observe(el));
  }

  // ----- 3D Tilt: 대표 프로젝트 카드가 마우스를 따라 살짝 기운다(최대 5도) -----
  const tiltOn = () => motionOn() && matchMedia('(hover: hover) and (pointer: fine)').matches;
  root.addEventListener('pointermove', e => {
    const c = e.target.closest?.('.featured .pcard');
    if (!c || !tiltOn()) return;
    const r = c.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    c.style.transition = 'transform .08s linear, box-shadow .3s';
    c.style.transform = `perspective(900px) rotateX(${(-y * 5).toFixed(2)}deg) rotateY(${(x * 5).toFixed(2)}deg) translateY(-4px)`;
  });
  root.addEventListener('pointerout', e => {
    const c = e.target.closest?.('.featured .pcard');
    if (!c || c.contains(e.relatedTarget)) return;
    c.style.transition = 'transform .5s var(--ease-back), box-shadow .3s';   // Spring처럼 제자리로
    c.style.transform = '';
  });

  // ----- 할 수 있는 일: Bento Grid (핵심 역량은 큰 카드, 나머지는 작은 카드) -----
  {
    const projs = items.filter(i => i.kind === 'project');
    const projsOf = cid => projs.filter(pr => pr.data.primarySkill === cid || (pr.data.skills || []).includes(cid));
    const roleScore = c => Math.max(0, ...roles.map(r => ((c.data.roles || {})[r] === 'core' ? 2 : (c.data.roles || {})[r] === 'related' ? 1 : 0)));
    const shown = comps.filter(c => projsOf(c.data.cid).length > 0 || roleScore(c) === 2)
      .map((c, i) => ({ c, i, score: roleScore(c), n: projsOf(c.data.cid).length }))
      .sort((x, y) => y.score - x.score || y.n - x.n || x.i - y.i).slice(0, 6);
    // 큰 카드: 핵심 역량(직무 중요도 '핵심') 중 프로젝트가 많은 순으로 최대 2개. 카드가 4개 미만이면 큰 카드 없이 같은 크기
    const nb = shown.length < 4 ? 0 : Math.min(shown.length === 6 ? 2 : 1, shown.filter(x => x.score === 2).length || 1);
    const big = shown.slice(0, nb), small = shown.slice(nb);
    // 4열 기준 빈칸 없이 채우기: 남는 칸 수에 따라 마지막 작은 카드를 넓힌다
    const ns = small.length, r = nb ? ns % 4 : 0;
    const dSize = j => (nb === 2 ? '' : r === 1 && j === ns - 1 ? ' full' : r === 2 && j >= ns - 2 ? ' wide' : r === 3 && j === ns - 1 ? ' wide' : '');
    const tWide = j => (ns % 2 === 1 && j === ns - 1 ? ' t-wide' : '');   // 태블릿(2열)에서 홀수면 마지막 카드를 한 줄로
    const card = ({ c, n }, cls, k) => {
      const isBig = cls.includes('big');
      const list = isBig ? projsOf(c.data.cid).slice(0, 3) : [];
      return `<div class="svc-cell${cls}" data-reveal style="--d:${(k * 0.07).toFixed(2)}s">
        <button type="button" class="svc-card" data-comp="${esc(c.data.cid)}" aria-label="${esc(c.data.name)}: ${esc(c.data.description || '')}. 관련 프로젝트 ${n}건 보기">
          <span class="svc-ico">${icon(COMP_ICON[c.data.cid] || 'target', isBig ? 28 : 22)}</span>
          <span class="svc-title">${esc(c.data.name)}${isBig ? '<span class="svc-core">핵심 역량</span>' : ''}</span>
          <span class="svc-desc">${esc(c.data.description || '')}</span>
          ${list.length ? `<span class="svc-list">${list.map(pr => `<span>${esc(pr.data.title || '')}</span>`).join('')}</span>` : ''}
          <span class="svc-foot">${n ? `프로젝트 ${n}건` : '준비 중'} ${icon('arrow', 16)}</span>
        </button></div>`;
    };
    if (shown.length) {
      // 큰 카드 2개일 때(6장): 큰1 왼쪽 위, 큰2 오른쪽 아래로 엇갈리게 배치 (DOM 순서 = 큰1, 작은1·2, 큰2, 작은3·4)
      const order = nb === 2 ? [[big[0], ' big b1'], [small[0], ' s1'], [small[1], ' s2'], [big[1], ' big b2'], [small[2], ' s3'], [small[3], ' s4']]
        : [...big.map(x => [x, ' big']), ...small.map((x, j) => [x, dSize(j) + tWide(j)])];
      $('#sec-skills').innerHTML = `<h2 class="sec-title" id="h-skills" data-reveal><span class="ico" aria-hidden="true">🧭</span>할 수 있는 일</h2>
        <p class="sec-sub muted" data-reveal>희망 직무에서 핵심인 역량은 큰 카드로 보여 줍니다. 카드를 누르면 그 역량의 프로젝트로 이동합니다.</p>
        <div class="svc${nb ? ' svc-bento' : ''}${nb === 2 ? ' two-big' : ''}">${order.map(([x, cls], k) => card(x, cls, k)).join('')}</div>`;
    } else $('#sec-skills').hidden = true;
  }

  // ----- 요약 카드 (F-2): Bento Grid -----
  // 첫 카드(학력)는 큰 칸, 나머지는 작은 칸. 카드 수에 맞춰 넓은 칸을 섞어 줄이 비지 않게 한다(4열 기준)
  function bentoSize(i, n) {
    const smalls = n - 1;
    if (i === 0) return smalls === 0 ? ' full' : smalls <= 2 ? ' big flat' : ' big';
    const j = i - 1;
    if (smalls === 1) return ' wide';
    if (smalls === 3) return j === 2 ? ' wide' : '';
    if (smalls <= 4) return '';
    const r = smalls - 4, k = j - 4;            // 큰 칸 옆 4칸을 채우고 남은 카드
    if (k < 0) return '';
    if (r === 1) return ' full';
    if (r === 2) return ' wide';
    if (r === 3) return k === 0 ? ' wide' : '';
    return '';
  }
  const cards = summaryCards(items);
  const hasSampleResume = items.some(i => i.isSample && ['education', 'experience', 'activity', 'award', 'certificate', 'language', 'tool'].includes(i.kind));
  $('#sec-summary').innerHTML = `<h2 class="sec-title" id="h-summary" data-reveal><span class="ico" aria-hidden="true">📌</span>핵심 요약</h2>
    ${cards.length ? `<div class="bento">${cards.map((c, i) => {
        const size = bentoSize(i, cards.length);
        return `<a class="card${size}" href="#${c.target}" data-scroll="${c.target}" data-reveal style="--d:${(i * 0.06).toFixed(2)}s">
          <div class="label">${icon(CARD_ICON[c.id] || 'grid', 18)}${esc(c.label)}</div>
          <div><div class="value">${wrapNums(esc(c.value))}</div><div class="sub">${esc(c.sub)}</div></div></a>`;
      }).join('')}</div>`
      : `<p class="empty">${hasSampleResume ? '지금은 예시 데이터만 있어 요약을 계산하지 않습니다. 실제 이력을 등록하면 계산됩니다.' : '이력을 등록하면 요약 카드가 자동으로 계산됩니다.'}</p>`}`;

  // ----- 이력 (F-8) -----
  const tl = (kind, row) => {
    const list = byKindRecent(items, kind);
    if (!list.length) return '';
    return `<h3 class="sub" id="${'sec-' + KINDS[kind].section}" data-reveal>${row.icon} ${KINDS[kind].label}</h3><ol class="timeline">${list.map((it, n) => `
      <li class="tl" data-reveal style="--d:${Math.min(n * 0.08, 0.4).toFixed(2)}s"><div class="when">${row.when(it.data)}</div><div class="rail" aria-hidden="true"></div>
      <div class="what">${row.what(it.data, sample(it))}${kind === 'activity' ? related(it.data) : ''}</div></li>`).join('')}</ol>`;
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
    what: (d, s) => `<b>${esc(d.title || '제목 없음')}</b>${s}<p>${[d.organization, d.type, d.role, d.hours && `${d.hours}시간`].filter(Boolean).map(esc).join(' · ')}</p>`,
  });
  const awHTML = tl('award', {
    icon: '🏆', when: d => fmtMonth(d.date),
    what: (d, s) => `<b>${esc(d.title || '제목 없음')}${d.rank ? ' ' + esc(d.rank) : ''}</b>${s}<p>${esc(d.issuer || '')}</p>`,
  });
  const usage = toolUsage(items, true);
  const tools = byKind(items, 'tool').sort((a, b) => (usage.get(b.data.name) || 0) - (usage.get(a.data.name) || 0));
  const maxUse = Math.max(1, ...tools.map(t => usage.get(t.data.name) || 0));
  const certs = byKindRecent(items, 'certificate');
  const langs = byKindRecent(items, 'language');
  const skillsHTML = (tools.length || certs.length || langs.length) ? `<div class="cols">
      <div>${tools.length ? `<h3 class="sub" id="sec-tools" data-reveal>🛠️ 스킬</h3><ul class="bars">${tools.map((t, idx) => {
        const n = usage.get(t.data.name) || 0;
        return `<li data-reveal style="--d:${Math.min(idx * 0.05, 0.4).toFixed(2)}s"><span>${esc(t.data.name)}${sample(t)}</span><span class="n">${n ? `프로젝트 ${n}건` : '연결 전'}</span><span class="bar" aria-hidden="true"><span style="width:${(n / maxUse) * 100}%"></span></span></li>`;
      }).join('')}</ul><p class="small muted">막대 길이 = 그 스킬을 쓴 공개 프로젝트 수</p>` : ''}</div>
      <div>${certs.length || langs.length ? `<h3 class="sub" id="sec-certificates" data-reveal>📜 자격·어학</h3>
        <ul class="list-plain">${certs.map((c, n) => `<li data-reveal style="--d:${Math.min(n * 0.06, 0.4).toFixed(2)}s"><span class="d">${esc(fmtMonth(c.data.date))}</span><span><b>${esc(c.data.name)}</b>${c.data.status === '예정' ? ' <span class="tag">취득 예정</span>' : ''}${sample(c)}<br><span class="small muted">${esc(c.data.issuer || '')}</span></span></li>`).join('')}
        ${langs.map(l => `<li data-reveal><span class="d">${esc(fmtMonth(l.data.date))}</span><span><b>${esc(l.data.test)}</b>${l.data.score ? ' ' + esc(l.data.score) : ''}${sample(l)}</span></li>`).join('')}</ul>` : ''}</div>
    </div>` : '';
  const resumeBody = eduHTML + skillsHTML + expHTML + actHTML + awHTML;
  $('#sec-resume').innerHTML = resumeBody ? `<h2 class="sec-title" id="h-resume" data-reveal><span class="ico" aria-hidden="true">🗂️</span>이력</h2>${resumeBody}` : '';
  if (!resumeBody) $('#sec-resume').hidden = true;

  // ----- 프로젝트 카드 -----
  const cover = (pr, cls = 'pcover') => `<div class="${cls}" data-key="p:${esc(pr.data.slug)}" ${pr.data.coverImage ? `style="background-image:url('${esc(pr.data.coverImage)}')"` : ''}>${pr.data.coverImage ? '' : `<span class="cv-ico">${icon(COMP_ICON[pr.data.primarySkill] || 'folder', 22)}</span><span class="cv-name">${esc(compName(pr.data.primarySkill) || '프로젝트')}</span>`}</div>`;
  const tagList = pr => {
    const ids = [pr.data.primarySkill, ...(pr.data.skills || []).filter(s => s !== pr.data.primarySkill)].filter(Boolean);
    return `<div class="tags">${ids.map((s, i) => `<span class="tag${i === 0 ? ' main' : ''}">${esc(compName(s))}</span>`).join('')}</div>`;
  };
  const metricLine = m => `${m.label} ${Number(m.value).toLocaleString('ko-KR')}${m.unit || ''}`;
  const card = (pr, featured, n = 0) => `<button type="button" class="pcard" data-open="${esc(pr.data.slug)}" aria-label="${esc(pr.data.title || '제목 없음')} 자세히 보기" data-reveal style="--d:${Math.min(n * 0.05, 0.35).toFixed(2)}s">
      ${cover(pr)}<div class="pbody">
        <span class="ptitle">${esc(pr.data.title || '제목 없음')}${sample(pr)}</span>
        ${featured && pr.data.metrics?.[0] ? `<span class="pkey">${esc(metricLine(pr.data.metrics[0]))}</span>` : ''}
        <p class="psum">${esc(pr.data.summary)}</p>
        ${featured && pr.data.role?.[0] ? `<span class="pmeta">맡은 일: ${esc(pr.data.role[0])}</span>` : ''}
        ${tagList(pr)}
        <span class="pmeta">${esc([period(pr.data.startDate, pr.data.endDate), pr.data.type].filter(Boolean).join(' · '))}</span>
        ${featured ? `<span class="more">자세히 보기 ${icon('arrow', 16)}</span>` : ''}
      </div></button>`;

  const featured = projects.filter(x => x.data.featured).sort((a, b) => (a.data.featuredOrder || 9) - (b.data.featuredOrder || 9)).slice(0, 3);
  $('#sec-featured').innerHTML = featured.length ? `<h2 class="sec-title" id="h-featured" data-reveal><span class="ico" aria-hidden="true">⭐</span>대표 프로젝트</h2>
    <div class="gallery featured">${featured.map((x, n) => card(x, true, n)).join('')}</div>` : '';
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
    const filtering = st.tab !== 'all' || st.type || st.year || st.q.trim();
    $('#plist').innerHTML = !list.length ? `<div class="empty-state" data-reveal>
          <span class="ico">${icon(filtering ? 'search' : 'folder', 24)}</span>
          <h3>${filtering ? '조건에 맞는 프로젝트가 없어요' : '아직 공개된 프로젝트가 없어요'}</h3>
          <p>${filtering ? '다른 역량 탭을 고르거나 검색어·필터를 지워 보세요.' : '프로젝트가 등록되면 여기에 보입니다.'}</p>
          ${filtering ? '<button type="button" class="btn" data-reset>필터 초기화</button>' : ''}</div>`
      : st.view === 'gallery' ? `<div class="gallery">${list.map((x, n) => card(x, false, n)).join('')}</div>`
        : `<table class="db"><thead><tr><th scope="col">제목</th><th scope="col">기간</th><th scope="col">유형</th><th scope="col">역량</th><th scope="col">역할</th></tr></thead><tbody>
          ${list.map(pr => `<tr class="row" data-open="${esc(pr.data.slug)}"><td><a href="#p-${esc(pr.data.slug)}" data-open="${esc(pr.data.slug)}"><b>${esc(pr.data.title || '제목 없음')}</b></a>${sample(pr)}</td><td>${esc(period(pr.data.startDate, pr.data.endDate))}</td><td>${esc(pr.data.type || '')}</td><td>${tagList(pr)}</td><td>${esc((pr.data.role || [])[0] || '')}</td></tr>`).join('')}
          </tbody></table><div class="db-cards">${list.map((x, n) => card(x, false, n)).join('')}</div>`;
    root.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tab === st.tab)));
    root.querySelectorAll('.seg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === st.view)));
    $('#pcount').textContent = `${list.length}건`;
    reveal($('#plist'));
  }

  $('#projects').innerHTML = `<h2 class="sec-title" id="h-projects" data-reveal><span class="ico" aria-hidden="true">📁</span>전체 프로젝트 <span class="muted small" id="pcount"></span></h2>
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
  let lastFocus = null, lastSource = null, pushedDetail = false, openKey = '', detailBackHash = '#portfolio';
  let bookGoTo = () => {};

  function evidenceHTML(ev, slug) {
    const meta = [ev.description, ev.size && kb(ev.size), ev.type === 'link' && host(ev.url)].filter(Boolean).map(esc).join(' · ');
    const inner = `<span class="i" aria-hidden="true">${icons[ev.type] || '📎'}</span><span><span class="t">${esc(ev.title)}</span><br><span class="m">${meta}</span>
      ${ev.type === 'image' && ev.url && !ev.url.startsWith('private:') ? `<br><img src="${esc(ev.url)}" alt="${esc(ev.title)}" loading="lazy">` : ''}
      ${!ev.url ? '<br><span class="m">파일이 아직 연결되지 않았습니다.</span>' : ''}</span>`;
    return ev.url && !ev.url.startsWith('private:')
      ? `<a class="ev" href="${esc(ev.url)}" target="_blank" rel="noopener" data-evidence="${esc(slug)}">${inner}</a>`
      : `<div class="ev">${inner}</div>`;
  }

  // 목록에서 이 항목의 표지 찾기(누른 카드 우선, 없으면 화면에 보이는 같은 항목)
  const sourceFor = key => {
    if (lastSource?.isConnected && lastSource.dataset.key === key) return lastSource;
    return [...root.querySelectorAll(`.main [data-key="${CSS.escape(key)}"]`)].find(el => { const r = el.getBoundingClientRect(); return r.width && r.bottom > 0 && r.top < innerHeight; }) || null;
  };
  function showDetail(html, key, { fromHash, hash }) {
    const wasOpen = !detail.hidden;
    if (!wasOpen) lastFocus = document.activeElement;
    detail.innerHTML = html;
    openKey = key;
    const src = wasOpen ? null : sourceFor(key);
    const target = detail.querySelector('[data-se-target]');
    detail.classList.toggle('shared', !!(src && target && motionOn()));
    detail.classList.remove('closing');
    detail.hidden = false;
    document.body.style.overflow = 'hidden';
    detail.scrollTop = 0;
    if (src && target) flyBetween(src, target);
    detail.querySelector('#d-title').focus({ preventScroll: true });
    if (opts.useHash && !fromHash && location.hash !== '#' + hash) { if (!/^#[pb]-/.test(location.hash)) detailBackHash = location.hash || '#portfolio'; history.pushState({ detail: true }, '', '#' + hash); pushedDetail = true; }
  }

  function openProject(slug, { fromHash = false } = {}) {
    const pr = bySlug(slug);
    if (!pr) return false;
    const d = pr.data;
    const idx = projects.indexOf(pr);
    const prev = projects[idx - 1], next = projects[idx + 1];
    const proc = d.process || {};
    const html = `<article class="sheet">
      <div class="sheet-bar"><span class="small muted">프로젝트</span><span>
        <button type="button" class="btn small" data-close aria-label="닫기">닫기 ✕</button></span></div>
      ${cover(pr, 'pcover se-big" data-se-target="1')}
      <div class="sheet-in">
        <h1 id="d-title" tabindex="-1">${esc(d.title || '제목 없음')}${sample(pr)}</h1>
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
        ${(proc.steps || []).length ? `<p><b>진행 단계</b></p><ol class="stepper">${proc.steps.map((st2, i) => `<li style="--d:${(0.15 + i * 0.08).toFixed(2)}s">${esc(st2)}</li>`).join('')}</ol>` : ''}
        ${proc.challenge ? `<p style="margin-top:16px"><b>어려웠던 점과 해결</b><br>${esc(proc.challenge)}</p>` : ''}
        <h2><span aria-hidden="true">📈</span>결과</h2>
        ${(d.metrics || []).length ? `<div class="metrics">${d.metrics.map(m => `<div class="metric"><div class="v">${Number.isFinite(Number(m.value)) && m.value !== null && m.value !== '' ? `<span class="count" data-to="${Number(m.value)}" data-fmt="ko">${esc(Number(m.value).toLocaleString('ko-KR'))}</span>` : ''}<span class="small"> ${esc(m.unit || '')}</span></div><div class="l">${esc(m.label)}</div></div>`).join('')}</div>` : ''}
        ${d.outcome ? `<p>${esc(d.outcome)}</p>` : ''}
        ${d.learned ? `<p><b>배운 점</b><br>${esc(d.learned)}</p>` : ''}
        <h2><span aria-hidden="true">📎</span>증빙</h2>
        ${(d.evidence || []).length ? `<div class="evid">${d.evidence.map(ev => evidenceHTML(ev, d.slug)).join('')}</div>` : '<p class="muted">공개된 증빙이 없습니다. 요청하시면 제공해 드립니다.</p>'}
        <div class="pager">
          ${prev ? `<button type="button" class="btn" data-open="${esc(prev.data.slug)}">← ${esc(prev.data.title || '제목 없음')}</button>` : '<span></span>'}
          ${next ? `<button type="button" class="btn" data-open="${esc(next.data.slug)}">${esc(next.data.title || '제목 없음')} →</button>` : ''}
        </div>
      </div></article>`;
    showDetail(html, 'p:' + slug, { fromHash, hash: 'p-' + slug });
    // 결과 숫자: 화면에 보이면 2초 동안 0 → 목표 값
    const counts = [...detail.querySelectorAll('.metric .count')];
    if (counts.length && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { countUp(en.target); io.unobserve(en.target); } }), { root: detail, threshold: 0.6 });
      counts.forEach(c => io.observe(c));
    } else counts.forEach(countUp);
    track('project', slug);
    return true;
  }

  function openBook(key, { fromHash = false } = {}) {
    const b = books.find(x => bookKey(x) === key);
    if (!b) return false;
    const d = b.data, body = bookBody(d), meta = bookMeta(d);
    bookGoTo(key, false);
    const html = `<article class="sheet book-sheet">
      <div class="sheet-bar"><span class="small muted">추천 도서</span><span>
        <button type="button" class="btn small" data-close aria-label="닫기">닫기 ✕</button></span></div>
      <div class="sheet-in book-detail">
        <div class="bd-cover">${bookCover(b, ' big" data-se-target="1')}</div>
        <div>
          <h1 id="d-title" tabindex="-1">${esc(d.title || '제목 없음')}${sample(b)}</h1>
          ${meta ? `<p class="muted">${meta}</p>` : ''}
          ${d.kdc ? `<span class="tag">KDC ${esc(d.kdc)}</span>` : ''}
          <h2><span aria-hidden="true">📖</span>소개</h2>${body.intro}
          <h2><span aria-hidden="true">🗂️</span>목차</h2>${body.toc}
          <h2><span aria-hidden="true">✍️</span>서평</h2>${body.review}
        </div>
      </div></article>`;
    showDetail(html, 'b:' + key, { fromHash, hash: 'b-' + key });
    return true;
  }

  function closeDetail({ fromHash = false } = {}) {
    if (detail.hidden || detail.classList.contains('closing')) return;
    // 직접 연 상세면 브라우저 '뒤로'와 같게 처리 → popstate에서 다시 불린다
    if (opts.useHash && !fromHash && pushedDetail && /^#[pb]-/.test(location.hash)) { pushedDetail = false; history.back(); return; }
    pushedDetail = false;
    const target = detail.querySelector('[data-se-target]'), src = sourceFor(openKey);
    const finish = () => {
      detail.hidden = true; detail.innerHTML = ''; detail.classList.remove('closing', 'shared');
      document.body.style.overflow = '';
      if (opts.useHash && !fromHash && /^#[pb]-/.test(location.hash)) history.pushState(null, '', location.pathname + location.search + detailBackHash);
      lastFocus?.focus?.({ preventScroll: true });
    };
    if (src && target && motionOn()) {
      detail.classList.add('closing');            // 시트는 서서히 사라지고, 큰 표지는 원래 자리로 돌아간다
      flyBetween(target, src, { duration: 420, hideTo: false }).then(finish);
      // 날아가는 동안 원래 표지는 숨겨 두었다가 끝나면 보인다
      src.style.visibility = 'hidden';
    } else finish();
  }

  // ----- 첫 화면 연락하기: 버튼을 누르면 아래에 연락 수단 카드가 떠오른다(다시 누르면 접힘) -----
  function toggleContact(force) {
    const box = $('#landing-contact'), btn = $('.cta [data-contact-toggle]');
    if (!box) return;
    const open = force ?? box.hidden;
    btn?.setAttribute('aria-expanded', String(open));
    if (open) {
      box.classList.remove('out'); box.hidden = false;
      box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop');
      const r = box.getBoundingClientRect();
      if (r.bottom > innerHeight) window.scrollBy({ top: r.bottom - innerHeight + 24, behavior: motionOn() ? 'smooth' : 'auto' });
      $('#h-contact').focus({ preventScroll: true });
    } else if (!box.hidden) {
      if (!motionOn()) { box.hidden = true; return; }
      box.classList.add('out');
      setTimeout(() => { if (box.classList.contains('out')) { box.hidden = true; box.classList.remove('out', 'pop'); } }, 220);
      btn?.focus({ preventScroll: true });
    }
  }

  // ----- 상단 '연락하기': 맨 위로 올라가며 연락처 상자가 빛난다 -----
  function glowContact() {
    setDrawer(false);
    if (view === 'landing') { toggleContact(true); return; }   // 첫 화면에서는 연락처 카드를 연다
    if (mode === 'cards' && topic) closeTopic({ push: true });    // 간단히 보기의 주제 페이지에 있으면 소개 화면으로
    const box = $('#pf-contact'); if (!box) return;
    const go = () => {
      box.classList.remove('glow'); void box.offsetWidth; box.classList.add('glow');
      box.focus({ preventScroll: true });
      clearTimeout(glowContact.t); glowContact.t = setTimeout(() => box.classList.remove('glow'), 2600);
    };
    if (window.scrollY < 4 || !motionOn()) { window.scrollTo({ top: 0, behavior: 'auto' }); go(); return; }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // 맨 위에 닿으면 빛나기 시작
    const t0 = performance.now();
    const wait = () => (window.scrollY < 4 || performance.now() - t0 > 1200) ? go() : requestAnimationFrame(wait);
    requestAnimationFrame(wait);
  }

  // ----- 이벤트 연결 -----
  root.addEventListener('click', e => {
    const open = e.target.closest('[data-open]');
    if (open) { e.preventDefault(); lastSource = open.querySelector('[data-key]') || null; openProject(open.dataset.open); return; }
    const bk = e.target.closest('[data-book]');
    if (bk) { e.preventDefault(); lastSource = bk.querySelector('[data-key]'); openBook(bk.dataset.book); return; }
    if (e.target.closest('[data-enter]')) { e.preventDefault(); setView('portfolio', { push: true }); return; }
    if (e.target.closest('[data-contact-toggle]')) { e.preventDefault(); toggleContact(); return; }
    if (e.target.closest('[data-contact-glow]')) { e.preventDefault(); glowContact(); return; }
    if (e.target.closest('[data-home]')) { e.preventDefault(); setView('landing', { push: true }); return; }
    const sc = e.target.closest('[data-scroll]');
    if (sc) {
      e.preventDefault();
      goToTarget(sc.dataset.scroll, { push: true });
      setDrawer(false);
      return;
    }
    if (e.target.closest('[data-close]') || e.target === detail) { closeDetail(); return; }
    const copy = e.target.closest('[data-copy]');
    if (copy) {
      navigator.clipboard?.writeText(copy.dataset.copy).then(() => showToast('이메일 주소를 복사했어요'), () => showToast('복사하지 못했어요. 주소를 직접 선택해 주세요'));
      if (!navigator.clipboard) showToast('복사하지 못했어요. 주소를 직접 선택해 주세요');
      return;
    }
    if (e.target.closest('[data-reset]')) {
      Object.assign(st, { tab: 'all', type: '', year: '', q: '' });
      $('#f-type').value = ''; $('#f-year').value = ''; $('#f-q').value = '';
      drawList(); return;
    }
    if (e.target.closest('[data-theme-toggle]')) { toggleTheme(); return; }
    const mb = e.target.closest('[data-mode]');
    if (mb) { setMode(mb.dataset.mode); return; }
    const tp = e.target.closest('[data-topic]');
    if (tp) { e.preventDefault(); openTopic(tp.dataset.topic, { push: true }); return; }
    if (e.target.closest('[data-topics]')) { e.preventDefault(); closeTopic({ push: true }); return; }
    const svc = e.target.closest('[data-comp]');
    if (svc) {
      Object.assign(st, { tab: svc.dataset.comp, type: '', year: '', q: '' });
      $('#f-type').value = ''; $('#f-year').value = ''; $('#f-q').value = '';
      drawList();
      goToTarget('projects', { push: true });
      return;
    }
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
  // ----- 추천 도서: Carousel(좌우 버튼 · 위치 점 · 손가락으로 밀기) + 책마다 소개 · 목차 · 서평 Tabs -----
  const books = items.filter(i => i.kind === 'book').sort((a, b) => (b.data.readDate || '').localeCompare(a.data.readDate || '') || (a.sort || 0) - (b.sort || 0));
  const shade = t => { let h = 0; for (const ch of t || '') h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % 4; };
  const bookCover = (b, cls = '') => `<div class="book-cover s${shade(b.data.title)}${cls}" data-key="b:${esc(String(b.id))}"><span class="bc-t">${esc(b.data.title || '')}</span>${b.data.author ? `<span class="bc-a">${esc(b.data.author)}</span>` : ''}</div>`;
  const bookMeta = d => [d.author, d.publisher, d.year].filter(Boolean).map(esc).join(' · ');
  const bookBody = d => ({
    intro: d.intro ? `<p>${esc(d.intro)}</p>` : '<p class="muted">소개가 없습니다.</p>',
    toc: (d.toc || []).length ? `<ol class="toc">${d.toc.map(t => `<li>${esc(t)}</li>`).join('')}</ol>` : '<p class="muted">목차가 없습니다.</p>',
    review: d.review ? `${d.review.split(/\n+/).filter(Boolean).map(t => `<p>${esc(t)}</p>`).join('')}${d.readDate ? `<p class="muted small">${esc(fmtMonth(d.readDate))} 읽음</p>` : ''}` : '<p class="muted">서평이 없습니다.</p>',
  });
  const bookKey = b => String(b.id);
  if (books.length) {
    const TAB = [['intro', '소개'], ['toc', '목차'], ['review', '서평']];
    $('#sec-books').innerHTML = `<h2 class="sec-title" id="h-books" data-reveal><span class="ico" aria-hidden="true">📚</span>추천 도서</h2>
      <div class="carousel" role="region" aria-roledescription="carousel" aria-label="추천 도서" data-reveal>
        <div class="car-track" tabindex="0" aria-label="추천 도서 목록. 좌우 방향키로 넘길 수 있습니다">
        ${books.map((b, i) => {
          const d = b.data, meta = bookMeta(d), body = bookBody(d);
          return `<article class="book slide" role="group" aria-roledescription="slide" aria-label="${i + 1} / ${books.length}: ${esc(d.title || '')}">
            <button type="button" class="cover-btn" data-book="${esc(bookKey(b))}" aria-label="${esc(d.title || '책')} 크게 보기">${bookCover(b)}</button>
            <div class="book-main">
              <div class="book-meta"><h3>${esc(d.title || '제목 없음')}${sample(b)}</h3>${meta ? `<p class="muted">${meta}</p>` : ''}${d.kdc ? `<span class="tag">KDC ${esc(d.kdc)}</span>` : ''}</div>
              <div class="btabs" role="tablist" aria-label="${esc(d.title || '책')} 정보">
                ${TAB.map(([k, l], j) => `<button type="button" role="tab" id="bt-${i}-${k}" aria-controls="bp-${i}-${k}" aria-selected="${j === 0}" tabindex="${j === 0 ? 0 : -1}">${l}</button>`).join('')}
                <span class="btab-ink" aria-hidden="true"></span>
              </div>
              <div class="bpanels">${TAB.map(([k], j) => `<div class="bpanel${j === 0 ? ' on' : ''}" role="tabpanel" id="bp-${i}-${k}" aria-labelledby="bt-${i}-${k}" tabindex="0"${j ? ' aria-hidden="true"' : ''}>${body[k]}</div>`).join('')}</div>
            </div>
          </article>`;
        }).join('')}
        </div>
        ${books.length > 1 ? `<div class="car-ctrl">
          <button type="button" class="car-btn" data-car="-1" aria-label="이전 책">${icon('arrow', 18)}</button>
          <div class="car-dots" role="group" aria-label="책 위치">${books.map((b, i) => `<button type="button" class="car-dot" data-dot="${i}" aria-label="${i + 1}번째 책: ${esc(b.data.title || '')}"${i === 0 ? ' aria-current="true"' : ''}></button>`).join('')}</div>
          <button type="button" class="car-btn" data-car="1" aria-label="다음 책">${icon('arrow', 18)}</button>
          <span class="car-count small muted" aria-live="polite">1 / ${books.length}</span>
        </div>` : ''}
      </div>`;
    const sb = $('#sec-books'), track = sb.querySelector('.car-track'), slides = [...sb.querySelectorAll('.slide')];
    const curIdx = () => Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    const goTo = (i, smooth = true) => { i = Math.max(0, Math.min(slides.length - 1, i)); track.scrollTo({ left: slides[i].offsetLeft - track.offsetLeft, behavior: smooth && motionOn() ? 'smooth' : 'auto' }); };
    const sync = () => {
      const i = curIdx();
      sb.querySelectorAll('.car-dot').forEach((d, j) => d.toggleAttribute('aria-current', j === i));
      const prevB = sb.querySelector('[data-car="-1"]'), nextB = sb.querySelector('[data-car="1"]');
      if (prevB) prevB.disabled = i === 0;
      if (nextB) nextB.disabled = i === slides.length - 1;
      const c = sb.querySelector('.car-count'); if (c) c.textContent = `${i + 1} / ${slides.length}`;
      slides.forEach((sl, j) => sl.toggleAttribute('inert', j !== i));   // 화면 밖 슬라이드는 Tab 이동에서 뺀다
    };
    let syncT; track.addEventListener('scroll', () => { cancelAnimationFrame(syncT); syncT = requestAnimationFrame(sync); }, { passive: true });
    sb.addEventListener('click', e => {
      const btn = e.target.closest('[data-car]'); if (btn) goTo(curIdx() + Number(btn.dataset.car));
      const dot = e.target.closest('[data-dot]'); if (dot) goTo(Number(dot.dataset.dot));
    });
    track.addEventListener('keydown', e => {
      if (e.target !== track) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); goTo(curIdx() + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(curIdx() - 1); }
    });
    sync();
    bookGoTo = (key, smooth) => { const i = books.findIndex(b => bookKey(b) === key); if (i >= 0) goTo(i, smooth); };

    // Tabs: 표시 막대가 미끄러지고 내용은 서서히 바뀐다
    const placeInk = tl => {
      const on = tl.querySelector('[aria-selected="true"]'), ink = tl.querySelector('.btab-ink');
      if (on && ink && on.offsetWidth) { ink.style.width = on.offsetWidth + 'px'; ink.style.transform = `translateX(${on.offsetLeft}px)`; }
    };
    const selectTab = (btn, focus) => {
      const tl = btn.closest('.btabs'), card = tl.closest('.book');
      tl.querySelectorAll('[role="tab"]').forEach(t => { const on = t === btn; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
      card.querySelectorAll('.bpanel').forEach(pn => { const on = pn.id === btn.getAttribute('aria-controls'); pn.classList.toggle('on', on); pn.setAttribute('aria-hidden', String(!on)); });
      placeInk(tl);
      if (focus) btn.focus();
    };
    sb.addEventListener('click', e => { const t = e.target.closest('[role="tab"]'); if (t) selectTab(t); });
    sb.addEventListener('keydown', e => {
      const t = e.target.closest('[role="tab"]'); if (!t) return;
      const tabs = [...t.parentElement.querySelectorAll('[role="tab"]')], k = tabs.indexOf(t);
      const next = { ArrowRight: k + 1, ArrowLeft: k - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (next === undefined) return;
      e.preventDefault(); e.stopPropagation(); selectTab(tabs[(next + tabs.length) % tabs.length], true);
    });
    const tls = [...sb.querySelectorAll('.btabs')];
    requestAnimationFrame(() => tls.forEach(placeInk));
    if ('ResizeObserver' in window) { const ro = new ResizeObserver(() => { tls.forEach(placeInk); sync(); }); tls.forEach(t => ro.observe(t)); ro.observe(track); }
    document.fonts?.ready.then(() => tls.forEach(placeInk));
  } else $('#sec-books').hidden = true;

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
      if (cur && mode === 'all') setActive(cur.id);
    }, { rootMargin: '-15% 0px -70% 0px' });
    secEls.forEach(el => io.observe(el));
  }
  if (secEls[0]) setActive(secEls[0].id);

  // Dark Mode 전환(선택은 이 브라우저에 기억)
  function toggleTheme() {
    const dark = document.documentElement.dataset.theme !== 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    try { localStorage.setItem('lis-theme', dark ? 'dark' : 'light'); } catch { /* 없음 */ }
    $('[data-theme-toggle]')?.setAttribute('aria-pressed', String(dark));
  }
  // ----- 포트폴리오 보기 방식: 간단히 보기(주제 카드 → 주제 페이지) / 한 눈에 보기(긴 스크롤) -----
  const pv = $('.pf-view');
  let mode = 'cards', topic = null;
  try { if (localStorage.getItem('lis-pf-mode') === 'all') mode = 'all'; } catch { /* 없음 */ }
  const counts = k => items.filter(i => i.kind === k).length;
  const txt = sel => [...root.querySelectorAll(sel)].map(e => e.textContent.replace(/예시$/, '').trim()).filter(Boolean);
  const uniq = a => [...new Set(a)];
  const TOPIC = {
    'sec-about': () => ({ desc: p.headline || p.tagline || '자기소개와 연락처', chips: (p.interests || []).map(i => i.label).slice(0, 3) }),
    'sec-skills': () => ({ desc: '희망 직무에 맞춘 역량과 관련 프로젝트', chips: txt('#sec-skills .svc-title').map(t => t.replace('핵심 역량', '').trim()).slice(0, 3), n: root.querySelectorAll('#sec-skills .svc-card').length, unit: '개 역량' }),
    'sec-summary': () => ({ desc: '학력·경력·활동·수상·자격·스킬을 숫자로 요약', chips: txt('#sec-summary .bento .label').slice(0, 4) }),
    'sec-resume': () => ({ desc: '학력부터 자격·어학까지 시간순 이력', chips: [['education', '학력'], ['experience', '경력'], ['activity', '활동'], ['award', '수상'], ['certificate', '자격']].filter(([k]) => counts(k)).map(([k, l]) => `${l} ${counts(k)}`).slice(0, 4) }),
    'sec-featured': () => ({ desc: '역할·과정·결과·증빙을 갖춘 대표작', chips: uniq(txt('#sec-featured .ptitle')).slice(0, 3), n: root.querySelectorAll('#sec-featured .pcard').length, unit: '개' }),
    'projects': () => ({ desc: '역량·유형·연도로 찾아보는 모든 프로젝트', chips: uniq(projects.map(x => x.data.type).filter(Boolean)).slice(0, 3), n: projects.length, unit: '건' }),
    'sec-books': () => ({ desc: '읽고 추천하는 책과 서평', chips: books.map(b => b.data.title).filter(Boolean).slice(0, 3), n: books.length, unit: '권' }),
  };
  // 소개는 '간단히 보기' 첫 화면에 바로 보이므로 주제 카드에서는 뺀다
  const topicIds = () => SEC.map(x => x[0]).filter(id => { const el = root.querySelector('#' + id); return id !== 'sec-about' && el && !el.hidden; });
  function drawTopicCards() {
    $('#topic-cards').innerHTML = topicIds().map((id, i) => {
      const [, label, ic] = SEC.find(x => x[0] === id), t = TOPIC[id]?.() || { desc: '' };
      return `<div role="listitem" class="tc-cell" data-reveal style="--d:${(i * 0.05).toFixed(2)}s"><a class="card topic-card" href="#s-${id}" data-topic="${id}">
        <span class="tc-top"><span class="tc-ico">${icon(ic, 22)}</span>${t.n ? `<span class="tc-n"><b>${t.n}</b>${esc(t.unit)}</span>` : ''}</span>
        <span class="tc-title">${esc(label)}</span>
        <span class="tc-desc">${esc(t.desc)}</span>
        ${(t.chips || []).length ? `<span class="tc-chips">${t.chips.map(c => `<span class="tag">${esc(c)}</span>`).join('')}</span>` : ''}
        <span class="tc-go">자세히 보기 ${icon('arrow', 16)}</span>
      </a></div>`;
    }).join('');
  }
  function applyMode() {
    pv.dataset.pfMode = mode;
    if (topic) pv.dataset.pfTopic = topic; else delete pv.dataset.pfTopic;
    root.querySelectorAll('.pf-view > section').forEach(sec => sec.classList.toggle('topic-on', sec.id === topic));
    root.querySelectorAll('.pf-switch [data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    const ids = topicIds(), k = ids.indexOf(topic);
    const lab = id => SEC.find(x => x[0] === id)?.[1] || '';
    $('.tb-pager').innerHTML = topic ? `${ids[k - 1] ? `<a class="btn small" href="#s-${ids[k - 1]}" data-topic="${ids[k - 1]}">← ${esc(lab(ids[k - 1]))}</a>` : ''}${ids[k + 1] ? `<a class="btn small" href="#s-${ids[k + 1]}" data-topic="${ids[k + 1]}">${esc(lab(ids[k + 1]))} →</a>` : ''}` : '';
    setActive(mode === 'all' ? (secEls.find(el => seen.get(el.id)) || secEls[0])?.id : (topic || 'sec-about'));
  }
  function enterAnim(el) { if (motionOn() && el) { el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter'); } }
  function setMode(m) {
    if (m === mode) return;
    mode = m; topic = null;
    try { localStorage.setItem('lis-pf-mode', m); } catch { /* 없음 */ }
    if (opts.useHash && /^#s-/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search + '#portfolio');
    applyMode(); enterAnim(pv); reveal(pv);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function openTopic(id, { push = false, fromHash = false } = {}) {
    if (id === 'sec-about') {   // 소개는 주제 카드 화면 맨 위에 있다
      if (view !== 'portfolio') setView('portfolio', { fromHash: true });
      if (mode !== 'cards') { mode = 'cards'; try { localStorage.setItem('lis-pf-mode', 'cards'); } catch { /* 없음 */ } }
      if (topic) closeTopic({ push, fromHash }); else { applyMode(); window.scrollTo({ top: 0, behavior: motionOn() ? 'smooth' : 'auto' }); }
      return true;
    }
    if (!topicIds().includes(id)) return false;
    if (view !== 'portfolio') setView('portfolio', { fromHash: true });
    if (mode !== 'cards') { mode = 'cards'; try { localStorage.setItem('lis-pf-mode', 'cards'); } catch { /* 없음 */ } }
    const same = topic === id;
    topic = id; applyMode();
    if (!same) { window.scrollTo({ top: 0, behavior: 'instant' }); enterAnim(root.querySelector('#' + id)); reveal(root.querySelector('#' + id)); }
    const h = root.querySelector('#' + id + ' .sec-title'); if (h && !same) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    if (opts.useHash && push && !fromHash && location.hash !== '#s-' + id) history.pushState(null, '', location.pathname + location.search + '#s-' + id);
    return true;
  }
  function closeTopic({ push = false, fromHash = false } = {}) {
    if (!topic) return;
    const was = topic;
    topic = null; applyMode(); enterAnim(pv); reveal(pv);
    window.scrollTo({ top: 0, behavior: 'instant' });
    $(`#topic-cards [data-topic="${was}"]`)?.focus({ preventScroll: true });
    if (opts.useHash && push && !fromHash) history.pushState(null, '', location.pathname + location.search + '#portfolio');
  }
  // 섹션 안의 대상(예: 요약 카드 → 이력의 활동)으로 이동. 간단히 보기면 그 주제 페이지를 먼저 연다
  function goToTarget(id, { push = false } = {}) {
    const el = root.querySelector('#' + CSS.escape(id)); if (!el) return;
    const sec = el.closest('.pf-view > section');
    if (mode === 'cards' && sec) {
      openTopic(sec.id, { push });
      if (el !== sec) requestAnimationFrame(() => el.scrollIntoView({ behavior: motionOn() ? 'smooth' : 'auto' }));
    } else {
      el.scrollIntoView({ behavior: motionOn() ? 'smooth' : 'auto' });
      if (sec) setActive(sec.id);
    }
  }
  drawTopicCards();
  applyMode();

  // ----- 첫 화면(간단한 프로필 + 연락하기) ↔ 포트폴리오(세부 내용) -----
  let view = '';
  function setView(v, { push = false, fromHash = false } = {}) {
    if (v === view) return;
    const first = !view;
    view = v;
    shell.classList.toggle('landing', v === 'landing');
    if (opts.useHash && push && !fromHash) history.pushState(null, '', location.pathname + location.search + (v === 'portfolio' ? '#portfolio' : ''));
    if (first) return;
    setDrawer(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (v === 'portfolio') {
      if (motionOn()) { pv.classList.remove('enter'); void pv.offsetWidth; pv.classList.add('enter'); }
      reveal(pv);
      $('#h-about')?.setAttribute('tabindex', '-1'); $('#h-about')?.focus({ preventScroll: true });
      setActive(mode === 'all' ? secEls[0]?.id : (topic || 'sec-about'));
      opts.track?.('view', 'portfolio');
    } else $('[data-enter]')?.focus({ preventScroll: true });
  }
  const h0 = opts.useHash ? decodeURIComponent(location.hash.slice(1)) : '';
  setView(opts.initialView || (h0 ? 'portfolio' : 'landing'));

  reveal(root);
  revealSections();

  // ----- Parallax Scrolling: 첫 화면 배경은 천천히(0.35배 늦게), 앞쪽 이미지는 더 빠르게 -----
  const pxBg = $('[data-px="bg"]'), pxFg = $('[data-px="fg"]'), heroEl = $('.hero');
  const parallax = () => {
    if (!heroEl || !motionOn()) return;
    const y = window.scrollY, h = heroEl.offsetTop + heroEl.offsetHeight;
    if (y > h + 200) return;                                   // 첫 화면을 지나면 계산하지 않는다
    const fgRate = matchMedia('(max-width: 1023px)').matches ? 0.08 : 0.2;
    if (pxBg) pxBg.style.transform = `translate3d(0, ${(y * 0.35).toFixed(1)}px, 0)`;
    if (pxFg) pxFg.style.transform = `translate3d(0, ${(-y * fgRate).toFixed(1)}px, 0)`;
  };

  const topbar = $('#topbar');
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      topbar.classList.toggle('scrolled', window.scrollY > 4); parallax();
      // 맨 아래까지 내리면 마지막 섹션(서평 등)을 강조
      if (mode === 'all' && secEls.length && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) setActive(secEls[secEls.length - 1].id);
      ticking = false;
    });
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
    openProject, openBook, closeDetail, setView, openTopic, closeTopic, goToTarget, get mode() { return mode; }, get view() { return view; },
    destroy() { io?.disconnect(); revealIO?.disconnect(); window.removeEventListener('scroll', onScroll); document.removeEventListener('keydown', onKey); window.removeEventListener('beforeprint', beforePrint); document.body.style.overflow = ''; },
  };
}

export const metricKeyLabel = k => METRIC_KEYS.find(m => m.key === k)?.label || k;

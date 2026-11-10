import { getPublicData, track, MODE } from './api.js';
import { mountPortfolio } from './render.js';
import { ROLES, profileOf } from './model.js';

const root = document.getElementById('app');

function roleFromUrl() {
  try {
    const r = new URLSearchParams(location.search).get('role');
    return ROLES.some(x => x.id === r) ? r : null;
  } catch { return null; }
}

async function start() {
  let res;
  try {
    res = await getPublicData();
  } catch (e) {
    root.innerHTML = `<div class="page"><p class="empty" style="margin-top:40px">포트폴리오를 불러오지 못했습니다. 잠시 후 다시 열어 주세요.</p></div>`;
    return;
  }
  const p = profileOf(res.items).data;
  if (p.name) document.title = `${p.name} · 포트폴리오`;
  const note = res.source === 'snapshot'
    ? `최신 데이터를 불러오지 못해 ${String(res.checkedAt || '').slice(0, 10)} 기준 내용을 보여드립니다`
    : MODE === 'demo' ? '데모 데이터' : '';
  let app;
  try {
    app = mountPortfolio(root, res.items, { useHash: true, roleOverride: roleFromUrl(), track, footerNote: note, adminHref: 'admin.html', themeToggle: true });
  } catch (e) {
    console.error(e);
    root.innerHTML = `<div class="page"><p class="empty" style="margin-top:40px">화면을 그리는 중 문제가 생겼습니다. 새로고침(Ctrl+Shift+R) 후에도 같으면 관리 화면에서 최근에 고친 항목을 확인해 주세요.<br><small>${String(e.message || e).replace(/[<>&]/g, '')}</small></p></div>`;
    return;
  }

  const route = () => {
    const h = decodeURIComponent(location.hash.slice(1));
    if (h.startsWith('p-')) app.openProject(h.slice(2), { fromHash: true });
    else app.closeDetail({ fromHash: true });
  };
  window.addEventListener('hashchange', route);
  window.addEventListener('popstate', route);
  route();
  track('view', 'home');
}

start();

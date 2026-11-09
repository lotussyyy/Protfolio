// 매일 GitHub Actions가 실행: Supabase 공개 뷰를 읽어 data/portfolio.json에 저장한다 (F-6.12)
// - Supabase 무료 프로젝트가 활동 부족으로 일시정지되지 않도록 매일 한 번 접속하는 역할도 한다.
// - 공개 뷰만 읽으므로 비공개 항목·취업 메모는 이 파일에 들어갈 수 없다.
import { writeFileSync } from 'node:fs';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;
if (!url || !key) {
  // Supabase를 아직 연결하지 않았으면 조용히 건너뛴다(데모 모드)
  console.log('SUPABASE_URL, SUPABASE_ANON_KEY 비밀값이 없어 건너뜁니다. README 4단계를 마치면 동작합니다.');
  process.exit(0);
}

const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/public_items?select=*`, {
  // 새 공개 키(sb_publishable_…)는 apikey 헤더에만, 예전 anon key(eyJ…)는 Authorization에도 넣는다
  headers: key.startsWith('eyJ') ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key },
});
if (!res.ok) {
  console.error(`공개 데이터를 읽지 못했습니다: ${res.status} ${await res.text()}`);
  console.error('프로젝트가 일시정지되었다면 Supabase 대시보드에서 Restore(재개)하세요.');
  process.exit(1);
}
const rows = await res.json();
const items = rows.map(r => ({
  id: r.id, kind: r.kind, data: r.data, visibility: 'public', status: 'published',
  isSample: !!r.is_sample, sort: r.sort || 0, updatedAt: r.updated_at,
}));
const now = new Date().toISOString();
writeFileSync('data/portfolio.json', JSON.stringify({ schemaVersion: 2, exportedAt: now, checkedAt: now, items }, null, 2) + '\n');
console.log(`공개 항목 ${items.length}건 저장 (${now})`);

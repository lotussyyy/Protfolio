// 데이터 정의와 계산 규칙 (PRD 6장·7장·F-7)
// 모든 데이터는 item 하나의 모양을 공유한다:
// { id, kind, data, visibility: 'public'|'private', status: 'published'|'draft', isSample, sort, updatedAt }

export const SCHEMA_VERSION = 2;

export const ROLES = [
  { id: 'public', name: '공공도서관 사서' },
  { id: 'academic', name: '대학도서관 사서' },
  { id: 'school', name: '학교도서관 사서·사서교사' },
  { id: 'archives', name: '기록연구사·기록관리' },
];

export const PROJECT_TYPES = ['수업', '실습', '교내 활동', '대외활동', '개인'];
export const METRIC_KEYS = [
  { key: '', label: '(표준 key 없음)' },
  { key: 'records_cataloged', label: '정리한 목록 레코드(건)' },
  { key: 'queries_answered', label: '응대한 참고질의(건)' },
  { key: 'participants', label: '참여자(명)' },
  { key: 'satisfaction', label: '만족도(점)' },
  { key: 'sessions', label: '운영 회차(회)' },
  { key: 'items_selected', label: '선정·평가 자료(권)' },
  { key: 'records_described', label: '기술한 기록물(건)' },
  { key: 'items_digitized', label: '디지털화·분석 자료(건)' },
];

const monthField = (key, label, required) => ({ key, label, type: 'month', required });

// 활동 항목에만 붙는 필드(관련 프로젝트 연결)
const related = { key: 'relatedProjects', label: '관련 프로젝트', type: 'projects' };

export const KINDS = {
  education: {
    label: '학력', section: 'education',
    title: d => [d.school, d.major].filter(Boolean).join(' '),
    fields: [
      { key: 'school', label: '학교', type: 'text', required: true },
      { key: 'major', label: '전공', type: 'text', required: true },
      { key: 'minor', label: '복수·부전공', type: 'text' },
      monthField('startDate', '입학', true), monthField('endDate', '졸업(예정)'),
      { key: 'status', label: '상태', type: 'select', options: ['재학', '졸업 예정', '졸업'] },
      { key: 'gpa', label: '학점', type: 'number', step: '0.01' },
      { key: 'gpaMax', label: '만점', type: 'number', step: '0.1' },
      { key: 'gpaPublic', label: '학점 공개', type: 'bool' },
      { key: 'note', label: '한 줄 메모(졸업 논문·주요 이수 과목)', type: 'text' },
    ],
  },
  experience: {
    label: '경력', section: 'experience',
    title: d => [d.organization, d.position].filter(Boolean).join(' · '),
    fields: [
      { key: 'organization', label: '기관', type: 'text', required: true },
      { key: 'position', label: '직위·업무', type: 'text', required: true },
      { key: 'employmentType', label: '고용 형태', type: 'select', options: ['인턴', '근로장학생', '아르바이트', '계약직', '기타'], custom: true },
      monthField('startDate', '시작', true), monthField('endDate', '종료(비우면 진행 중)'),
      { key: 'description', label: '맡은 일(1~2줄)', type: 'textarea' },
    ],
  },
  activity: {
    label: '활동', section: 'activities',
    title: d => d.title,
    fields: [
      { key: 'title', label: '활동명', type: 'text', required: true },
      { key: 'organization', label: '기관', type: 'text' },
      { key: 'type', label: '유형', type: 'select', options: ['교내 활동', '대외활동', '동아리', '봉사', '현장실습'], custom: true },
      { key: 'role', label: '역할', type: 'text' },
      monthField('startDate', '시작', true), monthField('endDate', '종료'),
      { key: 'hours', label: '활동 시간', type: 'number' },
      related,
    ],
  },
  award: {
    label: '수상', section: 'awards',
    title: d => [d.title, d.rank].filter(Boolean).join(' '),
    fields: [
      { key: 'title', label: '수상명', type: 'text', required: true },
      { key: 'rank', label: '등급', type: 'text' },
      { key: 'issuer', label: '주최·수여 기관', type: 'text' },
      monthField('date', '수상일', true),
    ],
  },
  certificate: {
    label: '자격', section: 'certificates',
    title: d => d.name,
    fields: [
      { key: 'name', label: '자격명', type: 'text', required: true },
      { key: 'issuer', label: '발급 기관', type: 'text' },
      { key: 'status', label: '상태', type: 'select', options: ['취득', '예정'] },
      monthField('date', '취득(예정)일'),
    ],
  },
  language: {
    label: '어학', section: 'languages',
    title: d => d.test,
    fields: [
      { key: 'test', label: '시험', type: 'text', required: true },
      { key: 'score', label: '점수·등급', type: 'text' },
      monthField('date', '응시일'),
      { key: 'scorePublic', label: '점수 공개', type: 'bool' },
    ],
  },
  tool: {
    label: '스킬', section: 'tools',
    title: d => d.name,
    fields: [
      { key: 'name', label: '이름(프로젝트 도구 목록과 같은 표기)', type: 'text', required: true },
      { key: 'category', label: '분류', type: 'select', options: ['목록·분류', '시스템', '데이터', '문서·디자인', '기타'], custom: true },
    ],
  },
  project: {
    label: '프로젝트', section: 'projects',
    title: d => d.title,
    fields: [
      { key: 'title', label: '제목', type: 'text', required: true },
      { key: 'slug', label: '주소용 이름(영문 소문자·숫자·하이픈)', type: 'slug' },
      { key: 'summary', label: '카드용 한 줄 요약(80자)', type: 'text', max: 80, required: true },
      { key: 'type', label: '유형', type: 'select', options: PROJECT_TYPES, required: true, custom: true },
      { key: 'organization', label: '수업명·기관', type: 'text' },
      monthField('startDate', '시작', true), monthField('endDate', '종료(비우면 진행 중)'),
      { key: 'hours', label: '투입 시간', type: 'number' },
      { key: 'primarySkill', label: '주 역량', type: 'competency', required: true },
      { key: 'skills', label: '관련 역량', type: 'competencies' },
      { key: 'tools', label: '사용 도구·기준', type: 'tools' },
      { key: 'teamSize', label: '팀 인원(혼자면 1)', type: 'number' },
      { key: 'contribution', label: '본인 기여도(%)', type: 'number' },
      { key: 'role', label: '역할(한 줄에 하나)', type: 'lines', required: true },
      { key: 'problem', label: '과정: 문제 상황', type: 'textarea', path: ['process', 'problem'] },
      { key: 'steps', label: '과정: 진행 단계(한 줄에 하나)', type: 'lines', path: ['process', 'steps'] },
      { key: 'challenge', label: '과정: 어려웠던 점과 해결', type: 'textarea', path: ['process', 'challenge'] },
      { key: 'metrics', label: '결과: 정량 성과', type: 'metrics' },
      { key: 'outcome', label: '결과: 정성 성과', type: 'textarea' },
      { key: 'learned', label: '배운 점', type: 'textarea' },
      { key: 'evidence', label: '증빙', type: 'evidence' },
      { key: 'featured', label: '대표 프로젝트', type: 'bool' },
      { key: 'featuredOrder', label: '대표 순서(1~3)', type: 'number' },
    ],
  },
  book: {
    label: '서평', section: 'books',
    title: d => d.title,
    fields: [
      { key: 'title', label: '책 제목', type: 'text' },
      { key: 'author', label: '지은이', type: 'text' },
      { key: 'publisher', label: '출판사', type: 'text' },
      { key: 'year', label: '출간 연도', type: 'number' },
      { key: 'kdc', label: 'KDC 분류기호', type: 'text' },
      { key: 'intro', label: '소개(책 내용 요약)', type: 'textarea' },
      { key: 'toc', label: '목차(한 줄에 하나)', type: 'lines' },
      { key: 'review', label: '서평(나의 감상·추천 이유)', type: 'textarea' },
      { key: 'readDate', label: '읽은 때(YYYY-MM)', type: 'text' },
    ],
  },
  competency: {
    label: '역량', section: 'competencies',
    title: d => d.name,
    fields: [
      { key: 'cid', label: 'id(영문)', type: 'slug', required: true },
      { key: 'name', label: '이름', type: 'text', required: true },
      { key: 'description', label: '한 줄 설명', type: 'text' },
      { key: 'roles', label: '직무별 중요도', type: 'roles' },
    ],
  },
};

export const RESUME_KINDS = ['education', 'experience', 'activity', 'award', 'certificate', 'language', 'tool'];

// ---------- 공통 유틸 ----------
export const get = (obj, path) => path.reduce((o, k) => (o == null ? undefined : o[k]), obj);
export const fmtMonth = m => (m ? m.replace('-', '.') : '');
export const period = (s, e) => (!s && !e ? '' : `${fmtMonth(s)} ~ ${e ? fmtMonth(e) : '진행 중'}`);
export const todayMonth = () => new Date().toISOString().slice(0, 7);
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36));

export function slugify(s) {
  const ascii = (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return ascii || 'p-' + Math.random().toString(36).slice(2, 7);
}

const monthIndex = m => { const [y, mo] = m.split('-').map(Number); return y * 12 + (mo - 1); };

// ---------- 공개 범위 (F-7, DB의 public_items 뷰와 같은 규칙) ----------
export const isVisible = it => it.visibility === 'public' && it.status === 'published';

export function toPublic(it) {
  const d = structuredClone(it.data || {});
  if (it.kind === 'project') d.evidence = (d.evidence || []).filter(e => e.public);
  if (it.kind === 'education' && !d.gpaPublic) { delete d.gpa; delete d.gpaMax; }
  if (it.kind === 'language' && !d.scorePublic) delete d.score;
  if (it.kind === 'profile') {
    if (d.contacts) d.contacts.links = (d.contacts.links || []).filter(l => l.public !== false);
    if (d.resumePublic === false) delete d.resumeFile;
  }
  return { id: it.id, kind: it.kind, data: d, visibility: 'public', status: 'published', isSample: !!it.isSample, sort: it.sort || 0, updatedAt: it.updatedAt };
}

export const publicItems = items => items.filter(isVisible).map(toPublic);

// ---------- 조회 도우미 ----------
export function byKind(items, kind) {
  return items.filter(i => i.kind === kind).sort((a, b) => (a.sort || 0) - (b.sort || 0));
}
// 기간 항목은 최신순
export function byKindRecent(items, kind) {
  const key = i => i.data.endDate || i.data.date || '9999-99';
  return items.filter(i => i.kind === kind).sort((a, b) => {
    const ea = a.data.endDate === '' || a.data.endDate == null ? (a.data.date || '9999-12') : a.data.endDate;
    const eb = b.data.endDate === '' || b.data.endDate == null ? (b.data.date || '9999-12') : b.data.endDate;
    return (eb || '').localeCompare(ea || '') || (b.data.startDate || '').localeCompare(a.data.startDate || '') || key(b).localeCompare(key(a));
  });
}
export const profileOf = items => items.find(i => i.kind === 'profile') || { kind: 'profile', data: {} };

// ---------- 요약 카드 (6장 계산 규칙) ----------
// includeSamples: 스킬 막대(F-8.6)는 예시 프로젝트도 세고(예시 배지와 함께 보임), 요약 카드(F-7.9)는 빼고 센다
export function toolUsage(items, includeSamples = false) {
  const counts = new Map();
  items.filter(i => i.kind === 'project' && isVisible(i) && (includeSamples || !i.isSample))
    .forEach(p => (p.data.tools || []).forEach(t => counts.set(t, (counts.get(t) || 0) + 1)));
  return counts;
}

function unionMonths(ranges) {
  const iv = ranges.filter(r => r.s).map(r => [monthIndex(r.s), monthIndex(r.e || todayMonth())]).sort((a, b) => a[0] - b[0]);
  let total = 0, cur = null;
  for (const [s, e] of iv) {
    if (!cur) cur = [s, e];
    else if (s <= cur[1] + 1) cur[1] = Math.max(cur[1], e);
    else { total += cur[1] - cur[0] + 1; cur = [s, e]; }
  }
  if (cur) total += cur[1] - cur[0] + 1;
  return total;
}

export function summaryCards(items) {
  const real = items.filter(i => isVisible(i) && !i.isSample);
  const of = k => real.filter(i => i.kind === k);
  const cards = [];

  const edu = byKindRecent(of('education'), 'education')[0];
  if (edu) {
    const d = edu.data;
    const grad = d.endDate ? `${fmtMonth(d.endDate)} ${d.status === '졸업' ? '졸업' : d.status === '재학' ? '졸업 예정' : '졸업 예정'}` : d.status || '';
    const gpa = d.gpaPublic && d.gpa ? ` · 학점 ${d.gpa}/${d.gpaMax || 4.5}` : '';
    cards.push({ id: 'education', label: '학력', value: `${d.school || ''} ${d.major || ''}`.trim(), sub: grad + gpa, target: 'sec-education' });
  }
  const exp = of('experience');
  if (exp.length) {
    const m = unionMonths(exp.map(e => ({ s: e.data.startDate, e: e.data.endDate })));
    cards.push({ id: 'experience', label: '경력', value: `${exp.length}건`, sub: `총 ${m}개월`, target: 'sec-experience' });
  }
  const act = of('activity');
  if (act.length) {
    const h = act.reduce((s, a) => s + (Number(a.data.hours) || 0), 0);
    cards.push({ id: 'activity', label: '활동', value: `${act.length}건`, sub: h ? `총 ${h}시간` : '', target: 'sec-activities' });
  }
  const aw = byKindRecent(of('award'), 'award');
  if (aw.length) cards.push({ id: 'award', label: '수상', value: `${aw.length}건`, sub: `최근: ${KINDS.award.title(aw[0].data)}`, target: 'sec-awards' });

  const certs = of('certificate');
  const langs = byKindRecent(of('language'), 'language').filter(l => l.data.scorePublic && l.data.score);
  if (certs.length || langs.length) {
    const got = certs.filter(c => c.data.status !== '예정').length;
    const plan = certs.length - got;
    const parts = [];
    if (got) parts.push(`자격 ${got}`);
    if (plan) parts.push(`예정 ${plan}`);
    const lang = langs[0] ? `${langs[0].data.test} ${langs[0].data.score}` : '';
    cards.push({ id: 'certificate', label: '자격·어학', value: parts.join(' · ') || lang, sub: parts.length ? lang : '', target: 'sec-certificates' });
  }
  const tools = of('tool');
  if (tools.length) {
    const usage = toolUsage(items);
    const top = [...tools].sort((a, b) => (usage.get(b.data.name) || 0) - (usage.get(a.data.name) || 0)).slice(0, 3).map(t => t.data.name);
    cards.push({ id: 'tool', label: '스킬', value: `${tools.length}개`, sub: top.join(', '), target: 'sec-tools' });
  }
  return cards;
}

// ---------- 직무별 역량 순서 (7장) ----------
export function competencyOrder(competencies, primaryRoles) {
  const roles = (primaryRoles || []).slice(0, 2);
  const score = c => Math.max(0, ...roles.map(r => (c.data.roles || {})[r] === 'core' ? 2 : (c.data.roles || {})[r] === 'related' ? 1 : 0));
  return [...competencies].sort((a, b) => score(b) - score(a) || (a.sort || 0) - (b.sort || 0));
}

// 주 직무의 핵심 역량인데 공개 프로젝트가 없는 것
export function missingCore(items) {
  const prof = profileOf(items).data;
  const roles = prof.primaryRoles || [];
  const projects = items.filter(i => i.kind === 'project' && isVisible(i) && !i.isSample);
  const out = [];
  byKind(items, 'competency').forEach(c => {
    const coreFor = roles.filter(r => (c.data.roles || {})[r] === 'core');
    if (!coreFor.length) return;
    const has = projects.some(p => p.data.primarySkill === c.data.cid || (p.data.skills || []).includes(c.data.cid));
    if (!has) out.push({ competency: c.data.name, roles: coreFor.map(r => ROLES.find(x => x.id === r)?.name) });
  });
  return out;
}

// ---------- 검증 (F-6.10, F-7.11) ----------
// missing: 아직 채우지 않은 칸(저장은 되고, 공개 항목이면 초안으로 둘지 묻는다)
// errors: 저장 자체를 막는 문제(주소용 이름 형식·중복, 대표 4개 이상)
export function validate(item, allItems) {
  const missing = [], errors = [];
  const def = KINDS[item.kind];
  if (def) def.fields.forEach(f => {
    if (!f.required) return;
    const v = f.path ? get(item.data, f.path) : item.data[f.key];
    if (v == null || v === '' || (Array.isArray(v) && !v.length)) missing.push(f.label);
  });
  if (item.kind === 'project') {
    const d = item.data;
    if (!(d.metrics || []).length && !d.outcome) missing.push('결과(정량 또는 정성 성과)');
    if (d.featured) {
      if (!(d.evidence || []).length) missing.push('증빙(대표 프로젝트는 1개 이상)');
      const others = allItems.filter(i => i.kind === 'project' && i.id !== item.id && i.data.featured);
      if (others.length >= 3) errors.push('대표 프로젝트는 최대 3개입니다. 다른 대표를 먼저 해제하세요.');
    }
    if (d.slug && !/^[a-z0-9-]+$/.test(d.slug)) errors.push('주소용 이름은 영문 소문자·숫자·하이픈만 쓸 수 있습니다.');
    if (d.slug && allItems.some(i => i.kind === 'project' && i.id !== item.id && i.data.slug === d.slug)) errors.push('같은 주소용 이름을 쓰는 프로젝트가 있습니다.');
  }
  if (item.kind === 'profile') {
    if (!item.data.name) missing.push('이름');
    if (!item.data.contacts?.email) missing.push('이메일');
  }
  return { missing, errors };
}

const PII = [
  { re: /01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/, label: '휴대전화 번호' },
  { re: /\d{6}[-\s]?[1-4]\d{6}/, label: '주민등록번호' },
  { re: /학번\s*[:：]?\s*\d{6,10}/, label: '학번' },
  { re: /(생년월일|생일)\s*[:：]?\s*\d/, label: '생년월일' },
];
export function piiWarnings(item) {
  const text = JSON.stringify(item.data);
  return PII.filter(p => p.re.test(text)).map(p => p.label);
}

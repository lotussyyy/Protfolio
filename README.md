# 문헌정보학과 졸업예정자 취업 포트폴리오

노션 페이지처럼 위에서 아래로 읽는 한 페이지 포트폴리오입니다. 자기소개, 이력 데이터로 계산하는 요약 카드, 역량별 프로젝트 목록, 대표 프로젝트 3개, 프로젝트 상세(역할·과정·결과·증빙)를 보여 주고, 관리 화면에서 어느 기기에서나 내용을 추가·수정·삭제할 수 있습니다.

- 공개 화면: `index.html`
- 관리 화면: `admin.html` (편집 / 공개 미리보기 / 방문 통계 / 백업)
- 기준 문서: 「문헌정보학과 졸업예정자 포트폴리오 사이트 PRD」

Supabase를 연결하기 전에는 **데모 모드**로 동작합니다. 예시 데이터(가상 인물, 모두 ‘예시’ 배지)를 보여 주고, 관리 화면에서 고친 내용은 그 브라우저에만 저장됩니다.

---

## 1. GitHub Pages 켜기 (5분)

1. 저장소 **Settings → Pages**
2. **Source: Deploy from a branch**, **Branch: `main` / `(root)`** → Save
3. 1~2분 뒤 같은 화면 위쪽에 나오는 주소가 포트폴리오 주소입니다. 관리 화면은 그 주소 뒤에 `admin.html`을 붙입니다.

이 단계까지만 하면 데모 모드로 바로 볼 수 있습니다.

## 2. 컴퓨터에서 미리 보기 (선택)

자바스크립트 모듈을 쓰기 때문에 파일을 더블클릭하면 열리지 않습니다. 저장소 폴더에서:

```bash
python3 -m http.server 8000
# 브라우저에서 http://localhost:8000
```

## 3. Supabase 연결 (여러 기기에서 편집하려면 필요, 20분)

1. [supabase.com](https://supabase.com)에서 무료 계정 → **New project** (Region은 Seoul 권장). 비밀번호는 따로 보관합니다.
2. 왼쪽 **SQL Editor** → `supabase/schema.sql` 내용을 전부 붙여 넣고 **Run**.
3. **Authentication → Users → Add user**로 본인 이메일·비밀번호 계정을 만듭니다(Auto confirm 체크).
4. **Authentication → Sign In / Providers**에서 **Allow new users to sign up**을 끕니다. (다른 사람이 계정을 만들지 못하게)
5. SQL Editor에서 소유자를 등록합니다(이메일만 바꿔서 실행):
   ```sql
   insert into public.site_owner (id)
   select id from auth.users where email = '본인@이메일.com';
   ```
6. **Authentication → URL Configuration**의 Site URL에 1단계의 포트폴리오 주소를 넣습니다(비밀번호 재설정 메일용).
7. **Project Settings → API Keys**에서 **Publishable key**(`sb_publishable_…`)를, **Project Settings → Data API**(또는 프로젝트 홈의 Connect)에서 **Project URL**을 복사해 `js/config.js`에 넣고 커밋합니다. 예전 프로젝트라면 Publishable key 대신 **anon public key**(`eyJ…`)를 써도 됩니다.
   ```js
   supabaseUrl: 'https://xxxx.supabase.co',
   supabaseAnonKey: 'sb_publishable_...',
   ```
   이 키는 공개용이라 저장소에 올려도 됩니다. **Secret key(`sb_secret_…`)나 service_role 키는 절대 넣지 마세요.**
8. `admin.html`에 로그인 → **백업·설정 → 백업 불러오기**에서 `data/sample-full.json`을 고르면 역량 7개와 예시 데이터로 시작합니다. 예시를 실제 내용으로 고친 뒤 각 항목에서 **예시 해제**를 누르세요. (데모 모드에서 이미 고친 내용이 있으면, 데모에서 받은 JSON 백업을 대신 불러오면 됩니다.)

> 메뉴 이름은 Supabase 화면 개편에 따라 조금 다를 수 있습니다.
> Supabase 보안 점검(Advisors)이 `public_items` 뷰를 ‘security definer view’로 표시할 수 있습니다. 공개 항목만 골라 보여 주려고 의도한 설정입니다.

## 4. 매일 자동 스냅샷 (무료 요금제 일시정지 대비)

Supabase 무료 프로젝트는 일주일 동안 사용이 적으면 일시정지됩니다. 매일 한 번 공개 데이터를 읽어 `data/portfolio.json`에 저장하는 작업이 들어 있어, 접속을 유지하고 DB에 접속하지 못할 때 방문자에게 보여 줄 대체 데이터를 만듭니다.

1. 저장소 **Settings → Secrets and variables → Actions → New repository secret**
   - `SUPABASE_URL`: 3-7단계의 Project URL
   - `SUPABASE_ANON_KEY`: 3-7단계의 Publishable key(또는 anon key)
2. **Actions** 탭 → ‘공개 스냅샷 저장’ → **Run workflow**로 한 번 실행해 성공하는지 확인합니다.

이후 매일 한국 시간 새벽 4시에 실행됩니다. 실패하면 GitHub가 메일로 알려 줍니다. 프로젝트가 일시정지되었다면 Supabase 대시보드에서 **Restore**를 누르세요.

## 5. 운영 습관

- **한 달에 한 번, 그리고 크게 고친 날**: 관리 화면 → 백업·설정 → 전체 백업 받기. 비공개 항목과 취업 메모가 들어 있으니 개인 클라우드에만 보관하고 **이 저장소에는 올리지 마세요.** 무료 요금제에는 자동 백업이 없습니다.
- **공용 PC**에서 편집했다면 로그아웃 → ‘모든 기기에서’.
- **지원서에 넣을 링크**는 관리 화면 → 방문 통계 → 지원처별 링크 만들기에서 만듭니다(`?ref=기관&role=academic`). 그 링크로 들어온 방문만 따로 집계되고, role을 붙이면 그 직무 기준으로 역량 순서를 보여 줍니다.

## 6. 출시 전 점검

- [ ] 시크릿 창에서 공개 사이트를 열어 비공개 프로젝트·취업 메모·비공개 증빙이 보이지 않는다
- [ ] 아래 명령의 결과가 `[]`이다(로그인 없이 원본 표를 읽을 수 없음)
  ```bash
  curl "https://xxxx.supabase.co/rest/v1/items?select=*" -H "apikey: 공개키"
  curl "https://xxxx.supabase.co/rest/v1/career_notes?select=*" -H "apikey: 공개키"
  ```
- [ ] 노트북에서 저장한 내용이 휴대폰 관리 화면에서 보인다
- [ ] 관리 화면 상단에 ‘예시 데이터 n건이 공개 중’ 알림이 없다
- [ ] 휴대폰(360px)에서 가로 스크롤 없이 읽힌다

## 파일 구조

```
index.html            공개 화면
admin.html            관리 화면
css/style.css         공통 스타일(강조색 없음, 노션형)
css/admin.css         관리 화면 스타일
js/config.js          Supabase 연결 정보 (비우면 데모 모드)
js/model.js           항목 정의, 공개 범위, 요약 카드·역량 순서 계산, 검증
js/api.js             데이터 읽기·쓰기(Supabase/데모), 업로드, 통계
js/render.js          공개 화면 그리기(관리 화면 미리보기와 공용)
js/public.js          공개 화면 시작
js/admin.js           관리 화면
data/portfolio.json   공개 스냅샷(매일 자동 갱신, 데모 모드 공개 데이터)
data/sample-full.json 예시 데이터 전체(비공개 예시·취업 메모 포함, 모두 가상)
supabase/schema.sql   표·공개 뷰·권한·파일 버킷
scripts/snapshot.mjs  스냅샷 스크립트
.github/workflows/    매일 스냅샷 실행
```

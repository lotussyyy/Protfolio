// Supabase 연결 정보 (README의 '3. Supabase 연결' 참고)
// 두 값이 비어 있으면 '데모 모드'로 동작한다: 예시 데이터를 쓰고, 관리 화면의 편집 내용은 이 브라우저에만 저장된다.
// anon key는 공개용 키라 이 파일에 넣어도 된다. service_role 키는 절대 넣지 말 것.
export const CONFIG = {
  supabaseUrl: '',        // 예: 'https://abcdefgh.supabase.co'
  supabaseAnonKey: '',    // 예: 'eyJhbGciOi...'
  snapshotPath: 'data/portfolio.json',
  demoSeedPath: 'data/sample-full.json',
};

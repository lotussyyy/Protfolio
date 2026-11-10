-- 서평(book) 항목을 저장할 수 있게 kind 목록에 'book'을 추가합니다.
-- Supabase → SQL Editor에 붙여 넣고 Run 한 번이면 됩니다(여러 번 실행해도 안전).
alter table public.items drop constraint if exists items_kind_check;
alter table public.items add constraint items_kind_check
  check (kind in ('profile','education','experience','activity','award','certificate','language','tool','project','competency','book'));

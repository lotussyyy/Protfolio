-- 문헌정보학 포트폴리오: Supabase 스키마 (PRD 6장·F-7.6·F-9)
-- Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여 넣고 Run.
-- 실행 뒤 README의 '소유자 등록' SQL을 한 번 더 실행해야 편집할 수 있다.

-- 1) 소유자: 이 표에 등록된 계정만 쓰기·비공개 읽기 가능
create table if not exists public.site_owner (id uuid primary key references auth.users(id) on delete cascade);
alter table public.site_owner enable row level security;
-- (정책 없음 = API로는 아무도 읽거나 쓰지 못함. SQL Editor에서만 등록)

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.site_owner where id = auth.uid()) $$;

-- 2) 모든 콘텐츠: 프로필·이력·역량·프로젝트를 한 표에 (kind로 구분)
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('profile','education','experience','activity','award','certificate','language','tool','project','competency','book')),
  data jsonb not null default '{}'::jsonb,
  visibility text not null default 'private' check (visibility in ('public','private')),
  status text not null default 'published' check (status in ('published','draft')),
  is_sample boolean not null default false,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists items_touch on public.items;
create trigger items_touch before update on public.items for each row execute function public.touch_updated_at();

alter table public.items enable row level security;
drop policy if exists items_owner_all on public.items;
create policy items_owner_all on public.items for all to authenticated using (public.is_owner()) with check (public.is_owner());
-- 익명 방문자에게는 items 표 자체를 열지 않는다. 아래 public_items 뷰로만 공개 항목을 읽는다.

-- 3) 취업 메모: 항상 비공개, 소유자만
create table if not exists public.career_notes (
  item_id uuid primary key references public.items(id) on delete cascade,
  note text not null,
  updated_at timestamptz not null default now()
);
alter table public.career_notes enable row level security;
drop policy if exists notes_owner_all on public.career_notes;
create policy notes_owner_all on public.career_notes for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- 4) 공개 뷰: 공개·완성 항목만, 비공개 증빙·비공개 학점·점수·링크를 뺀 모양 (js/model.js toPublic 과 같은 규칙)
-- 뷰 소유자 권한으로 실행되므로(security_invoker = false) 익명 방문자는 이 뷰만 읽을 수 있다.
create or replace view public.public_items with (security_invoker = false) as
select
  id, kind, 'public'::text as visibility, 'published'::text as status, is_sample, sort, updated_at,
  case kind
    when 'project' then jsonb_set(data, '{evidence}', coalesce(
      (select jsonb_agg(e) from jsonb_array_elements(coalesce(data->'evidence', '[]'::jsonb)) e
        where coalesce((e->>'public')::boolean, false)), '[]'::jsonb))
    when 'education' then case when coalesce((data->>'gpaPublic')::boolean, false) then data else data - 'gpa' - 'gpaMax' end
    when 'language' then case when coalesce((data->>'scorePublic')::boolean, false) then data else data - 'score' end
    when 'profile' then (
      case when data ? 'contacts' then jsonb_set(data, '{contacts,links}', coalesce(
        (select jsonb_agg(l) from jsonb_array_elements(coalesce(data#>'{contacts,links}', '[]'::jsonb)) l
          where coalesce((l->>'public')::boolean, true)), '[]'::jsonb)) else data end
      ) - (case when coalesce((data->>'resumePublic')::boolean, true) then '' else 'resumeFile' end)
    else data
  end as data
from public.items
where visibility = 'public' and status = 'published';

revoke all on public.public_items from anon, authenticated;
grant select on public.public_items to anon, authenticated;

-- 5) 방문 통계: 방문자는 쓰기만, 읽기는 소유자만. IP·쿠키·기기 식별값은 저장하지 않는다.
create table if not exists public.events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  type text not null check (type in ('view','project','evidence','resume')),
  target text not null default '' check (char_length(target) <= 120),
  referrer text not null default '' check (char_length(referrer) <= 120),
  ref text not null default '' check (char_length(ref) <= 60),
  device text not null default 'desktop' check (device in ('mobile','desktop')),
  session text not null default '' check (char_length(session) <= 40)
);
create index if not exists events_created_idx on public.events (created_at);
alter table public.events enable row level security;
drop policy if exists events_insert_anyone on public.events;
create policy events_insert_anyone on public.events for insert to anon, authenticated with check (true);
drop policy if exists events_owner_read on public.events;
create policy events_owner_read on public.events for select to authenticated using (public.is_owner());
drop policy if exists events_owner_delete on public.events;
create policy events_owner_delete on public.events for delete to authenticated using (public.is_owner());

-- 6) API 권한: 'Automatically expose new tables'를 끄고 만든 프로젝트에서도 동작하도록 직접 부여
--    (실제로 누가 무엇을 읽고 쓰는지는 위의 RLS 정책이 정한다)
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.items, public.career_notes to authenticated;
grant insert on public.events to anon, authenticated;
grant select, delete on public.events to authenticated;
grant execute on function public.is_owner() to anon, authenticated;

-- 7) 증빙 파일 버킷: 공개(누구나 읽기) / 비공개(소유자만)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('evidence-public', 'evidence-public', true, 10485760, array['application/pdf','image/jpeg','image/png','image/webp']),
  ('evidence-private', 'evidence-private', false, 10485760, array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists evidence_owner_write on storage.objects;
create policy evidence_owner_write on storage.objects for all to authenticated
  using (bucket_id in ('evidence-public','evidence-private') and public.is_owner())
  with check (bucket_id in ('evidence-public','evidence-private') and public.is_owner());

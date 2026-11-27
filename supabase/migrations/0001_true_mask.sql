-- =====================================================================
-- 트루 마스크 (True Mask) — Supabase 스키마
--
-- Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여넣고 Run 하세요.
-- 여러 번 실행해도 안전합니다 (질문 목록과 함수가 최신으로 갱신됨).
--
-- 보안 설계
--  * 게임 데이터(방, 참가자, 투표)는 API로 노출되지 않는 `truemask` 스키마에 있다.
--    앱(공개키)은 이 테이블을 직접 읽거나 쓸 수 없다.
--  * 앱은 public.tm_* 함수(RPC)만 호출할 수 있고, 함수는 집계 숫자만 돌려준다.
--  * 개별 투표(truemask.votes)는 결과 공개 즉시 삭제된다.
--  * 실시간 갱신은 public.tm_room_signals 의 version 숫자만 Realtime 으로 흘려보낸다.
-- =====================================================================

create schema if not exists truemask;
revoke all on schema truemask from public;

-- ---------------------------------------------------------------------
-- 테이블
-- ---------------------------------------------------------------------

create table if not exists truemask.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  mode text not null check (mode in ('mixed', 'male', 'female')),
  question_count int not null check (question_count between 5 and 8),
  premium boolean not null default false,
  phase text not null default 'lobby' check (phase in ('lobby', 'voting', 'reveal', 'finished')),
  questions text[] not null default '{}',
  question_index int not null default 0,
  host_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists truemask.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references truemask.rooms (id) on delete cascade,
  secret uuid not null default gen_random_uuid(), -- 이 참가자 본인만 아는 토큰
  nickname text not null,
  gender text not null check (gender in ('M', 'F')),
  joined_at timestamptz not null default clock_timestamp(),
  last_seen timestamptz not null default now(),
  is_voter boolean not null default false, -- 이번 질문에 투표해야 하는 사람
  unique (room_id, nickname)
);
create index if not exists players_room_idx on truemask.players (room_id);
-- 평생권을 가진 사람이 있는 방에서 성별 공개를 쓸지. 평생권을 가진 사람이 켜고 끌 수 있다 (1회권은 끌 수 없음).
alter table truemask.rooms add column if not exists lifetime_on boolean not null default true;
-- 평생권(성별 공개 영구 해제)을 가진 참가자. 이 사람이 있는 혼성 게임은 자동으로 성별 공개가 켜진다.
alter table truemask.players add column if not exists lifetime boolean not null default false;
-- 게임이 끝난 뒤 방장이 광고를 보고 골라서 성별 인원을 공개한 질문 번호 (판마다 1개)
alter table truemask.rooms add column if not exists picks int[] not null default '{}';
-- 이번 판에 방장이 광고를 보고 질문 하나를 고를 기회를 받았는지 (판마다 1번)
alter table truemask.rooms add column if not exists ad_pick boolean not null default false;

-- 개별 투표. 결과 공개 순간 삭제되며, 어떤 API 로도 조회할 수 없다.
create table if not exists truemask.votes (
  player_id uuid primary key references truemask.players (id) on delete cascade,
  room_id uuid not null references truemask.rooms (id) on delete cascade,
  yes boolean not null
);

-- 공개된 결과 (집계 숫자만)
create table if not exists truemask.results (
  room_id uuid not null references truemask.rooms (id) on delete cascade,
  idx int not null,
  question text not null,
  yes int not null,
  total int not null,
  male_yes int,
  female_yes int,
  gender_hidden boolean not null default false,
  primary key (room_id, idx)
);

-- 질문 목록. 대시보드 Table Editor 에서 추가/수정/비활성화 가능 (앱 재배포 불필요)
create table if not exists truemask.questions (
  id serial primary key,
  mode text not null check (mode in ('common', 'mixed', 'male', 'female')),
  body text not null,
  enabled boolean not null default true,
  unique (mode, body)
);

-- 같은 IP에서 짧은 시간에 너무 많이 방을 만들거나 입장 시도하는 것을 막기 위한 기록 (1시간 뒤 삭제)
create table if not exists truemask.rate_events (
  ip text not null,
  action text not null,
  at timestamptz not null default now()
);
create index if not exists rate_events_idx on truemask.rate_events (ip, action, at);

create table if not exists truemask.config (
  key text primary key,
  value text not null
);
-- 출시 전에는 'false' 로 바꾸고 실제 결제 검증(Edge Function)을 붙이세요.
insert into truemask.config values ('allow_mock_premium', 'true') on conflict do nothing;

-- 한 번 쓴 1회권 결제 영수증. 같은 영수증으로 여러 방을 여는 것을 막는다 (방이 지워져도 남김).
create table if not exists truemask.premium_receipts (
  receipt text primary key,
  room_id uuid,
  used_at timestamptz not null default now()
);

-- 앱이 Realtime 으로 구독하는 유일한 테이블. 방 id 와 버전 숫자만 있다.
create table if not exists public.tm_room_signals (
  room_id uuid primary key references truemask.rooms (id) on delete cascade,
  version bigint not null default 0
);

-- ---------------------------------------------------------------------
-- 권한: truemask 스키마는 완전히 잠그고, 신호 테이블은 읽기만 허용
-- ---------------------------------------------------------------------

alter table truemask.rooms enable row level security;
alter table truemask.players enable row level security;
alter table truemask.votes enable row level security;
alter table truemask.results enable row level security;
alter table truemask.questions enable row level security;
alter table truemask.config enable row level security;
alter table truemask.rate_events enable row level security;
alter table truemask.premium_receipts enable row level security;
alter table public.tm_room_signals enable row level security;

revoke all on all tables in schema truemask from public, anon, authenticated;
revoke all on public.tm_room_signals from public, anon, authenticated;
grant select on public.tm_room_signals to anon, authenticated;

drop policy if exists "signals are readable" on public.tm_room_signals;
create policy "signals are readable" on public.tm_room_signals
  for select to anon, authenticated using (true);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tm_room_signals'
     ) then
    alter publication supabase_realtime add table public.tm_room_signals;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 질문 데이터
-- ---------------------------------------------------------------------

insert into truemask.questions (mode, body) values
  ('common', '나는 이 방에 좋아하는 사람이 있다.'),
  ('common', '나는 이 방에 있는 누군가에게 서운했던 적이 있다.'),
  ('common', '나는 이 방의 누군가에게 말 못 한 비밀이 있다.'),
  ('common', '나는 이 방의 누군가를 질투해 본 적이 있다.'),
  ('common', '나는 이 모임에 나오기 싫었던 날이 있다.'),
  ('common', '나는 이 방의 누군가에 대해 뒷담화를 해본 적이 있다.'),
  ('common', '나는 이 방에서 가장 친하다고 생각하는 사람이 정해져 있다.'),
  ('common', '나는 이 방의 누군가에게 고백받고 싶다.'),
  ('common', '나는 이 방의 누군가와 연락을 일부러 피한 적이 있다.'),
  ('common', '나는 이 방의 누군가에게 돈을 빌려주고 아직 못 받았다.'),
  ('mixed', '나는 이 방의 이성 중 누군가를 이성으로 느낀 적이 있다.'),
  ('mixed', '나는 이 방의 누군가와 사귀어도 괜찮다고 생각한다.'),
  ('mixed', '나는 이 방의 누군가와 단둘이 만나고 싶다.'),
  ('mixed', '나는 이 방의 누군가에게 설렌 적이 있다.'),
  ('mixed', '나는 이 방에 내 이상형에 가까운 사람이 있다.'),
  ('mixed', '나는 이 방의 누군가의 연애를 몰래 응원하고 있다.'),
  ('mixed', '나는 이 방의 누군가의 SNS를 몰래 자주 본다.'),
  ('male', '나는 이 방의 누군가에게 연애 상담을 받아본 적이 있다.'),
  ('male', '나는 이 방의 누군가보다 내가 더 잘생겼다고 생각한다.'),
  ('male', '나는 이 방의 누군가의 여자친구(전 여자친구 포함)를 좋게 본 적이 있다.'),
  ('male', '나는 이 방의 누군가에게 지는 게 제일 싫다.'),
  ('male', '나는 요즘 몰래 연락하는 사람이 있다.'),
  ('male', '나는 이 방의 누군가에게 고마운데 한 번도 말한 적 없다.'),
  ('male', '나는 이 방의 누군가와 진지하게 싸울 뻔한 적이 있다.'),
  ('female', '나는 이 방의 누군가에게 연애 상담을 받아본 적이 있다.'),
  ('female', '나는 이 방의 누군가의 남자친구(전 남자친구 포함)를 좋게 본 적이 있다.'),
  ('female', '나는 이 방의 누군가의 스타일을 따라 해본 적이 있다.'),
  ('female', '나는 이 방의 누군가에게 말 못 한 속상함이 있다.'),
  ('female', '나는 요즘 몰래 연락하는 사람이 있다.'),
  ('female', '나는 이 방의 누군가에게 고마운데 한 번도 말한 적 없다.'),
  ('female', '나는 이 방의 누군가와 단톡방 말고 따로 뒷얘기를 한 적이 있다.')
on conflict (mode, body) do nothing;

-- =====================================================================
-- 내부 함수 (truemask 스키마 — 앱에서 직접 호출 불가)
-- =====================================================================

-- 앱은 화면을 만지지 않아도 8초마다 자동으로 신호(하트비트)를 보낸다.
-- 이 시간 안에 신호가 있었으면 접속 중으로 본다
create or replace function truemask.online_since() returns timestamptz
language sql stable set search_path = truemask, pg_temp
as $$ select now() - interval '20 seconds' $$;

-- 이 시간 넘게 신호가 없으면(인터넷 끊김, 앱 종료) 방에서 내보낸다.
-- 방장이었다면 남은 사람에게 방장이 넘어간다.
create or replace function truemask.gone_before() returns timestamptz
language sql stable set search_path = truemask, pg_temp
as $$ select now() - interval '30 seconds' $$;

create or replace function truemask.fail(msg text) returns void
language plpgsql set search_path = truemask, pg_temp
as $$ begin raise exception using message = msg, errcode = 'P0001'; end $$;

create or replace function truemask.bump(p_room uuid) returns void
language sql set search_path = truemask, pg_temp
as $$ update public.tm_room_signals set version = version + 1 where room_id = p_room $$;

-- 요청한 사람의 IP (Supabase API 를 거친 요청에만 있음)
create or replace function truemask.client_ip() returns text
language plpgsql stable set search_path = truemask, pg_temp
as $$
declare h json;
begin
  h := nullif(current_setting('request.headers', true), '')::json;
  return nullif(btrim(coalesce(
    h ->> 'cf-connecting-ip',
    h ->> 'x-real-ip',
    split_part(h ->> 'x-forwarded-for', ',', 1)
  )), '');
exception when others then
  return null;
end $$;

-- 같은 IP에서 window 동안 max 번 넘게 하면 거절. 허용되면 기록을 남긴다.
create or replace function truemask.rate_limited(p_action text, p_max int, p_window interval) returns boolean
language plpgsql set search_path = truemask, pg_temp
as $$
declare v_ip text := client_ip();
begin
  if v_ip is null then return false; end if;
  if (select count(*) from rate_events e where e.ip = v_ip
        and e.action = p_action and e.at > now() - p_window) >= p_max then
    return true;
  end if;
  insert into rate_events (ip, action) values (v_ip, p_action);
  return false;
end $$;

-- 버려진 방(10분 넘게 아무 신호 없음)과 오래된 기록 정리
create or replace function truemask.sweep() returns void
language sql set search_path = truemask, pg_temp
as $$
  delete from rooms r
  where r.created_at < now() - interval '1 day'
     or not exists (select 1 from players p where p.room_id = r.id and p.last_seen > now() - interval '10 minutes');
  delete from rate_events where at < now() - interval '1 hour';
$$;

create or replace function truemask.clean_nickname(n text) returns text
language sql immutable set search_path = truemask, pg_temp
as $$
  select case when char_length(c) between 1 and 12 then c end
  from (select regexp_replace(btrim(coalesce(n, '')), '\s+', ' ', 'g') as c) t
$$;

create or replace function truemask.reset_lobby(p_room uuid) returns void
language plpgsql set search_path = truemask, pg_temp
as $$
begin
  -- 1회권은 "이번 판"에만 적용되므로 새 판을 위해 대기실로 돌아가면 꺼진다
  update rooms set phase = 'lobby', questions = '{}', question_index = 0, premium = false,
    picks = '{}', ad_pick = false where id = p_room;
  delete from votes where room_id = p_room;
  delete from results where room_id = p_room;
  update players set is_voter = false where room_id = p_room;
end $$;

create or replace function truemask.begin_question(p_room uuid) returns void
language plpgsql set search_path = truemask, pg_temp
as $$
begin
  update rooms set phase = 'voting' where id = p_room;
  delete from votes where room_id = p_room;
  -- 방에 있는 모두가 투표 대상. 연결이 끊긴 사람은 30초 뒤 방에서 나가지면서 자동으로 빠진다.
  update players set is_voter = true where room_id = p_room;
end $$;

-- 결과 공개: 집계만 저장하고 개별 투표는 삭제
create or replace function truemask.reveal(p_room uuid) returns void
language plpgsql set search_path = truemask, pg_temp
as $$
declare
  r rooms;
  c record;
  safe boolean;
begin
  select * into r from rooms where id = p_room;
  select
    count(*)::int as total,
    count(*) filter (where v.yes)::int as yes,
    count(*) filter (where p.gender = 'M')::int as n_m,
    count(*) filter (where p.gender = 'M' and v.yes)::int as y_m,
    count(*) filter (where p.gender = 'F')::int as n_f,
    count(*) filter (where p.gender = 'F' and v.yes)::int as y_f
  into c
  from votes v join players p on p.id = v.player_id
  where v.room_id = p_room;

  -- 한 성별 투표자가 1명뿐이면 성별 내역이 그 사람 답을 드러내므로 숨긴다.
  -- 성별 인원은 혼성이면 결제와 상관없이 저장해 두고, 앱에 보낼 때(state) 결제 여부로 가린다.
  -- 그래야 게임 중간에 결제해도 지나간 질문의 성별 인원까지 볼 수 있다.
  safe := (c.n_m = 0 or c.n_m >= 2) and (c.n_f = 0 or c.n_f >= 2);

  insert into results (room_id, idx, question, yes, total, male_yes, female_yes, gender_hidden)
  values (
    p_room, r.question_index, r.questions[r.question_index + 1], c.yes, c.total,
    case when r.mode = 'mixed' and safe then c.y_m end,
    case when r.mode = 'mixed' and safe then c.y_f end,
    r.mode = 'mixed' and not safe
  )
  on conflict (room_id, idx) do update set
    question = excluded.question, yes = excluded.yes, total = excluded.total,
    male_yes = excluded.male_yes, female_yes = excluded.female_yes, gender_hidden = excluded.gender_hidden;

  delete from votes where room_id = p_room;
  update players set is_voter = false where room_id = p_room;
  update rooms set phase = 'reveal' where id = p_room;
end $$;

create or replace function truemask.maybe_reveal(p_room uuid) returns void
language plpgsql set search_path = truemask, pg_temp
as $$
declare
  n_voters int;
  n_voted int;
begin
  if (select phase from rooms where id = p_room) <> 'voting' then return; end if;
  select count(*) into n_voters from players where room_id = p_room and is_voter;
  select count(*) into n_voted from votes v join players p on p.id = v.player_id
    where v.room_id = p_room and p.is_voter;
  if n_voters > 0 and n_voted >= n_voters then
    perform reveal(p_room);
  end if;
end $$;

-- 참가자가 빠진 뒤 정리: 방장 넘기기, 인원 부족 시 대기실, 남은 사람으로 자동 공개
create or replace function truemask.after_removal(p_room uuid) returns void
language plpgsql set search_path = truemask, pg_temp
as $$
declare
  r rooms;
  n int;
begin
  select * into r from rooms where id = p_room;
  if not found then return; end if;
  select count(*) into n from players where room_id = p_room;
  if n = 0 then
    delete from rooms where id = p_room;
    return;
  end if;
  if not exists (select 1 from players where id = r.host_id) then
    update rooms set host_id = (
      select id from players where room_id = p_room
      order by (last_seen > online_since()) desc, joined_at
      limit 1
    ) where id = p_room;
  end if;
  if r.phase in ('voting', 'reveal') and n < 3 then
    perform reset_lobby(p_room);
  elsif r.phase = 'voting' then
    perform maybe_reveal(p_room);
  end if;
end $$;

-- 오래 연결이 끊긴 참가자 정리
create or replace function truemask.cleanup(p_room uuid) returns void
language plpgsql set search_path = truemask, pg_temp
as $$
declare
  removed int;
begin
  delete from players where room_id = p_room and last_seen < gone_before();
  get diagnostics removed = row_count;
  if removed > 0 then
    perform after_removal(p_room);
    perform bump(p_room);
  end if;
end $$;

-- 호출자 확인 + 방 잠금 + 하트비트 + 정리. 모든 공개 함수의 입구.
create or replace function truemask.enter(p_player uuid, p_secret uuid) returns truemask.players
language plpgsql set search_path = truemask, pg_temp
as $$
declare
  p players;
  room uuid;
  was_offline boolean;
begin
  select room_id into room from players where id = p_player and secret = p_secret;
  if room is null then
    raise exception using message = '연결이 끊겨서 방에서 나가졌어요.', errcode = 'P0001', hint = 'gone';
  end if;
  perform 1 from rooms where id = room for update; -- 같은 방 요청은 한 번에 하나씩
  select * into p from players where id = p_player;
  if not found then
    raise exception using message = '연결이 끊겨서 방에서 나가졌어요.', errcode = 'P0001', hint = 'gone';
  end if;
  was_offline := p.last_seen <= online_since();
  update players set last_seen = now() where id = p_player;
  perform cleanup(room);
  if was_offline then perform bump(room); end if;
  return p;
end $$;

create or replace function truemask.assert_host(p truemask.players) returns truemask.rooms
language plpgsql set search_path = truemask, pg_temp
as $$
declare r rooms;
begin
  select * into r from rooms where id = p.room_id;
  if r.host_id is distinct from p.id then perform fail('방장만 할 수 있어요.'); end if;
  return r;
end $$;

-- 방에 남자나 여자가 딱 1명뿐인지. 이러면 성별 인원이 그 사람 답을 드러내므로 성별 공개를 하지 않는다.
create or replace function truemask.lonely_gender(r truemask.rooms) returns boolean
language sql stable set search_path = truemask, pg_temp
as $$
  select count(*) filter (where gender = 'M') = 1 or count(*) filter (where gender = 'F') = 1
  from players p where p.room_id = r.id
$$;

-- 방에 GOLD MASK(평생권)를 가진 사람이 있는지 (켜 뒀든 꺼 뒀든)
create or replace function truemask.has_lifetime(r truemask.rooms) returns boolean
language sql stable set search_path = truemask, pg_temp
as $$ select exists (select 1 from players p where p.room_id = r.id and p.lifetime) $$;

-- 지금 이 방 결과에 성별 인원을 보여주는지.
-- rooms.premium = 이번 판 1회권 결제됨, 또는 평생권을 가진 사람이 있고 켜 둔 경우. 혼성 게임에서만.
-- 평생권은 남자나 여자가 1명뿐인 방에서는 켜지지 않는다 (1회권은 그런 방에서 애초에 살 수 없다).
create or replace function truemask.premium_on(r truemask.rooms) returns boolean
language sql stable set search_path = truemask, pg_temp
as $$
  select r.phase <> 'lobby' and r.mode = 'mixed' and (
    r.premium or (r.lifetime_on and not lonely_gender(r) and has_lifetime(r))
  )
$$;

-- 결제 칸 상태: none(안 보임) / open(살 수 있음) / blocked(회색으로 막힘)
-- 게임 중에는 팔지 않는다: 게임이 끝난 뒤(최종 결과)에만 열린다. (평생권은 홈에서도 살 수 있다: 앱 쪽 결제)
-- 방에 GOLD MASK가 있으면 (꺼 뒀어도) 1회권은 팔지 않는다: 켜고 끄는 건 GOLD MASK 주인이 정한다.
create or replace function truemask.purchase_status(r truemask.rooms) returns text
language sql stable set search_path = truemask, pg_temp
as $$
  select case
    when r.phase <> 'finished' or r.mode <> 'mixed' or premium_on(r) or has_lifetime(r) then 'none'
    -- 한 성별이 1명뿐이면 성별 인원이 그 사람 답을 드러내므로 팔지 않는다
    when lonely_gender(r) then 'blocked'
    else 'open'
  end
$$;

-- 게임이 끝난 뒤 방장이 광고를 보고 질문을 골라 성별을 공개할 수 있는 상황인지
-- (혼성, 전체 공개가 꺼져 있고, 방에 GOLD MASK가 없을 때)
create or replace function truemask.picking(r truemask.rooms) returns boolean
language sql stable set search_path = truemask, pg_temp
as $$ select r.phase = 'finished' and r.mode = 'mixed' and not premium_on(r) and not has_lifetime(r) $$;

-- 지금 고를 수 있는 질문 수: 광고를 봤으면 1개 (무료는 없음)
create or replace function truemask.picks_left(r truemask.rooms) returns int
language sql stable set search_path = truemask, pg_temp
as $$ select case when picking(r) then greatest(0, r.ad_pick::int - cardinality(r.picks)) else 0 end $$;

-- 방장이 광고를 보고 질문 하나를 고를 수 있는지: 판마다 1번, 고를 수 있는 질문이 있을 때
create or replace function truemask.ad_available(r truemask.rooms) returns boolean
language sql stable set search_path = truemask, pg_temp
as $$
  select picking(r) and not r.ad_pick
    and exists (select 1 from results x where x.room_id = r.id and x.male_yes is not null and not x.idx = any(r.picks))
$$;

drop function if exists truemask.result_json(truemask.results);
drop function if exists truemask.result_json(truemask.results, boolean);
-- p_show 가 아니면 성별 인원은 절대 내보내지 않는다.
-- p_picking: 최종 결과에서 방장이 고르는 중이면, 고를 수 있는 질문(canPick)과 익명 보호로 못 고르는 질문(genderHidden)을 알려준다.
create or replace function truemask.result_json(x truemask.results, p_show boolean, p_picking boolean) returns jsonb
language sql stable set search_path = truemask, pg_temp
as $$
  select jsonb_build_object('question', x.question, 'yes', x.yes, 'total', x.total)
    || case when p_show and x.male_yes is not null
         then jsonb_build_object('genderBreakdown', jsonb_build_object('M', x.male_yes, 'F', x.female_yes))
         else '{}'::jsonb end
    || case when (p_show or p_picking) and x.gender_hidden then jsonb_build_object('genderHidden', true) else '{}'::jsonb end
    || case when p_picking and not p_show and x.male_yes is not null then jsonb_build_object('canPick', true) else '{}'::jsonb end
$$;

-- 앱으로 보내는 방 상태. 개별 투표 내용과 성별은 절대 포함하지 않는다.
create or replace function truemask.state(p_room uuid) returns jsonb
language sql stable set search_path = truemask, pg_temp
as $$
  select jsonb_build_object(
    'roomId', r.id,
    'version', (select version from public.tm_room_signals s where s.room_id = r.id),
    'code', r.code,
    'mode', r.mode,
    'questionCount', r.question_count,
    'premium', premium_on(r),
    -- 성별 공개가 어떻게 켜졌는지 (누가 샀는지는 절대 보내지 않는다)
    'premiumBy', case when premium_on(r) then case when r.premium then 'oneGame' else 'lifetime' end end,
    'lifetimeInRoom', exists (select 1 from players p where p.room_id = r.id and p.lifetime),
    'lifetimeOn', r.lifetime_on,
    'purchase', purchase_status(r),
    'picksLeft', picks_left(r),
    'adAvailable', ad_available(r),
    'phase', r.phase,
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'nickname', p.nickname,
        'isHost', p.id = r.host_id,
        'connected', p.last_seen > online_since(),
        'hasVoted', exists (select 1 from votes v where v.player_id = p.id)
      ) order by p.joined_at)
      from players p where p.room_id = r.id
    ), '[]'::jsonb),
    'questionIndex', r.question_index,
    'currentQuestion', case when r.phase = 'lobby' then null else r.questions[r.question_index + 1] end,
    'votedCount', (select count(*) from votes v where v.room_id = r.id),
    'voterCount', (select count(*) from players p where p.room_id = r.id and p.is_voter),
    'lastResult', case when r.phase in ('reveal', 'finished') then (
      select result_json(x, premium_on(r) or x.idx = any(r.picks), false)
      from results x where x.room_id = r.id and x.idx = r.question_index
    ) end,
    'history', case when r.phase = 'finished' then coalesce((
      select jsonb_agg(result_json(x, premium_on(r) or x.idx = any(r.picks), picking(r)) order by x.idx)
      from results x where x.room_id = r.id
    ), '[]'::jsonb) else '[]'::jsonb end
  )
  from rooms r where r.id = p_room
$$;

-- 내부 함수는 앱에서 호출할 수 없게 잠근다
revoke all on all functions in schema truemask from public, anon, authenticated;

-- =====================================================================
-- 공개 함수 (앱이 공개키로 호출하는 RPC)
-- =====================================================================

create or replace function public.tm_create_room(
  p_nickname text, p_gender text, p_mode text, p_question_count int
) returns jsonb
language plpgsql security definer set search_path = truemask, pg_temp
as $$
declare
  nick text := clean_nickname(p_nickname);
  chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- 헷갈리는 0/O, 1/I 제외
  new_code text;
  room_id uuid;
  p players;
begin
  if nick is null then perform fail('닉네임을 1~12자로 입력해 주세요.'); end if;
  if p_gender is null or p_gender not in ('M', 'F') then perform fail('성별을 선택해 주세요.'); end if;
  -- p_mode 는 예전 앱과의 호환용. 실제 모드는 게임을 시작할 때 참가자 성별 구성으로 정해진다 (tm_start).

  perform sweep();
  if rate_limited('create', 5, interval '10 minutes') then
    perform fail('방을 너무 자주 만들었어요. 몇 분 뒤에 다시 시도해 주세요.');
  end if;

  loop
    new_code := (
      select string_agg(substr(chars, 1 + floor(random() * length(chars))::int, 1), '')
      from generate_series(1, 5)
    );
    exit when not exists (select 1 from rooms where code = new_code);
  end loop;

  insert into rooms (code, mode, question_count)
  values (new_code, case when p_mode in ('mixed', 'male', 'female') then p_mode else 'mixed' end,
          least(8, greatest(5, coalesce(p_question_count, 5))))
  returning id into room_id;
  insert into players (room_id, nickname, gender) values (room_id, nick, p_gender) returning * into p;
  update rooms set host_id = p.id where id = room_id;
  insert into public.tm_room_signals (room_id) values (room_id);

  return jsonb_build_object('playerId', p.id, 'secret', p.secret, 'state', state(room_id));
end $$;

create or replace function public.tm_join_room(p_code text, p_nickname text, p_gender text) returns jsonb
language plpgsql security definer set search_path = truemask, pg_temp
as $$
declare
  nick text := clean_nickname(p_nickname);
  r rooms;
  p players;
begin
  if rate_limited('join', 30, interval '10 minutes') then
    perform fail('입장 시도가 너무 많아요. 몇 분 뒤에 다시 시도해 주세요.');
  end if;
  select * into r from rooms where code = upper(btrim(coalesce(p_code, ''))) for update;
  if not found then
    -- 예외로 끝내면 위의 시도 기록까지 취소되므로, 결과로 에러를 돌려준다 (코드 무작위 대입 방지)
    return jsonb_build_object('error', '그런 방 코드는 없어요.');
  end if;
  if nick is null then perform fail('닉네임을 1~12자로 입력해 주세요.'); end if;
  if p_gender is null or p_gender not in ('M', 'F') then perform fail('성별을 선택해 주세요.'); end if;

  perform cleanup(r.id);
  select * into r from rooms where id = r.id;
  if not found then perform fail('그런 방 코드는 없어요.'); end if;
  if r.phase <> 'lobby' then perform fail('이미 게임이 시작된 방이에요.'); end if;
  if (select count(*) from players where room_id = r.id) >= 12 then
    perform fail('방이 꽉 찼어요. (최대 12명)');
  end if;
  if exists (select 1 from players where room_id = r.id and nickname = nick) then
    perform fail('이미 같은 닉네임이 있어요.');
  end if;

  insert into players (room_id, nickname, gender) values (r.id, nick, p_gender) returning * into p;
  perform bump(r.id);
  return jsonb_build_object('playerId', p.id, 'secret', p.secret, 'state', state(r.id));
end $$;

-- 하트비트 겸 상태 조회. 앱이 몇 초마다, 그리고 Realtime 신호를 받을 때마다 호출.
create or replace function public.tm_sync(p_player uuid, p_secret uuid) returns jsonb
language plpgsql security definer set search_path = truemask, pg_temp
as $$
declare p players;
begin
  p := enter(p_player, p_secret);
  return state(p.room_id);
end $$;

create or replace function public.tm_leave(p_player uuid, p_secret uuid) returns void
language plpgsql security definer set search_path = truemask, pg_temp
as $$
declare p players;
begin
  p := enter(p_player, p_secret);
  delete from players where id = p.id;
  perform after_removal(p.room_id);
  perform bump(p.room_id);
end $$;

create or replace function public.tm_update_settings(
  p_player uuid, p_secret uuid, p_mode text default null, p_question_count int default null
) returns jsonb
language plpgsql security definer set search_path = truemask, pg_temp
as $$
declare
  p players := enter(p_player, p_secret);
  r rooms := assert_host(p);
begin
  if r.phase <> 'lobby' then perform fail('대기실에서만 바꿀 수 있어요.'); end if;
  if p_mode is not null and p_mode not in ('mixed', 'male', 'female') then perform fail('잘못된 모드예요.'); end if;
  update rooms set
    mode = coalesce(p_mode, mode),
    question_count = case when p_question_count is null then question_count
                          else least(8, greatest(5, p_question_count)) end
  where id = r.id;
  perform bump(r.id);
  return state(r.id);
end $$;

-- 1회권: 이번 판의 성별 공개를 켠다. 참가자 누구나 살 수 있고, 켜지면 끌 수 없다.
-- 게임이 끝난 뒤에만, 혼성이고 각 성별이 2명 이상일 때만 판다 (purchase_status).
-- TODO(출시): 인앱결제 영수증은 Edge Function 에서 검증하고 서비스 키로 premium 을 켜도록 교체
create or replace function public.tm_unlock_premium(p_player uuid, p_secret uuid, p_receipt text) returns jsonb
language plpgsql security definer set search_path = truemask, pg_temp
as $$
declare
  p players := enter(p_player, p_secret);
  r rooms;
  st text;
begin
  select * into r from rooms where id = p.room_id;
  st := purchase_status(r);
  if st = 'blocked' then perform fail('한 성별이 1명뿐이라 익명 보호를 위해 열 수 없어요.'); end if;
  if premium_on(r) then perform fail('이미 성별 공개가 켜져 있어요.'); end if;
  if st <> 'open' then perform fail('성별 공개는 게임이 끝난 뒤에 열 수 있어요.'); end if;
  if not ((select value from config where key = 'allow_mock_premium') = 'true'
          and coalesce(p_receipt, '') like 'mock-receipt:%') then
    perform fail('결제를 확인하지 못했어요.');
  end if;
  if exists (select 1 from premium_receipts where receipt = p_receipt) then
    perform fail('이미 사용한 결제예요.');
  end if;
  insert into premium_receipts (receipt, room_id) values (p_receipt, r.id);
  update rooms set premium = true where id = r.id;
  perform bump(r.id);
  return state(r.id);
end $$;

-- 평생권: 이 참가자가 평생권을 가졌다고 등록한다. 이 사람이 있는 혼성 게임은 자동으로 성별 공개 (끌 수 있음).
-- 앱은 방에 들어갈 때마다(만들기·입장·복귀) 그리고 평생권을 산 직후에 부른다.
-- TODO(출시): 영수증 대신 RevenueCat 고객 ID를 Edge Function 에서 확인하도록 교체
create or replace function public.tm_claim_lifetime(p_player uuid, p_secret uuid, p_receipt text) returns jsonb
language plpgsql security definer set search_path = truemask, pg_temp
as $$
declare
  p players := enter(p_player, p_secret);
begin
  if not ((select value from config where key = 'allow_mock_premium') = 'true' and p_receipt = 'mock-lifetime') then
    perform fail('평생권을 확인하지 못했어요.');
  end if;
  if not p.lifetime then
    update players set lifetime = true where id = p.id;
    perform bump(p.room_id);
  end if;
  return state(p.room_id);
end $$;

-- 평생권 성별 공개 켜기/끄기. 친구들이 원하지 않으면 평생권을 가진 사람이 끌 수 있다.
-- 1회권으로 켜진 판은 이것과 상관없이 계속 켜져 있다.
create or replace function public.tm_set_lifetime_on(p_player uuid, p_secret uuid, p_on boolean) returns jsonb
language plpgsql security definer set search_path = truemask, pg_temp
as $$
declare
  p players := enter(p_player, p_secret);
begin
  if not p.lifetime then perform fail('평생권을 가진 사람만 바꿀 수 있어요.'); end if;
  update rooms set lifetime_on = coalesce(p_on, true) where id = p.room_id;
  perform bump(p.room_id);
  return state(p.room_id);
end $$;

-- 최종 결과에서 방장이 광고를 본 뒤 질문 하나를 골라 성별 인원을 공개한다 (판마다 1개).
-- 각 성별이 2명 이상 투표한 질문만 고를 수 있다 (results.male_yes 가 있는 질문).
create or replace function public.tm_pick_gender(p_player uuid, p_secret uuid, p_idx int) returns jsonb
language plpgsql security definer set search_path = truemask, pg_temp
as $$
declare
  p players := enter(p_player, p_secret);
  r rooms := assert_host(p);
  x results;
begin
  if not picking(r) then perform fail('지금은 고를 수 없어요.'); end if;
  select * into x from results where room_id = r.id and idx = p_idx;
  if not found then perform fail('그런 질문은 없어요.'); end if;
  if p_idx = any(r.picks) then perform fail('이미 공개한 질문이에요.'); end if;
  if x.male_yes is null then perform fail('한 성별 인원이 너무 적어 익명 보호를 위해 공개할 수 없어요.'); end if;
  if picks_left(r) < 1 then
    perform fail(case when ad_available(r) then '광고를 보면 하나 공개할 수 있어요.'
                      else '더 보려면 전체 공개를 열어 주세요.' end);
  end if;
  update rooms set picks = picks || p_idx where id = r.id;
  perform bump(r.id);
  return state(r.id);
end $$;

-- 광고를 끝까지 본 방장에게 질문 하나를 고를 기회를 준다 (판마다 1번).
-- TODO(출시): AdMob 보상형 광고의 서버 확인(SSV) 콜백을 Edge Function 으로 받아 확인하도록 교체
create or replace function public.tm_ad_pick(p_player uuid, p_secret uuid, p_ad text) returns jsonb
language plpgsql security definer set search_path = truemask, pg_temp
as $$
declare
  p players := enter(p_player, p_secret);
  r rooms := assert_host(p);
begin
  if not ad_available(r) then perform fail('지금은 광고로 더 볼 수 없어요.'); end if;
  if not ((select value from config where key = 'allow_mock_premium') = 'true'
          and coalesce(p_ad, '') like 'mock-ad:%') then
    perform fail('광고 시청을 확인하지 못했어요.');
  end if;
  update rooms set ad_pick = true where id = r.id;
  perform bump(r.id);
  return state(r.id);
end $$;

create or replace function public.tm_start(p_player uuid, p_secret uuid) returns jsonb
language plpgsql security definer set search_path = truemask, pg_temp
as $$
declare
  p players := enter(p_player, p_secret);
  r rooms := assert_host(p);
  v_mode text;
begin
  if r.phase <> 'lobby' then perform fail('이미 진행 중이에요.'); end if;
  if (select count(*) from players where room_id = r.id and last_seen > online_since()) < 3 then
    perform fail('익명성을 위해 최소 3명이 필요해요.');
  end if;
  -- 모드는 방장이 고르지 않는다. 시작하는 순간 방에 있는 사람들의 성별 구성으로 정한다.
  -- (대기실에서 미리 보여주면 새로 들어온 사람의 성별이 드러나므로 시작 때만 정한다)
  select case
           when bool_and(gender = 'M') then 'male'
           when bool_and(gender = 'F') then 'female'
           else 'mixed'
         end
    into v_mode
    from players where room_id = r.id;
  update rooms set
    mode = v_mode,
    premium = false, -- 1회권은 판마다 새로 산다
    picks = '{}', ad_pick = false, -- 광고 공개도 판마다 새로
    questions = array(
      select body from questions
      where enabled and mode in (v_mode, 'common')
      group by body
      order by random()
      limit r.question_count
    ),
    question_index = 0
  where id = r.id;
  delete from results where room_id = r.id;
  perform begin_question(r.id);
  perform bump(r.id);
  return state(r.id);
end $$;

create or replace function public.tm_vote(p_player uuid, p_secret uuid, p_yes boolean) returns jsonb
language plpgsql security definer set search_path = truemask, pg_temp
as $$
declare
  p players := enter(p_player, p_secret);
begin
  if (select phase from rooms where id = p.room_id) <> 'voting' then perform fail('지금은 투표 시간이 아니에요.'); end if;
  if not p.is_voter then perform fail('이번 질문의 투표 대상이 아니에요.'); end if;
  if exists (select 1 from votes where player_id = p.id) then perform fail('이미 투표했어요.'); end if;
  insert into votes (player_id, room_id, yes) values (p.id, p.room_id, coalesce(p_yes, false));
  perform maybe_reveal(p.room_id);
  perform bump(p.room_id);
  return state(p.room_id);
end $$;

create or replace function public.tm_force_reveal(p_player uuid, p_secret uuid) returns jsonb
language plpgsql security definer set search_path = truemask, pg_temp
as $$
declare
  p players := enter(p_player, p_secret);
  r rooms := assert_host(p);
begin
  if r.phase <> 'voting' then perform fail('지금은 공개할 수 없어요.'); end if;
  if (select count(*) from votes where room_id = r.id) < 3 then
    perform fail('최소 3명이 투표해야 공개할 수 있어요.');
  end if;
  perform reveal(r.id);
  perform bump(r.id);
  return state(r.id);
end $$;

create or replace function public.tm_next(p_player uuid, p_secret uuid) returns jsonb
language plpgsql security definer set search_path = truemask, pg_temp
as $$
declare
  p players := enter(p_player, p_secret);
  r rooms := assert_host(p);
begin
  if r.phase <> 'reveal' then perform fail('결과 공개 후에 넘어갈 수 있어요.'); end if;
  if r.question_index + 1 >= coalesce(array_length(r.questions, 1), 0) then
    update rooms set phase = 'finished' where id = r.id;
  else
    update rooms set question_index = question_index + 1 where id = r.id;
    perform begin_question(r.id);
  end if;
  perform bump(r.id);
  return state(r.id);
end $$;

create or replace function public.tm_restart(p_player uuid, p_secret uuid) returns jsonb
language plpgsql security definer set search_path = truemask, pg_temp
as $$
declare
  p players := enter(p_player, p_secret);
  r rooms := assert_host(p);
begin
  perform reset_lobby(r.id);
  perform bump(r.id);
  return state(r.id);
end $$;

-- 공개 함수만 앱(anon)에 실행 권한 부여
do $$
declare f text;
begin
  foreach f in array array[
    'tm_create_room(text,text,text,int)',
    'tm_join_room(text,text,text)',
    'tm_sync(uuid,uuid)',
    'tm_leave(uuid,uuid)',
    'tm_update_settings(uuid,uuid,text,int)',
    'tm_unlock_premium(uuid,uuid,text)',
    'tm_claim_lifetime(uuid,uuid,text)',
    'tm_set_lifetime_on(uuid,uuid,boolean)',
    'tm_pick_gender(uuid,uuid,int)',
    'tm_ad_pick(uuid,uuid,text)',
    'tm_start(uuid,uuid)',
    'tm_vote(uuid,uuid,boolean)',
    'tm_force_reveal(uuid,uuid)',
    'tm_next(uuid,uuid)',
    'tm_restart(uuid,uuid)'
  ] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;

-- PostgREST 가 새 함수를 바로 인식하도록
notify pgrst, 'reload schema';

// 로컬 Postgres 에 마이그레이션을 적용한 뒤, 앱과 똑같이 anon 역할로 RPC 를 호출해 검증한다.
// 실행: DATABASE_URL=postgres://postgres@localhost:54329/postgres npm test
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4 });

/** 앱이 하는 것과 같이 anon 권한으로 함수 호출 */
async function rpc<T = any>(fn: string, args: Record<string, unknown>, ip?: string): Promise<T> {
  const c = await db.connect();
  try {
    await c.query('begin; set local role anon');
    // Supabase API 가 넘겨주는 요청 헤더 흉내 (IP 별 요청 제한 테스트용)
    if (ip) await c.query(`select set_config('request.headers', $1, true)`, [JSON.stringify({ 'x-forwarded-for': `${ip}, 10.0.0.1` })]);
    const keys = Object.keys(args);
    const sql = `select public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as r`;
    const { rows } = await c.query(sql, Object.values(args));
    await c.query('commit');
    return rows[0].r;
  } catch (e) {
    await c.query('rollback');
    throw e;
  } finally {
    c.release();
  }
}

/** anon 권한으로 아무 SQL 실행 (권한 테스트용) */
async function asAnon(sql: string) {
  const c = await db.connect();
  try {
    await c.query('begin; set local role anon');
    return await c.query(sql);
  } finally {
    await c.query('rollback');
    c.release();
  }
}

type P = { id: string; secret: string; name: string };
const auth = (p: P) => ({ p_player: p.id, p_secret: p.secret });
const receipt = () => `mock-receipt:${crypto.randomUUID()}`;

async function room(genders: ('M' | 'F')[], mode = 'mixed', count = 5) {
  const created = await rpc('tm_create_room', {
    p_nickname: 'p0', p_gender: genders[0], p_mode: mode, p_question_count: count,
  });
  const players: P[] = [{ id: created.playerId, secret: created.secret, name: 'p0' }];
  for (let i = 1; i < genders.length; i++) {
    const j = await rpc('tm_join_room', { p_code: created.state.code, p_nickname: `p${i}`, p_gender: genders[i] });
    players.push({ id: j.playerId, secret: j.secret, name: `p${i}` });
  }
  return { code: created.state.code as string, roomId: created.state.roomId as string, players };
}

const voteAll = async (ps: P[], yes: boolean[]) => {
  let s: any;
  for (let i = 0; i < ps.length; i++) s = await rpc('tm_vote', { ...auth(ps[i]), p_yes: yes[i] });
  return s;
};

beforeAll(async () => {
  await db.query('select 1');
});
afterAll(async () => {
  await db.end();
});

describe('권한 (익명성의 핵심)', () => {
  it('앱(anon)은 투표·참가자·방 테이블을 직접 읽을 수 없다', async () => {
    for (const t of ['votes', 'players', 'rooms', 'results', 'questions', 'premium_receipts']) {
      await expect(asAnon(`select * from truemask.${t}`)).rejects.toThrow(/permission denied/);
    }
  });

  it('내부 함수는 앱에서 호출할 수 없다', async () => {
    await expect(asAnon(`select truemask.state(gen_random_uuid())`)).rejects.toThrow(/permission denied/);
  });

  it('신호 테이블은 읽을 수 있지만 쓸 수는 없다', async () => {
    await expect(asAnon('select * from public.tm_room_signals')).resolves.toBeTruthy();
    await expect(asAnon(`update public.tm_room_signals set version = 0`)).rejects.toThrow(/permission denied/);
  });

  it('비밀 토큰이 틀리면 남의 자리로 투표할 수 없다', async () => {
    const { players } = await room(['M', 'F', 'M']);
    await rpc('tm_start', auth(players[0]));
    await expect(
      rpc('tm_vote', { p_player: players[1].id, p_secret: players[0].secret, p_yes: true }),
    ).rejects.toThrow(/나가졌/);
  });
});

describe('게임 진행', () => {
  it('방 코드는 5자리, 소문자로도 입장된다', async () => {
    const { code } = await room(['M']);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{5}$/);
    const j = await rpc('tm_join_room', { p_code: code.toLowerCase(), p_nickname: 'x', p_gender: 'F' });
    expect(j.state.players).toHaveLength(2);
  });

  it('없는 코드, 중복 닉네임은 입장 실패', async () => {
    const { code } = await room(['M']);
    expect((await rpc('tm_join_room', { p_code: 'ZZZZZ', p_nickname: 'a', p_gender: 'M' })).error).toMatch(/없어요/);
    await expect(rpc('tm_join_room', { p_code: code, p_nickname: 'p0', p_gender: 'M' })).rejects.toThrow(/닉네임/);
  });

  it('3명 미만이면 시작 불가, 방장만 시작 가능', async () => {
    const a = await room(['M', 'F']);
    await expect(rpc('tm_start', auth(a.players[0]))).rejects.toThrow(/최소 3명/);
    const b = await room(['M', 'F', 'M']);
    await expect(rpc('tm_start', auth(b.players[1]))).rejects.toThrow(/방장/);
  });

  it('모두 투표하면 Yes 수만 공개되고 개별 투표는 DB에서도 사라진다', async () => {
    const { players, roomId } = await room(['M', 'F', 'M', 'F']);
    const started = await rpc('tm_start', auth(players[0]));
    expect(started.phase).toBe('voting');
    expect(started.currentQuestion).toBeTruthy();
    expect(started.voterCount).toBe(4);

    const mid = await voteAll(players.slice(0, 3), [true, false, true]);
    expect(mid.phase).toBe('voting');
    expect(mid.votedCount).toBe(3);
    const s = await rpc('tm_vote', { ...auth(players[3]), p_yes: false });
    expect(s.phase).toBe('reveal');
    expect(s.lastResult).toEqual({ question: s.currentQuestion, yes: 2, total: 4 });

    const json = JSON.stringify(s);
    expect(json).not.toMatch(/gender"|secret|"yes":true|"yes":false/);
    const { rows } = await db.query('select count(*)::int n from truemask.votes where room_id = $1', [roomId]);
    expect(rows[0].n).toBe(0);
  });

  it('두 번 투표할 수 없다', async () => {
    const { players } = await room(['M', 'F', 'M']);
    await rpc('tm_start', auth(players[0]));
    await rpc('tm_vote', { ...auth(players[0]), p_yes: true });
    await expect(rpc('tm_vote', { ...auth(players[0]), p_yes: false })).rejects.toThrow(/이미/);
  });

  /** 5문제를 끝까지 진행. yes[i] 는 i번째 사람의 답 */
  const playToEnd = async (ps: P[], yes: boolean[]) => {
    let s: any;
    for (let q = 0; q < 5; q++) {
      s = await voteAll(ps, yes);
      s = await rpc('tm_next', auth(ps[0]));
    }
    return s;
  };

  it('게임 중에는 결제 칸이 없고 성별도 안 보인다', async () => {
    const { players } = await room(['M', 'F', 'M', 'F']);
    let s = await rpc('tm_start', auth(players[0]));
    expect(s.purchase).toBe('none');
    await expect(rpc('tm_unlock_premium', { ...auth(players[1]), p_receipt: receipt() })).rejects.toThrow(/끝난 뒤/);
    s = await voteAll(players, [true, true, false, true]);
    expect(s.purchase).toBe('none');
    expect(s.lastResult.genderBreakdown).toBeUndefined();
    expect(s.picksLeft).toBe(0);
    expect(s.adAvailable).toBe(false);
  });

  it('1회권: 게임이 끝난 뒤 참가자 누구나 사면 모든 질문이 공개된다', async () => {
    const { players } = await room(['M', 'F', 'M', 'F']);
    await rpc('tm_start', auth(players[0]));
    let s = await playToEnd(players, [true, true, false, true]); // M:1, F:2
    expect(s.purchase).toBe('open');
    await expect(rpc('tm_unlock_premium', { ...auth(players[1]), p_receipt: 'fake' })).rejects.toThrow(/결제/);
    s = await rpc('tm_unlock_premium', { ...auth(players[1]), p_receipt: receipt() }); // 방장 아니어도 됨
    expect(s.premium).toBe(true);
    expect(s.premiumBy).toBe('oneGame');
    expect(s.purchase).toBe('none'); // 켜진 방에는 결제 칸이 없다
    expect(s.history.every((h: any) => h.genderBreakdown?.M === 1 && h.genderBreakdown?.F === 2 && !h.canPick)).toBe(true);
  });

  it('이미 켜진 방에서는 또 살 수 없고, 같은 영수증은 다시 쓸 수 없다', async () => {
    const a = await room(['M', 'F', 'M', 'F']);
    const b = await room(['M', 'F', 'M', 'F']);
    await rpc('tm_start', auth(a.players[0]));
    await rpc('tm_start', auth(b.players[0]));
    await playToEnd(a.players, [true, true, false, true]);
    await playToEnd(b.players, [true, true, false, true]);
    const r = receipt();
    await rpc('tm_unlock_premium', { ...auth(a.players[0]), p_receipt: r });
    await expect(rpc('tm_unlock_premium', { ...auth(a.players[1]), p_receipt: receipt() })).rejects.toThrow(/이미 성별 공개/);
    await expect(rpc('tm_unlock_premium', { ...auth(b.players[0]), p_receipt: r })).rejects.toThrow(/이미 사용/);
  });

  it('한 성별이 1명뿐이면 결제 칸이 막힌다', async () => {
    const { players } = await room(['M', 'M', 'M', 'F']);
    await rpc('tm_start', auth(players[0]));
    const s = await playToEnd(players, [true, true, false, true]);
    expect(s.purchase).toBe('blocked');
    expect(s.adAvailable).toBe(false);
    await expect(rpc('tm_unlock_premium', { ...auth(players[0]), p_receipt: receipt() })).rejects.toThrow(/1명뿐/);
  });

  it('혼성이 아니면 결제 칸이 없고, 평생권이 있어도 켜지지 않는다', async () => {
    const { players } = await room(['M', 'M', 'M', 'M']);
    await rpc('tm_claim_lifetime', { ...auth(players[1]), p_receipt: 'mock-lifetime' });
    const st = await rpc('tm_start', auth(players[0]));
    expect(st.premium).toBe(false);
    const s = await voteAll(players, [true, true, false, false]);
    expect(s.lastResult.genderBreakdown).toBeUndefined();
    expect(s.lastResult.genderHidden).toBeUndefined();
  });

  it('1회권은 이번 판만: 한 판 더 하면 꺼지고 광고 공개도 초기화된다', async () => {
    const { players } = await room(['M', 'F', 'M', 'F']);
    await rpc('tm_start', auth(players[0]));
    await playToEnd(players, [true, true, false, true]);
    await rpc('tm_ad_pick', { ...auth(players[0]), p_ad: 'mock-ad:x' });
    await rpc('tm_pick_gender', { ...auth(players[0]), p_idx: 0 });
    await rpc('tm_unlock_premium', { ...auth(players[0]), p_receipt: receipt() });
    expect((await rpc('tm_restart', auth(players[0]))).premium).toBe(false);
    await rpc('tm_start', auth(players[0]));
    const s = await playToEnd(players, [true, true, false, true]);
    expect(s.premium).toBe(false);
    expect(s.purchase).toBe('open');
    expect(s.adAvailable).toBe(true);
    expect(s.history.some((h: any) => h.genderBreakdown)).toBe(false);
  });

  it('평생권: 방에 한 명만 있어도 혼성 게임은 처음부터 자동으로 켜지고, 모두가 그 사실을 안다', async () => {
    const { players } = await room(['M', 'F', 'M', 'F']);
    await expect(rpc('tm_claim_lifetime', { ...auth(players[3]), p_receipt: 'fake' })).rejects.toThrow(/평생권/);
    let s = await rpc('tm_claim_lifetime', { ...auth(players[3]), p_receipt: 'mock-lifetime' });
    expect(s.lifetimeInRoom).toBe(true);
    expect(s.premium).toBe(false); // 대기실에선 아직
    s = await rpc('tm_sync', auth(players[0]));
    expect(s.lifetimeInRoom).toBe(true);
    s = await rpc('tm_start', auth(players[0]));
    expect(s.premium).toBe(true);
    expect(s.premiumBy).toBe('lifetime');
    s = await voteAll(players, [true, true, false, true]);
    expect(s.lastResult.genderBreakdown).toEqual({ M: 1, F: 2 }); // 게임 중에도 바로 보인다
  });

  it('최종 결과에서 평생권을 사도 바로 전체 공개된다', async () => {
    const { players } = await room(['M', 'F', 'M', 'F']);
    await rpc('tm_start', auth(players[0]));
    await playToEnd(players, [true, true, false, true]);
    const s = await rpc('tm_claim_lifetime', { ...auth(players[2]), p_receipt: 'mock-lifetime' });
    expect(s.premium).toBe(true);
    expect(s.purchase).toBe('none');
    expect(s.adAvailable).toBe(false);
    expect(s.history.every((h: any) => h.genderBreakdown)).toBe(true);
  });

  it('평생권 성별 공개는 평생권을 가진 사람만 끄고 켤 수 있다', async () => {
    const { players } = await room(['M', 'F', 'M', 'F']);
    await rpc('tm_claim_lifetime', { ...auth(players[2]), p_receipt: 'mock-lifetime' });
    await expect(rpc('tm_set_lifetime_on', { ...auth(players[0]), p_on: false })).rejects.toThrow(/평생권을 가진/);
    let s = await rpc('tm_set_lifetime_on', { ...auth(players[2]), p_on: false });
    expect(s.lifetimeOn).toBe(false);
    s = await rpc('tm_start', auth(players[0]));
    expect(s.premium).toBe(false);
    s = await playToEnd(players, [true, true, false, true]);
    expect(s.purchase).toBe('none'); // GOLD MASK가 있는 방은 꺼 뒀어도 1회권·광고가 없다
    expect(s.adAvailable).toBe(false);
    s = await rpc('tm_set_lifetime_on', { ...auth(players[2]), p_on: true }); // 잘못 눌렀으면 다시 켜기
    expect(s.premium).toBe(true);
  });

  it('1회권으로 켜진 판은 나중에 GOLD MASK를 사서 꺼도 계속 켜져 있다', async () => {
    const { players } = await room(['M', 'F', 'M', 'F']);
    await rpc('tm_start', auth(players[0]));
    await playToEnd(players, [true, true, false, true]);
    await rpc('tm_unlock_premium', { ...auth(players[1]), p_receipt: receipt() });
    await rpc('tm_claim_lifetime', { ...auth(players[2]), p_receipt: 'mock-lifetime' });
    const s = await rpc('tm_set_lifetime_on', { ...auth(players[2]), p_on: false });
    expect(s.premium).toBe(true);
    expect(s.premiumBy).toBe('oneGame');
  });

  it('한 성별이 1명뿐인 방은 평생권이 있어도 성별 공개가 켜지지 않는다', async () => {
    const { players } = await room(['M', 'M', 'M', 'F']);
    await rpc('tm_claim_lifetime', { ...auth(players[0]), p_receipt: 'mock-lifetime' });
    const st = await rpc('tm_start', auth(players[0]));
    expect(st.premium).toBe(false);
    const s = await voteAll(players, [true, true, true, true]);
    expect(s.lastResult.genderBreakdown).toBeUndefined();
    expect(s.lastResult.yes).toBe(4);
  });

  it('"예"가 1명이어도 성별 인원은 공개된다 (투표한 사람이 성별마다 2명 이상이면 됨)', async () => {
    const { players } = await room(['M', 'F', 'M', 'F']);
    await rpc('tm_claim_lifetime', { ...auth(players[0]), p_receipt: 'mock-lifetime' });
    await rpc('tm_start', auth(players[0]));
    const s = await voteAll(players, [false, true, false, false]);
    expect(s.lastResult.genderBreakdown).toEqual({ M: 0, F: 1 });
  });

  it('광고: 무료 공개는 없고, 방장이 광고를 보면 질문 1개를 공개한다 (판마다 1번)', async () => {
    const { players } = await room(['M', 'F', 'M', 'F']);
    await rpc('tm_start', auth(players[0]));
    let s = await playToEnd(players, [true, true, false, true]); // M:1, F:2
    expect(s.phase).toBe('finished');
    expect(s.picksLeft).toBe(0);
    expect(s.adAvailable).toBe(true);
    expect(s.history.every((h: any) => h.canPick && !h.genderBreakdown)).toBe(true);
    await expect(rpc('tm_pick_gender', { ...auth(players[0]), p_idx: 2 })).rejects.toThrow(/광고/);
    await expect(rpc('tm_ad_pick', { ...auth(players[1]), p_ad: 'mock-ad:x' })).rejects.toThrow(/방장만/);
    await expect(rpc('tm_ad_pick', { ...auth(players[0]), p_ad: 'fake' })).rejects.toThrow(/확인하지/);
    s = await rpc('tm_ad_pick', { ...auth(players[0]), p_ad: 'mock-ad:x' });
    expect(s.picksLeft).toBe(1);
    expect(s.adAvailable).toBe(false);
    await expect(rpc('tm_pick_gender', { ...auth(players[1]), p_idx: 2 })).rejects.toThrow(/방장만/);
    s = await rpc('tm_pick_gender', { ...auth(players[0]), p_idx: 2 });
    expect(s.history[2].genderBreakdown).toEqual({ M: 1, F: 2 });
    expect(s.history[2].canPick).toBeUndefined();
    expect(s.history.filter((h: any) => h.genderBreakdown)).toHaveLength(1);
    expect(s.picksLeft).toBe(0);
    // 다른 참가자에게도 똑같이 보인다
    expect((await rpc('tm_sync', auth(players[3]))).history[2].genderBreakdown).toEqual({ M: 1, F: 2 });
    await expect(rpc('tm_pick_gender', { ...auth(players[0]), p_idx: 2 })).rejects.toThrow(/이미 공개/);
    await expect(rpc('tm_ad_pick', { ...auth(players[0]), p_ad: 'mock-ad:y' })).rejects.toThrow(/광고/);
    await expect(rpc('tm_pick_gender', { ...auth(players[0]), p_idx: 1 })).rejects.toThrow(/전체 공개/);
    expect(s.purchase).toBe('open'); // 나머지는 1회권·평생권으로
  });

  it('익명 보호로 숨긴 질문은 고를 수 없고, 혼성이 아니면 고르기 자체가 없다', async () => {
    const a = await room(['M', 'F', 'M', 'F', 'F']);
    await rpc('tm_start', auth(a.players[0]));
    await voteAll(a.players, [true, true, true, true, true]);
    await rpc('tm_next', auth(a.players[0]));
    await rpc('tm_leave', auth(a.players[2])); // 남자 1명만 남음 → 이후 질문은 성별을 숨긴다
    const rest = [a.players[0], a.players[1], a.players[3], a.players[4]];
    let s: any;
    for (let q = 1; q < 5; q++) {
      s = await voteAll(rest, [true, true, false, true]);
      s = await rpc('tm_next', auth(a.players[0]));
    }
    expect(s.phase).toBe('finished');
    expect(s.history[0].canPick).toBe(true);
    expect(s.history[1].canPick).toBeUndefined();
    expect(s.history[1].genderHidden).toBe(true);
    await rpc('tm_ad_pick', { ...auth(a.players[0]), p_ad: 'mock-ad:x' });
    await expect(rpc('tm_pick_gender', { ...auth(a.players[0]), p_idx: 1 })).rejects.toThrow(/익명 보호/);

    const b = await room(['M', 'M', 'M']);
    await rpc('tm_start', auth(b.players[0]));
    s = await playToEnd(b.players, [true, false, true]);
    expect(s.picksLeft).toBe(0);
    expect(s.adAvailable).toBe(false);
    expect(s.purchase).toBe('none');
    expect(s.history.some((h: any) => h.canPick || h.genderHidden)).toBe(false);
    await expect(rpc('tm_ad_pick', { ...auth(b.players[0]), p_ad: 'mock-ad:x' })).rejects.toThrow(/광고/);
  });

  it('질문 수만큼 진행 후 종료, 질문은 중복 없음, 모드 질문만 사용', async () => {
    const { players } = await room(['F', 'F', 'F'], 'female', 8);
    await rpc('tm_start', auth(players[0]));
    const asked = new Set<string>();
    let s: any;
    for (let i = 0; i < 8; i++) {
      s = await voteAll(players, [true, false, i % 2 === 0]);
      asked.add(s.currentQuestion);
      s = await rpc('tm_next', auth(players[0]));
    }
    expect(s.phase).toBe('finished');
    expect(s.history).toHaveLength(8);
    expect(asked.size).toBe(8);
    const { rows } = await db.query(
      `select body from truemask.questions where mode in ('female','common')`,
    );
    const allowed = new Set(rows.map((r) => r.body));
    for (const q of asked) expect(allowed.has(q)).toBe(true);

    const again = await rpc('tm_restart', auth(players[0]));
    expect(again.phase).toBe('lobby');
    expect(again.history).toEqual([]);
  });

  it('모드는 시작할 때 참가자 성별 구성으로 자동으로 정해진다', async () => {
    const pick = async (genders: ('M' | 'F')[], asked: string) => {
      const { players } = await room(genders, asked);
      return rpc('tm_start', auth(players[0]));
    };
    expect((await pick(['M', 'M', 'M'], 'female')).mode).toBe('male');
    expect((await pick(['F', 'F', 'F'], 'mixed')).mode).toBe('female');
    expect((await pick(['F', 'M', 'F'], 'male')).mode).toBe('mixed');

    // 남자만 있는 방에는 남자/공통 질문만 나온다
    const s = await pick(['M', 'M', 'M'], 'mixed');
    const { rows } = await db.query(`select body from truemask.questions where mode in ('male','common')`);
    expect(new Set(rows.map((r) => r.body)).has(s.currentQuestion)).toBe(true);
  });

  it('설정은 방장만, 질문 수는 5~8로 제한', async () => {
    const { players } = await room(['M', 'F']);
    await expect(rpc('tm_update_settings', { ...auth(players[1]), p_mode: 'male' })).rejects.toThrow(/방장/);
    let s = await rpc('tm_update_settings', { ...auth(players[0]), p_question_count: 20 });
    expect(s.questionCount).toBe(8);
    s = await rpc('tm_update_settings', { ...auth(players[0]), p_mode: 'male' });
    expect(s.mode).toBe('male');
    expect(s.questionCount).toBe(8);
  });

  it('상태 변화마다 신호 버전이 올라간다 (Realtime 트리거)', async () => {
    const { players, roomId } = await room(['M', 'F', 'M']);
    const v = async () =>
      (await db.query('select version from public.tm_room_signals where room_id = $1', [roomId])).rows[0].version;
    const before = Number(await v());
    await rpc('tm_start', auth(players[0]));
    expect(Number(await v())).toBeGreaterThan(before);
  });
});

describe('나가기 / 연결 끊김', () => {
  const goStale = (p: P, seconds: number) =>
    db.query(`update truemask.players set last_seen = now() - make_interval(secs => $2) where id = $1`, [p.id, seconds]);

  it('방장이 나가면 다음 사람이 방장', async () => {
    const { players } = await room(['M', 'F', 'M']);
    await rpc('tm_leave', auth(players[0]));
    const s = await rpc('tm_sync', auth(players[1]));
    expect(s.players.find((p: any) => p.isHost).nickname).toBe('p1');
  });

  it('투표 중 누군가 나가면 남은 사람만으로 자동 공개', async () => {
    const { players } = await room(['M', 'F', 'M', 'F']);
    await rpc('tm_start', auth(players[0]));
    await voteAll(players.slice(0, 3), [true, true, true]);
    await rpc('tm_leave', auth(players[3]));
    const s = await rpc('tm_sync', auth(players[0]));
    expect(s.phase).toBe('reveal');
    expect(s.lastResult).toMatchObject({ yes: 3, total: 3 });
  });

  it('3명 미만으로 줄면 대기실로', async () => {
    const { players } = await room(['M', 'F', 'M']);
    await rpc('tm_start', auth(players[0]));
    await rpc('tm_leave', auth(players[2]));
    expect((await rpc('tm_sync', auth(players[0]))).phase).toBe('lobby');
  });

  it('잠깐 끊기면 접속 끊김으로 표시되고, 30초 안에 다시 신호를 보내면 복귀', async () => {
    const { players } = await room(['M', 'F']);
    await goStale(players[1], 25);
    let s = await rpc('tm_sync', auth(players[0]));
    expect(s.players.find((p: any) => p.nickname === 'p1').connected).toBe(false);
    await rpc('tm_sync', auth(players[1]));
    s = await rpc('tm_sync', auth(players[0]));
    expect(s.players.find((p: any) => p.nickname === 'p1').connected).toBe(true);
  });

  it('30초 넘게 끊기면 방에서 빠지고, 본인은 다시 못 들어온다', async () => {
    const { players } = await room(['M', 'F']);
    await goStale(players[1], 35);
    const s = await rpc('tm_sync', auth(players[0]));
    expect(s.players).toHaveLength(1);
    await expect(rpc('tm_sync', auth(players[1]))).rejects.toThrow(/나가졌/);
  });

  it('마지막 사람이 나가면 방이 삭제된다', async () => {
    const { players, roomId } = await room(['M']);
    await rpc('tm_leave', auth(players[0]));
    const { rows } = await db.query('select count(*)::int n from truemask.rooms where id = $1', [roomId]);
    expect(rows[0].n).toBe(0);
  });

  it('질문 시작 때 잠깐 끊겨 있던 사람도 투표할 수 있다 ("쉬기" 없음)', async () => {
    const { players } = await room(['M', 'F', 'M', 'F']);
    await goStale(players[3], 25);
    const s = await rpc('tm_start', auth(players[0]));
    expect(s.voterCount).toBe(4);
    await voteAll(players.slice(0, 3), [true, true, false]);
    const after = await rpc('tm_vote', { ...auth(players[3]), p_yes: true });
    expect(after.lastResult).toMatchObject({ yes: 3, total: 4 });
  });

  it('투표 중 방장이 튕기면 30초 뒤 방장이 넘어가고, 남은 사람 투표로 공개된다', async () => {
    const { players } = await room(['M', 'F', 'M', 'F']);
    await rpc('tm_start', auth(players[0]));
    await voteAll(players.slice(1), [true, false, true]);
    await goStale(players[0], 35);
    const s = await rpc('tm_sync', auth(players[1]));
    expect(s.players).toHaveLength(3);
    expect(s.players.find((p: any) => p.isHost).nickname).toBe('p1');
    expect(s.phase).toBe('reveal');
    expect(s.lastResult).toMatchObject({ yes: 2, total: 3 });
  });
});

describe('남용 방지 / 정리', () => {
  it('같은 IP에서 10분에 방 5개까지만 만들 수 있다', async () => {
    const ip = `198.51.100.${Math.floor(Math.random() * 250)}`;
    const args = { p_nickname: 'a', p_gender: 'M', p_mode: 'mixed', p_question_count: 5 };
    for (let i = 0; i < 5; i++) await rpc('tm_create_room', args, ip);
    await expect(rpc('tm_create_room', args, ip)).rejects.toThrow(/너무 자주/);
    await expect(rpc('tm_create_room', args, '203.0.113.9')).resolves.toBeTruthy(); // 다른 IP는 괜찮음
  });

  it('틀린 코드 입장 시도도 횟수에 포함되어 무작위 대입을 막는다', async () => {
    const ip = `192.0.2.${Math.floor(Math.random() * 250)}`;
    for (let i = 0; i < 30; i++) {
      const r = await rpc('tm_join_room', { p_code: 'ZZZZZ', p_nickname: 'a', p_gender: 'M' }, ip);
      expect(r.error).toMatch(/없어요/);
    }
    await expect(rpc('tm_join_room', { p_code: 'ZZZZZ', p_nickname: 'a', p_gender: 'M' }, ip)).rejects.toThrow(/너무 많아요/);
  });

  it('10분 넘게 아무도 없는 방은 새 방이 만들어질 때 정리된다', async () => {
    const { roomId } = await room(['M', 'F']);
    await db.query(`update truemask.players set last_seen = now() - interval '11 minutes' where room_id = $1`, [roomId]);
    await room(['M']);
    const { rows } = await db.query('select count(*)::int n from truemask.rooms where id = $1', [roomId]);
    expect(rows[0].n).toBe(0);
  });
});

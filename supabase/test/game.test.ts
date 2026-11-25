// 로컬 Postgres 에 마이그레이션을 적용한 뒤, 앱과 똑같이 anon 역할로 RPC 를 호출해 검증한다.
// 실행: DATABASE_URL=postgres://postgres@localhost:54329/postgres npm test
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4 });

/** 앱이 하는 것과 같이 anon 권한으로 함수 호출 */
async function rpc<T = any>(fn: string, args: Record<string, unknown>): Promise<T> {
  const c = await db.connect();
  try {
    await c.query('begin; set local role anon');
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
    for (const t of ['votes', 'players', 'rooms', 'results', 'questions']) {
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
    ).rejects.toThrow(/나가졌거나/);
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
    await expect(rpc('tm_join_room', { p_code: 'ZZZZZ', p_nickname: 'a', p_gender: 'M' })).rejects.toThrow(/없어요/);
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

  it('프리미엄은 영수증 확인 후 성별 Yes 수를 보여준다', async () => {
    const { players } = await room(['M', 'F', 'M', 'F']);
    await expect(rpc('tm_unlock_premium', { ...auth(players[0]), p_receipt: 'fake' })).rejects.toThrow(/결제/);
    await expect(rpc('tm_unlock_premium', { ...auth(players[1]), p_receipt: 'mock-receipt' })).rejects.toThrow(/방장/);
    expect((await rpc('tm_unlock_premium', { ...auth(players[0]), p_receipt: 'mock-receipt' })).premium).toBe(true);
    await rpc('tm_start', auth(players[0]));
    const s = await voteAll(players, [true, true, false, true]); // M:1, F:2
    expect(s.lastResult.genderBreakdown).toEqual({ M: 1, F: 2 });
  });

  it('한 성별이 1명뿐이면 성별 내역을 숨긴다', async () => {
    const { players } = await room(['M', 'M', 'M', 'F']);
    await rpc('tm_unlock_premium', { ...auth(players[0]), p_receipt: 'mock-receipt' });
    await rpc('tm_start', auth(players[0]));
    const s = await voteAll(players, [true, true, true, true]);
    expect(s.lastResult.genderBreakdown).toBeUndefined();
    expect(s.lastResult.genderHidden).toBe(true);
    expect(s.lastResult.yes).toBe(4);
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

  it('잠깐 끊기면 접속 끊김으로 표시되고, 다시 신호를 보내면 복귀', async () => {
    const { players } = await room(['M', 'F']);
    await goStale(players[1], 30);
    let s = await rpc('tm_sync', auth(players[0]));
    expect(s.players.find((p: any) => p.nickname === 'p1').connected).toBe(false);
    await rpc('tm_sync', auth(players[1]));
    s = await rpc('tm_sync', auth(players[0]));
    expect(s.players.find((p: any) => p.nickname === 'p1').connected).toBe(true);
  });

  it('60초 넘게 끊기면 방에서 빠지고, 본인은 다시 못 들어온다', async () => {
    const { players } = await room(['M', 'F']);
    await goStale(players[1], 90);
    const s = await rpc('tm_sync', auth(players[0]));
    expect(s.players).toHaveLength(1);
    await expect(rpc('tm_sync', auth(players[1]))).rejects.toThrow(/나가졌거나/);
  });

  it('마지막 사람이 나가면 방이 삭제된다', async () => {
    const { players, roomId } = await room(['M']);
    await rpc('tm_leave', auth(players[0]));
    const { rows } = await db.query('select count(*)::int n from truemask.rooms where id = $1', [roomId]);
    expect(rows[0].n).toBe(0);
  });
});

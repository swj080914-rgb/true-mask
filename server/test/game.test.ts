import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import { createGameServer } from '../src/server.js';
import { Room, type Player } from '../src/room.js';
import { QUESTION_POOL, pickQuestions } from '../src/questions.js';
import type { ClientToServer, Gender, RoomState, ServerToClient } from '../src/protocol.js';

const mk = (id: string, gender: Gender = 'M', t = 0): Player => ({
  id, nickname: id, gender, connected: true, joinedAt: t,
});

function roomWith(genders: Gender[]) {
  const r = new Room('ABCDE', mk('p0', genders[0], 0), 'mixed', 5);
  genders.slice(1).forEach((g, i) => r.addPlayer(mk(`p${i + 1}`, g, i + 1)));
  return r;
}

describe('질문', () => {
  it('모드마다 최소 8개 이상, 중복 없이 뽑힌다', () => {
    for (const mode of ['mixed', 'male', 'female'] as const) {
      expect(new Set(QUESTION_POOL[mode]).size).toBeGreaterThanOrEqual(8);
      const q = pickQuestions(mode, 8);
      expect(new Set(q).size).toBe(8);
    }
  });
});

describe('Room', () => {
  it('3명 미만이면 시작할 수 없다', () => {
    const r = roomWith(['M', 'F']);
    expect(() => r.start('p0')).toThrow(/최소 3명/);
  });

  it('방장만 시작할 수 있다', () => {
    const r = roomWith(['M', 'F', 'M']);
    expect(() => r.start('p1')).toThrow(/방장/);
  });

  it('모두 투표하면 Yes 수만 공개되고 개별 투표는 남지 않는다', () => {
    const r = roomWith(['M', 'F', 'M', 'F']);
    r.start('p0');
    r.vote('p0', true);
    r.vote('p1', false);
    r.vote('p2', true);
    expect(r.phase).toBe('voting');
    expect(r.toState().votedCount).toBe(3);
    r.vote('p3', false);
    expect(r.phase).toBe('reveal');
    const s = r.toState();
    expect(s.lastResult).toMatchObject({ yes: 2, total: 4 });
    expect(s.lastResult?.genderBreakdown).toBeUndefined(); // 무료 방
    expect(s.players.every((p) => !p.hasVoted)).toBe(true);
    expect(JSON.stringify(s)).not.toMatch(/"gender"/);
  });

  it('두 번 투표할 수 없다', () => {
    const r = roomWith(['M', 'F', 'M']);
    r.start('p0');
    r.vote('p0', true);
    expect(() => r.vote('p0', false)).toThrow(/이미/);
  });

  it('프리미엄 방은 성별 Yes 수를 보여준다', () => {
    const r = roomWith(['M', 'F', 'M', 'F']);
    r.unlockPremium('p0');
    r.start('p0');
    ['p0', 'p1', 'p2', 'p3'].forEach((p, i) => r.vote(p, i !== 2)); // M:1, F:2
    expect(r.lastResult?.genderBreakdown).toEqual({ M: 1, F: 2 });
  });

  it('성별이 1명뿐이면 그 사람 답이 드러나므로 성별 내역을 숨긴다', () => {
    const r = roomWith(['M', 'M', 'M', 'F']);
    r.unlockPremium('p0');
    r.start('p0');
    ['p0', 'p1', 'p2', 'p3'].forEach((p) => r.vote(p, true));
    expect(r.lastResult?.genderBreakdown).toBeUndefined();
    expect(r.lastResult?.genderHidden).toBe(true);
    expect(r.lastResult?.yes).toBe(4);
  });

  it('투표 중 누군가 나가면 남은 사람만으로 자동 공개된다', () => {
    const r = roomWith(['M', 'F', 'M', 'F']);
    r.start('p0');
    ['p0', 'p1', 'p2'].forEach((p) => r.vote(p, true));
    r.removePlayer('p3');
    expect(r.phase).toBe('reveal');
    expect(r.lastResult).toMatchObject({ yes: 3, total: 3 });
  });

  it('3명 미만으로 줄면 대기실로 돌아간다', () => {
    const r = roomWith(['M', 'F', 'M']);
    r.start('p0');
    r.removePlayer('p2');
    expect(r.phase).toBe('lobby');
  });

  it('방장이 나가면 다음 사람이 방장이 된다', () => {
    const r = roomWith(['M', 'F', 'M']);
    r.removePlayer('p0');
    expect(r.hostId).toBe('p1');
  });

  it('질문 수만큼 진행 후 종료되고 전체 기록을 보여준다', () => {
    const r = roomWith(['M', 'F', 'M']);
    r.updateSettings('p0', { questionCount: 6 });
    r.start('p0');
    for (let i = 0; i < 6; i++) {
      ['p0', 'p1', 'p2'].forEach((p) => r.vote(p, i % 2 === 0));
      r.next('p0');
    }
    expect(r.phase).toBe('finished');
    expect(r.toState().history).toHaveLength(6);
  });

  it('질문 수는 5~8로 제한된다', () => {
    const r = roomWith(['M']);
    r.updateSettings('p0', { questionCount: 20 });
    expect(r.questionCount).toBe(8);
    r.updateSettings('p0', { questionCount: 1 });
    expect(r.questionCount).toBe(5);
  });
});

// ---------------- 소켓 통합 테스트 ----------------

type Client = Socket<ServerToClient, ClientToServer>;

describe('소켓 서버', () => {
  let srv: ReturnType<typeof createGameServer>;
  let url: string;
  const clients: Client[] = [];
  const received: string[] = []; // 모든 클라이언트가 받은 원본 메시지

  beforeEach(async () => {
    srv = createGameServer({ reconnectGraceMs: 200 });
    await srv.listen(0);
    const addr = srv.http.address();
    url = `http://localhost:${typeof addr === 'object' && addr ? addr.port : 0}`;
  });

  afterEach(async () => {
    clients.splice(0).forEach((c) => c.disconnect());
    received.length = 0;
    await srv.close();
  });

  const client = () =>
    new Promise<Client>((res) => {
      const c: Client = connect(url, { transports: ['websocket'], forceNew: true });
      c.onAny((_e, payload) => received.push(JSON.stringify(payload)));
      clients.push(c);
      c.on('connect', () => res(c));
    });

  const call = <T>(c: Client, ev: string, ...args: unknown[]) =>
    new Promise<T>((res) => (c.emit as any)(ev, ...args, (r: T) => {
      received.push(JSON.stringify(r));
      res(r);
    }));

  const nextState = (c: Client, pred: (s: RoomState) => boolean) =>
    new Promise<RoomState>((res) => {
      const h = (s: RoomState) => pred(s) && (c.off('room:state', h), res(s));
      c.on('room:state', h);
    });

  it('방 생성 → 코드로 입장 → 투표 → Yes 수만 전달', async () => {
    const [a, b, c] = await Promise.all([client(), client(), client()]);
    const created: any = await call(a, 'room:create', { nickname: '민수', gender: 'M', mode: 'mixed', questionCount: 5 });
    expect(created.ok).toBe(true);
    const code = created.state.code;
    expect(code).toMatch(/^[A-Z2-9]{5}$/);

    expect(((await call(b, 'room:join', { code: code.toLowerCase(), nickname: '지은', gender: 'F' })) as any).ok).toBe(true);
    expect(((await call(c, 'room:join', { code, nickname: '지은', gender: 'F' })) as any).error).toMatch(/닉네임/);
    expect(((await call(c, 'room:join', { code, nickname: '서연', gender: 'F' })) as any).ok).toBe(true);

    const voting = nextState(c, (s) => s.phase === 'voting');
    expect(((await call(a, 'game:start')) as any).ok).toBe(true);
    expect((await voting).currentQuestion).toBeTruthy();

    const revealed = nextState(b, (s) => s.phase === 'reveal');
    await call(a, 'game:vote', { yes: true });
    await call(b, 'game:vote', { yes: false });
    await call(c, 'game:vote', { yes: true });
    const s = await revealed;
    expect(s.lastResult).toMatchObject({ yes: 2, total: 3 });

    // 어떤 메시지에도 개별 투표나 성별이 실려 가지 않았는지 확인
    for (const msg of received) {
      expect(msg).not.toMatch(/"gender"/);
      expect(msg).not.toMatch(/"votes?"\s*:/);
    }
  });

  it('방장이 아니면 시작 못 하고, 없는 코드는 입장 실패', async () => {
    const [a, b] = await Promise.all([client(), client()]);
    const created: any = await call(a, 'room:create', { nickname: 'A', gender: 'M', mode: 'male', questionCount: 5 });
    await call(b, 'room:join', { code: created.state.code, nickname: 'B', gender: 'M' });
    expect(((await call(b, 'game:start')) as any).error).toMatch(/방장/);
    const c = await client();
    expect(((await call(c, 'room:join', { code: 'ZZZZZ', nickname: 'C', gender: 'M' })) as any).ok).toBe(false);
  });

  it('연결이 잠깐 끊겨도 같은 playerId로 다시 들어올 수 있다', async () => {
    const [a, b] = await Promise.all([client(), client()]);
    const created: any = await call(a, 'room:create', { nickname: 'A', gender: 'M', mode: 'mixed', questionCount: 5 });
    const joined: any = await call(b, 'room:join', { code: created.state.code, nickname: 'B', gender: 'F' });
    const offline = nextState(a, (s) => s.players.some((p) => p.nickname === 'B' && !p.connected));
    b.disconnect();
    await offline;
    const b2 = await client();
    const re: any = await call(b2, 'room:rejoin', { code: created.state.code, playerId: joined.playerId });
    expect(re.ok).toBe(true);
    expect(re.state.players.find((p: any) => p.nickname === 'B').connected).toBe(true);
  });

  it('유예 시간이 지나면 끊긴 사람은 방에서 빠진다', async () => {
    const [a, b] = await Promise.all([client(), client()]);
    const created: any = await call(a, 'room:create', { nickname: 'A', gender: 'M', mode: 'mixed', questionCount: 5 });
    await call(b, 'room:join', { code: created.state.code, nickname: 'B', gender: 'F' });
    const gone = nextState(a, (s) => s.players.length === 1);
    b.disconnect();
    expect((await gone).players[0].nickname).toBe('A');
  });

  it('프리미엄은 영수증 확인 후에만 켜진다', async () => {
    const a = await client();
    await call(a, 'room:create', { nickname: 'A', gender: 'M', mode: 'mixed', questionCount: 5 });
    expect(((await call(a, 'premium:unlock', { receipt: 'fake' })) as any).ok).toBe(false);
    const on = nextState(a, (s) => s.premium);
    expect(((await call(a, 'premium:unlock', { receipt: 'mock-receipt' })) as any).ok).toBe(true);
    expect((await on).premium).toBe(true);
  });
});

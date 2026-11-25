import { createServer } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { Server, type Socket } from 'socket.io';
import { GameError, Room } from './room.js';
import type { Ack, ClientToServer, Gender, Mode, ServerToClient } from './protocol.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 헷갈리는 0/O, 1/I 제외
const CODE_LEN = 5;
const MODES: Mode[] = ['mixed', 'male', 'female'];
const GENDERS: Gender[] = ['M', 'F'];

export interface ServerOptions {
  /** 연결이 끊긴 참가자를 방에서 지우기까지 기다리는 시간 (폰 화면 꺼짐 대비) */
  reconnectGraceMs?: number;
  /** 결제 영수증 검증. 실제 배포 시 App Store / Play / RevenueCat 검증으로 교체 */
  verifyReceipt?: (receipt: string) => Promise<boolean>;
}

type IO = Server<ClientToServer, ServerToClient>;
type Sock = Socket<ClientToServer, ServerToClient>;

export function createGameServer(opts: ServerOptions = {}) {
  const grace = opts.reconnectGraceMs ?? 60_000;
  const verifyReceipt =
    opts.verifyReceipt ??
    (async (r: string) => process.env.ALLOW_MOCK_PREMIUM !== 'false' && r === 'mock-receipt');

  const http = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
      return;
    }
    res.writeHead(404).end();
  });
  const io: IO = new Server(http, { cors: { origin: '*' } });

  const rooms = new Map<string, Room>();
  const sessions = new Map<string, { code: string; playerId: string }>(); // socket.id → 세션
  const sockets = new Map<string, string>(); // playerId → socket.id
  const leaveTimers = new Map<string, NodeJS.Timeout>();

  const newCode = () => {
    for (;;) {
      const bytes = randomBytes(CODE_LEN);
      const code = [...bytes].map((b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
      if (!rooms.has(code)) return code;
    }
  };

  const broadcast = (room: Room) => io.to(room.code).emit('room:state', room.toState());

  const bind = (socket: Sock, room: Room, playerId: string) => {
    const oldSocket = sockets.get(playerId);
    if (oldSocket && oldSocket !== socket.id) {
      sessions.delete(oldSocket);
      io.sockets.sockets.get(oldSocket)?.disconnect(true);
    }
    sessions.set(socket.id, { code: room.code, playerId });
    sockets.set(playerId, socket.id);
    clearTimeout(leaveTimers.get(playerId));
    leaveTimers.delete(playerId);
    socket.join(room.code);
  };

  const removeFromRoom = (room: Room, playerId: string) => {
    room.removePlayer(playerId);
    sockets.delete(playerId);
    clearTimeout(leaveTimers.get(playerId));
    leaveTimers.delete(playerId);
    if (room.isEmpty) rooms.delete(room.code);
    else broadcast(room);
  };

  /** 소켓이 속한 방/플레이어를 찾아 핸들러를 실행하고, 에러는 ack로 돌려준다 */
  const withRoom =
    (socket: Sock, fn: (room: Room, playerId: string) => void | Promise<void>) =>
    async (ack: (r: Ack) => void) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      const s = sessions.get(socket.id);
      const room = s && rooms.get(s.code);
      if (!s || !room) return reply({ ok: false, error: '방에 들어가 있지 않아요.' });
      try {
        await fn(room, s.playerId);
        reply({ ok: true });
        broadcast(room);
      } catch (e) {
        reply({ ok: false, error: e instanceof GameError ? e.message : '알 수 없는 오류가 발생했어요.' });
        if (!(e instanceof GameError)) console.error(e);
      }
    };

  io.on('connection', (socket) => {
    socket.on('room:create', (p, ack) => {
      const nickname = cleanNickname(p?.nickname);
      if (!nickname) return ack({ ok: false, error: '닉네임을 1~12자로 입력해 주세요.' });
      if (!GENDERS.includes(p?.gender)) return ack({ ok: false, error: '성별을 선택해 주세요.' });
      if (!MODES.includes(p?.mode)) return ack({ ok: false, error: '모드를 선택해 주세요.' });
      leaveCurrent(socket);
      const playerId = randomUUID();
      const room = new Room(
        newCode(),
        { id: playerId, nickname, gender: p.gender, connected: true, joinedAt: Date.now() },
        p.mode,
        Number(p.questionCount),
      );
      rooms.set(room.code, room);
      bind(socket, room, playerId);
      ack({ ok: true, playerId, state: room.toState() });
    });

    socket.on('room:join', (p, ack) => {
      const code = String(p?.code ?? '').trim().toUpperCase();
      const room = rooms.get(code);
      if (!room) return ack({ ok: false, error: '그런 방 코드는 없어요.' });
      const nickname = cleanNickname(p?.nickname);
      if (!nickname) return ack({ ok: false, error: '닉네임을 1~12자로 입력해 주세요.' });
      if (!GENDERS.includes(p?.gender)) return ack({ ok: false, error: '성별을 선택해 주세요.' });
      const playerId = randomUUID();
      try {
        room.addPlayer({ id: playerId, nickname, gender: p.gender, connected: true, joinedAt: Date.now() });
      } catch (e) {
        return ack({ ok: false, error: e instanceof GameError ? e.message : '입장할 수 없어요.' });
      }
      leaveCurrent(socket);
      bind(socket, room, playerId);
      ack({ ok: true, playerId, state: room.toState() });
      broadcast(room);
    });

    socket.on('room:rejoin', (p, ack) => {
      const room = rooms.get(String(p?.code ?? ''));
      if (!room || !room.players.has(p?.playerId)) {
        return ack({ ok: false, error: '방이 사라졌거나 오래 접속이 끊겨서 나가졌어요.' });
      }
      bind(socket, room, p.playerId);
      room.setConnected(p.playerId, true);
      ack({ ok: true, state: room.toState() });
      broadcast(room);
    });

    socket.on('room:leave', () => leaveCurrent(socket));

    socket.on('room:settings', (p, ack) =>
      withRoom(socket, (room, pid) => {
        if (p?.mode !== undefined && !MODES.includes(p.mode)) throw new GameError('잘못된 모드예요.');
        room.updateSettings(pid, { mode: p?.mode, questionCount: p?.questionCount });
      })(ack),
    );

    socket.on('premium:unlock', (p, ack) =>
      withRoom(socket, async (room, pid) => {
        if (!(await verifyReceipt(String(p?.receipt ?? '')))) throw new GameError('결제를 확인하지 못했어요.');
        room.unlockPremium(pid);
      })(ack),
    );

    socket.on('game:start', (ack) => withRoom(socket, (room, pid) => room.start(pid))(ack));
    socket.on('game:vote', (p, ack) => withRoom(socket, (room, pid) => room.vote(pid, p?.yes === true))(ack));
    socket.on('game:reveal', (ack) => withRoom(socket, (room, pid) => room.forceReveal(pid))(ack));
    socket.on('game:next', (ack) => withRoom(socket, (room, pid) => room.next(pid))(ack));
    socket.on('game:restart', (ack) => withRoom(socket, (room, pid) => room.restart(pid))(ack));

    socket.on('disconnect', () => {
      const s = sessions.get(socket.id);
      sessions.delete(socket.id);
      if (!s || sockets.get(s.playerId) !== socket.id) return;
      const room = rooms.get(s.code);
      if (!room) return;
      room.setConnected(s.playerId, false);
      broadcast(room);
      leaveTimers.set(
        s.playerId,
        setTimeout(() => removeFromRoom(room, s.playerId), grace),
      );
    });
  });

  function leaveCurrent(socket: Sock) {
    const s = sessions.get(socket.id);
    if (!s) return;
    sessions.delete(socket.id);
    socket.leave(s.code);
    const room = rooms.get(s.code);
    if (room) removeFromRoom(room, s.playerId);
  }

  return {
    http,
    io,
    rooms,
    listen: (port: number) => new Promise<void>((r) => http.listen(port, r)),
    close: async () => {
      leaveTimers.forEach(clearTimeout);
      io.close();
      await new Promise((r) => http.close(r));
    },
  };
}

function cleanNickname(n: unknown) {
  const s = String(n ?? '').trim().replace(/\s+/g, ' ');
  return s.length >= 1 && [...s].length <= 12 ? s : null;
}

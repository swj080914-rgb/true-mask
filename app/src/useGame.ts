import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { SERVER_URL } from './config';
import type { Ack, ClientToServer, Gender, Mode, RoomState, ServerToClient } from './protocol';

type GameSocket = Socket<ServerToClient, ClientToServer>;

export interface Game {
  connected: boolean;
  state: RoomState | null;
  playerId: string | null;
  error: string | null;
  busy: boolean;
  clearError: () => void;
  createRoom: (p: { nickname: string; gender: Gender; mode: Mode; questionCount: number }) => Promise<boolean>;
  joinRoom: (p: { code: string; nickname: string; gender: Gender }) => Promise<boolean>;
  leave: () => void;
  updateSettings: (p: { mode?: Mode; questionCount?: number }) => void;
  unlockPremium: (receipt: string) => Promise<boolean>;
  start: () => void;
  vote: (yes: boolean) => Promise<boolean>;
  forceReveal: () => void;
  next: () => void;
  restart: () => void;
}

export function useGame(): Game {
  const socketRef = useRef<GameSocket | null>(null);
  const sessionRef = useRef<{ code: string; playerId: string } | null>(null);
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<RoomState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const s: GameSocket = io(SERVER_URL, { transports: ['websocket'] });
    socketRef.current = s;
    s.on('connect', () => {
      setConnected(true);
      // 폰 화면이 꺼졌다 켜지는 등 연결이 끊겼다 다시 붙으면 원래 방으로 복귀
      const sess = sessionRef.current;
      if (sess) {
        s.emit('room:rejoin', sess, (r) => {
          if (r.ok) setState(r.state);
          else {
            sessionRef.current = null;
            setPlayerId(null);
            setState(null);
            setError(r.error);
          }
        });
      }
    });
    s.on('disconnect', () => setConnected(false));
    s.on('room:state', setState);
    return () => {
      s.disconnect();
    };
  }, []);

  /** ack 기반 호출을 Promise로 감싸고, 실패하면 에러 메시지를 띄운다 */
  const call = useCallback(<T extends object>(event: keyof ClientToServer, ...args: unknown[]) => {
    return new Promise<Ack<T>>((resolve) => {
      const s = socketRef.current;
      if (!s?.connected) {
        const r = { ok: false as const, error: '서버에 연결되어 있지 않아요. 잠시 후 다시 시도해 주세요.' };
        setError(r.error);
        return resolve(r);
      }
      setBusy(true);
      const timer = setTimeout(() => {
        setBusy(false);
        const r = { ok: false as const, error: '서버 응답이 없어요.' };
        setError(r.error);
        resolve(r);
      }, 8000);
      (s.emit as (...a: unknown[]) => void)(event, ...args, (r: Ack<T>) => {
        clearTimeout(timer);
        setBusy(false);
        if (!r.ok) setError(r.error);
        resolve(r);
      });
    });
  }, []);

  const enter = (r: Ack<{ playerId: string; state: RoomState }>) => {
    if (!r.ok) return false;
    sessionRef.current = { code: r.state.code, playerId: r.playerId };
    setPlayerId(r.playerId);
    setState(r.state);
    return true;
  };

  return {
    connected,
    state,
    playerId,
    error,
    busy,
    clearError: () => setError(null),
    createRoom: async (p) => enter(await call('room:create', p)),
    joinRoom: async (p) => enter(await call('room:join', p)),
    leave: () => {
      socketRef.current?.emit('room:leave');
      sessionRef.current = null;
      setPlayerId(null);
      setState(null);
    },
    updateSettings: (p) => void call('room:settings', p),
    unlockPremium: async (receipt) => (await call('premium:unlock', { receipt })).ok,
    start: () => void call('game:start'),
    vote: async (yes) => (await call('game:vote', { yes })).ok,
    forceReveal: () => void call('game:reveal'),
    next: () => void call('game:next'),
    restart: () => void call('game:restart'),
  };
}

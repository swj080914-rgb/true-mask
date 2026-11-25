import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from './supabase';
import type { Gender, Mode, RoomState } from './protocol';

/** 접속 중 표시를 유지하고 상태를 맞추기 위해 이 간격으로 서버에 신호를 보낸다 */
const HEARTBEAT_MS = 8000;

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

interface Session {
  playerId: string;
  secret: string; // 이 폰만 아는 토큰. 다른 사람이 내 자리로 투표하는 걸 막는다
  roomId: string;
}

type RpcResult<T> = { ok: true; data: T } | { ok: false };

export function useGame(): Game {
  const sessionRef = useRef<Session | null>(null);
  const stateRef = useRef<RoomState | null>(null);
  const [connected, setConnected] = useState(true);
  const [state, setStateRaw] = useState<RoomState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** 같은 방의 더 오래된 상태가 늦게 도착하면 버린다 */
  const applyState = useCallback((s: RoomState | null) => {
    const cur = stateRef.current;
    if (s && cur && s.roomId === cur.roomId && s.version < cur.version) return;
    stateRef.current = s;
    setStateRaw(s);
  }, []);

  const resetToHome = useCallback(() => {
    sessionRef.current = null;
    setPlayerId(null);
    applyState(null);
  }, [applyState]);

  /** Supabase 함수 호출. 실패하면 알맞은 에러 메시지를 띄운다. */
  const rpc = useCallback(
    async <T>(fn: string, args: Record<string, unknown>, opts: { silent?: boolean } = {}): Promise<RpcResult<T>> => {
      if (!opts.silent) setBusy(true);
      try {
        const { data, error: err } = await supabase.rpc(fn, args);
        if (!err) {
          setConnected(true);
          return { ok: true, data: data as T };
        }
        if (err.hint === 'gone') {
          // 오래 연결이 끊겨 방에서 빠진 경우
          resetToHome();
          setError(err.message);
        } else if (!err.code || /fetch|network/i.test(err.message)) {
          setConnected(false);
          if (!opts.silent) setError('인터넷 연결을 확인해 주세요.');
        } else if (!opts.silent) {
          setConnected(true);
          setError(err.message);
        }
        return { ok: false };
      } catch {
        setConnected(false);
        if (!opts.silent) setError('인터넷 연결을 확인해 주세요.');
        return { ok: false };
      } finally {
        if (!opts.silent) setBusy(false);
      }
    },
    [resetToHome],
  );

  const auth = () => {
    const s = sessionRef.current;
    return s ? { p_player: s.playerId, p_secret: s.secret } : null;
  };

  /** 방 상태를 받아오는 호출 (하트비트 겸용) */
  const sync = useCallback(async () => {
    const s = sessionRef.current;
    if (!s) return;
    const r = await rpc<RoomState>('tm_sync', { p_player: s.playerId, p_secret: s.secret }, { silent: true });
    if (r.ok && sessionRef.current === s) applyState(r.data);
  }, [rpc, applyState]);

  /** 방 상태를 바꾸는 호출. 결과로 새 상태를 받아 바로 반영한다. */
  const act = async (fn: string, extra: Record<string, unknown> = {}) => {
    const a = auth();
    if (!a) return false;
    const r = await rpc<RoomState>(fn, { ...a, ...extra });
    if (r.ok) applyState(r.data);
    return r.ok;
  };

  const roomId = state?.roomId;

  // 방에 있는 동안: Realtime 신호 구독 + 하트비트 + 앱 복귀 시 즉시 동기화
  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`tm-room-${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tm_room_signals', filter: `room_id=eq.${roomId}` },
        () => void sync(),
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void sync(); // 구독 직전에 놓친 변경이 있을 수 있으니 한 번 맞춤
      });
    const timer = setInterval(() => void sync(), HEARTBEAT_MS);
    const appState = AppState.addEventListener('change', (st) => {
      if (st === 'active') void sync();
    });
    return () => {
      clearInterval(timer);
      appState.remove();
      void supabase.removeChannel(channel);
    };
  }, [roomId, sync]);

  const enter = (r: RpcResult<{ playerId: string; secret: string; state: RoomState }>) => {
    if (!r.ok) return false;
    sessionRef.current = { playerId: r.data.playerId, secret: r.data.secret, roomId: r.data.state.roomId };
    setPlayerId(r.data.playerId);
    stateRef.current = null;
    applyState(r.data.state);
    return true;
  };

  return {
    connected,
    state,
    playerId,
    error,
    busy,
    clearError: () => setError(null),
    createRoom: async (p) =>
      enter(
        await rpc('tm_create_room', {
          p_nickname: p.nickname,
          p_gender: p.gender,
          p_mode: p.mode,
          p_question_count: p.questionCount,
        }),
      ),
    joinRoom: async (p) =>
      enter(await rpc('tm_join_room', { p_code: p.code, p_nickname: p.nickname, p_gender: p.gender })),
    leave: () => {
      const a = auth();
      resetToHome();
      if (a) void rpc('tm_leave', a, { silent: true });
    },
    updateSettings: (p) =>
      void act('tm_update_settings', { p_mode: p.mode ?? null, p_question_count: p.questionCount ?? null }),
    unlockPremium: (receipt) => act('tm_unlock_premium', { p_receipt: receipt }),
    start: () => void act('tm_start'),
    vote: (yes) => act('tm_vote', { p_yes: yes }),
    forceReveal: () => void act('tm_force_reveal'),
    next: () => void act('tm_next'),
    restart: () => void act('tm_restart'),
  };
}

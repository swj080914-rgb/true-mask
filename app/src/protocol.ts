// 서버 server/src/protocol.ts 의 복사본입니다. 서버 쪽을 고치면 이 파일도 같이 맞춰 주세요.

export type Gender = 'M' | 'F';
export type Mode = 'mixed' | 'male' | 'female';
export type Phase = 'lobby' | 'voting' | 'reveal' | 'finished';

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 12;
export const MIN_QUESTIONS = 5;
export const MAX_QUESTIONS = 8;

export interface PublicPlayer {
  id: string;
  nickname: string;
  isHost: boolean;
  connected: boolean;
  hasVoted: boolean; // 투표했는지 여부만 공개 (무엇에 투표했는지는 공개 안 함)
}

/** 한 질문의 공개 결과. 누가 Yes를 눌렀는지는 절대 담기지 않는다. */
export interface QuestionResult {
  question: string;
  yes: number;
  total: number;
  /** 프리미엄 방에서만, 그리고 익명성 보호 조건을 통과할 때만 채워진다. */
  genderBreakdown?: { M: number; F: number };
  /** 프리미엄 방인데 익명성 보호 때문에 성별을 숨겼을 때 true */
  genderHidden?: boolean;
}

export interface RoomState {
  code: string;
  mode: Mode;
  questionCount: number;
  premium: boolean;
  phase: Phase;
  players: PublicPlayer[];
  questionIndex: number; // 0부터
  currentQuestion: string | null;
  votedCount: number;
  voterCount: number;
  lastResult: QuestionResult | null;
  history: QuestionResult[];
}

export type Ack<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

export interface ClientToServer {
  'room:create': (
    p: { nickname: string; gender: Gender; mode: Mode; questionCount: number },
    ack: (r: Ack<{ playerId: string; state: RoomState }>) => void,
  ) => void;
  'room:join': (
    p: { code: string; nickname: string; gender: Gender },
    ack: (r: Ack<{ playerId: string; state: RoomState }>) => void,
  ) => void;
  'room:rejoin': (
    p: { code: string; playerId: string },
    ack: (r: Ack<{ state: RoomState }>) => void,
  ) => void;
  'room:leave': () => void;
  'room:settings': (
    p: { mode?: Mode; questionCount?: number },
    ack: (r: Ack) => void,
  ) => void;
  'premium:unlock': (p: { receipt: string }, ack: (r: Ack) => void) => void;
  'game:start': (ack: (r: Ack) => void) => void;
  'game:vote': (p: { yes: boolean }, ack: (r: Ack) => void) => void;
  'game:reveal': (ack: (r: Ack) => void) => void; // 호스트가 남은 투표를 기다리지 않고 공개
  'game:next': (ack: (r: Ack) => void) => void;
  'game:restart': (ack: (r: Ack) => void) => void;
}

export interface ServerToClient {
  'room:state': (s: RoomState) => void;
  'room:kicked': (reason: string) => void;
}

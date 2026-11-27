// Supabase 함수(supabase/migrations/0001_true_mask.sql)가 돌려주는 데이터 모양.
// SQL 의 truemask.state() 를 고치면 이 파일도 같이 맞춰 주세요.

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
  /** 익명성 보호 때문에 성별을 숨겼을 때 true (전체 공개 중이거나, 최종 결과에서 고르는 중일 때만 옴) */
  genderHidden?: boolean;
  /** 최종 결과에서 방장이 이 질문을 골라 성별을 공개할 수 있으면 true */
  canPick?: boolean;
}

export interface RoomState {
  roomId: string;
  /** 상태가 바뀔 때마다 1씩 오른다. 늦게 도착한 옛 상태를 버리는 데 사용 */
  version: number;
  code: string;
  mode: Mode;
  questionCount: number;
  /** 지금 결과에 남녀 인원이 보이는지 */
  premium: boolean;
  /** 어떻게 켜졌는지 (누가 샀는지는 서버가 보내지 않는다) */
  premiumBy: 'oneGame' | 'lifetime' | null;
  /** 방에 평생권을 가진 사람이 있는지 */
  lifetimeInRoom: boolean;
  /** 평생권 성별 공개를 켜 뒀는지 (평생권을 가진 사람이 끌 수 있음) */
  lifetimeOn: boolean;
  /** 결제 칸 (게임이 끝난 뒤에만): none 안 보임 / open 살 수 있음 / blocked 익명 보호로 막힘 */
  purchase: 'none' | 'open' | 'blocked';
  /** 방장이 광고를 본 뒤 아직 고르지 않은 질문 수 (0 또는 1) */
  picksLeft: number;
  /** 방장이 광고를 보고 질문 하나를 열 수 있는지 (판마다 1번) */
  adAvailable: boolean;
  phase: Phase;
  players: PublicPlayer[];
  questionIndex: number; // 0부터
  currentQuestion: string | null;
  votedCount: number;
  voterCount: number;
  lastResult: QuestionResult | null;
  history: QuestionResult[];
}

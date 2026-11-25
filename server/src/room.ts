import { pickQuestions } from './questions.js';
import {
  MAX_PLAYERS,
  MAX_QUESTIONS,
  MIN_PLAYERS,
  MIN_QUESTIONS,
  type Gender,
  type Mode,
  type Phase,
  type QuestionResult,
  type RoomState,
} from './protocol.js';

/** 성별 내역을 보여주려면 각 성별 투표자가 최소 이만큼은 있어야 한다. (1명이면 그 사람 답이 그대로 드러남) */
export const MIN_GENDER_GROUP = 2;

export interface Player {
  id: string;
  nickname: string;
  gender: Gender;
  connected: boolean;
  joinedAt: number;
}

export class GameError extends Error {}

export class Room {
  readonly players = new Map<string, Player>();
  hostId: string;
  mode: Mode;
  questionCount: number;
  premium = false;
  phase: Phase = 'lobby';
  questions: string[] = [];
  questionIndex = 0;
  history: QuestionResult[] = [];
  lastResult: QuestionResult | null = null;

  /** 이번 질문에 투표해야 하는 사람들 */
  private voters = new Set<string>();
  /**
   * 개별 투표. 서버 메모리에만 존재하고, 결과 공개 직후 바로 지운다.
   * 이 값은 어떤 경로로도 클라이언트에 전송하지 않는다.
   */
  private votes = new Map<string, boolean>();

  constructor(
    readonly code: string,
    host: Player,
    mode: Mode,
    questionCount: number,
    private rand: () => number = Math.random,
  ) {
    this.mode = mode;
    this.questionCount = clampQuestions(questionCount);
    this.players.set(host.id, host);
    this.hostId = host.id;
  }

  // ---------- 참가자 ----------

  addPlayer(p: Player) {
    if (this.phase !== 'lobby') throw new GameError('이미 게임이 시작된 방이에요.');
    if (this.players.size >= MAX_PLAYERS) throw new GameError(`방이 꽉 찼어요. (최대 ${MAX_PLAYERS}명)`);
    const taken = [...this.players.values()].some((x) => x.nickname === p.nickname);
    if (taken) throw new GameError('이미 같은 닉네임이 있어요.');
    this.players.set(p.id, p);
  }

  removePlayer(id: string) {
    if (!this.players.delete(id)) return;
    this.voters.delete(id);
    this.votes.delete(id);
    if (this.hostId === id) {
      // 가장 먼저 들어온 사람에게 방장을 넘긴다 (접속 중인 사람 우선)
      const next = [...this.players.values()].sort(
        (a, b) => Number(b.connected) - Number(a.connected) || a.joinedAt - b.joinedAt,
      )[0];
      if (next) this.hostId = next.id;
    }
    if (this.phase === 'voting' || this.phase === 'reveal') {
      if (this.players.size < MIN_PLAYERS) {
        // 인원이 너무 줄면 익명성이 깨지므로 대기실로 돌려보낸다
        this.resetToLobby();
      } else {
        this.maybeAutoReveal();
      }
    }
  }

  setConnected(id: string, connected: boolean) {
    const p = this.players.get(id);
    if (p) p.connected = connected;
  }

  get isEmpty() {
    return this.players.size === 0;
  }

  // ---------- 설정 ----------

  updateSettings(by: string, s: { mode?: Mode; questionCount?: number }) {
    this.assertHost(by);
    if (this.phase !== 'lobby') throw new GameError('대기실에서만 바꿀 수 있어요.');
    if (s.mode) this.mode = s.mode;
    if (s.questionCount !== undefined) this.questionCount = clampQuestions(s.questionCount);
  }

  unlockPremium(by: string) {
    this.assertHost(by);
    this.premium = true;
  }

  // ---------- 진행 ----------

  start(by: string) {
    this.assertHost(by);
    if (this.phase !== 'lobby') throw new GameError('이미 진행 중이에요.');
    const online = [...this.players.values()].filter((p) => p.connected);
    if (online.length < MIN_PLAYERS) {
      throw new GameError(`익명성을 위해 최소 ${MIN_PLAYERS}명이 필요해요.`);
    }
    this.questions = pickQuestions(this.mode, this.questionCount, this.rand);
    this.questionIndex = 0;
    this.history = [];
    this.beginQuestion();
  }

  vote(by: string, yes: boolean) {
    if (this.phase !== 'voting') throw new GameError('지금은 투표 시간이 아니에요.');
    if (!this.voters.has(by)) throw new GameError('이번 질문의 투표 대상이 아니에요.');
    if (this.votes.has(by)) throw new GameError('이미 투표했어요.');
    this.votes.set(by, yes === true);
    this.maybeAutoReveal();
  }

  forceReveal(by: string) {
    this.assertHost(by);
    if (this.phase !== 'voting') throw new GameError('지금은 공개할 수 없어요.');
    if (this.votes.size < MIN_PLAYERS) {
      throw new GameError(`최소 ${MIN_PLAYERS}명이 투표해야 공개할 수 있어요.`);
    }
    this.reveal();
  }

  next(by: string) {
    this.assertHost(by);
    if (this.phase !== 'reveal') throw new GameError('결과 공개 후에 넘어갈 수 있어요.');
    if (this.questionIndex + 1 >= this.questions.length) {
      this.phase = 'finished';
      return;
    }
    this.questionIndex++;
    this.beginQuestion();
  }

  restart(by: string) {
    this.assertHost(by);
    this.resetToLobby();
  }

  hasVoted(id: string) {
    return this.votes.has(id);
  }

  // ---------- 내부 ----------

  private beginQuestion() {
    this.phase = 'voting';
    this.votes.clear();
    this.lastResult = null;
    this.voters = new Set([...this.players.values()].filter((p) => p.connected).map((p) => p.id));
  }

  private maybeAutoReveal() {
    if (this.phase === 'voting' && this.voters.size > 0 && this.votes.size >= this.voters.size) {
      this.reveal();
    }
  }

  private reveal() {
    const result: QuestionResult = {
      question: this.questions[this.questionIndex],
      yes: 0,
      total: this.votes.size,
    };
    const byGender = { M: { yes: 0, n: 0 }, F: { yes: 0, n: 0 } };
    for (const [pid, yes] of this.votes) {
      if (yes) result.yes++;
      const g = this.players.get(pid)?.gender;
      if (g) {
        byGender[g].n++;
        if (yes) byGender[g].yes++;
      }
    }
    if (this.premium) {
      const groups = (['M', 'F'] as const).filter((g) => byGender[g].n > 0);
      const safe = groups.every((g) => byGender[g].n >= MIN_GENDER_GROUP);
      if (safe) result.genderBreakdown = { M: byGender.M.yes, F: byGender.F.yes };
      else result.genderHidden = true;
    }
    // 개별 투표 기록은 즉시 폐기
    this.votes.clear();
    this.voters.clear();
    this.lastResult = result;
    this.history.push(result);
    this.phase = 'reveal';
  }

  private resetToLobby() {
    this.phase = 'lobby';
    this.votes.clear();
    this.voters.clear();
    this.questions = [];
    this.questionIndex = 0;
    this.lastResult = null;
    this.history = [];
  }

  private assertHost(id: string) {
    if (id !== this.hostId) throw new GameError('방장만 할 수 있어요.');
  }

  // ---------- 클라이언트에 보낼 상태 ----------

  toState(): RoomState {
    return {
      code: this.code,
      mode: this.mode,
      questionCount: this.questionCount,
      premium: this.premium,
      phase: this.phase,
      players: [...this.players.values()]
        .sort((a, b) => a.joinedAt - b.joinedAt)
        .map((p) => ({
          id: p.id,
          nickname: p.nickname,
          isHost: p.id === this.hostId,
          connected: p.connected,
          hasVoted: this.votes.has(p.id),
          // gender는 일부러 보내지 않는다 (성별 공개는 프리미엄 집계로만)
        })),
      questionIndex: this.questionIndex,
      currentQuestion: this.phase === 'lobby' ? null : (this.questions[this.questionIndex] ?? null),
      votedCount: this.votes.size,
      voterCount: this.voters.size,
      lastResult: this.lastResult,
      history: this.phase === 'finished' ? this.history : [],
    };
  }
}

function clampQuestions(n: number) {
  if (!Number.isFinite(n)) return MIN_QUESTIONS;
  return Math.min(MAX_QUESTIONS, Math.max(MIN_QUESTIONS, Math.round(n)));
}

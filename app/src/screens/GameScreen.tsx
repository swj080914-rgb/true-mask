import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Game } from '../useGame';
import { MIN_PLAYERS, type QuestionResult, type RoomState } from '../protocol';
import { Button, C, Card } from '../ui';

/** 투표 중 화면 + 결과 공개 화면 */
export function GameScreen({ game, state, isHost }: { game: Game; state: RoomState; isHost: boolean }) {
  const me = state.players.find((p) => p.id === game.playerId);
  const [myChoice, setMyChoice] = useState<boolean | null>(null);

  // 질문이 바뀌면 내 선택 표시를 초기화
  useEffect(() => setMyChoice(null), [state.questionIndex, state.phase === 'voting']);

  const vote = async (yes: boolean) => {
    if (await game.vote(yes)) setMyChoice(yes);
  };

  const progress = `${state.questionIndex + 1} / ${state.questionCount}`;
  const isLast = state.questionIndex + 1 >= state.questionCount;

  return (
    <View style={s.wrap}>
      <Text style={s.progress}>질문 {progress}</Text>
      <Card style={s.qCard}>
        <Text testID="question" style={s.question}>{state.currentQuestion}</Text>
      </Card>

      {state.phase === 'voting' ? (
        <>
          {me?.hasVoted ? (
            <Card style={{ alignItems: 'center' }}>
              <Text style={s.voted}>
                {myChoice === null ? '투표 완료' : `“${myChoice ? '예' : '아니오'}”로 투표했어요`}
              </Text>
              <Text style={s.sub}>내 선택은 이 폰에만 보여요. 다른 사람은 절대 알 수 없어요.</Text>
            </Card>
          ) : (
            <View style={s.voteRow}>
              <Button testID="vote-yes" title="예" onPress={() => vote(true)} style={[s.voteBtn, { backgroundColor: C.yes }]} />
              <Button testID="vote-no" title="아니오" onPress={() => vote(false)} style={[s.voteBtn, { backgroundColor: C.no }]} />
            </View>
          )}
          <Text testID="vote-progress" style={s.center}>
            {state.votedCount} / {state.voterCount}명 투표 완료
          </Text>
          <View style={s.chips}>
            {state.players.map((p) => (
              <Text key={p.id} style={[s.chip, p.hasVoted && s.chipOn, !p.connected && { opacity: 0.4 }]}>
                {p.hasVoted ? '✓ ' : ''}{p.nickname}
              </Text>
            ))}
          </View>
          {isHost && state.votedCount < state.voterCount && (
            <Button
              title="남은 사람 기다리지 않고 공개"
              kind="ghost"
              onPress={game.forceReveal}
              disabled={state.votedCount < MIN_PLAYERS}
            />
          )}
        </>
      ) : (
        state.lastResult && (
          <>
            <ResultView result={state.lastResult} />
            {isHost ? (
              <Button testID="next" title={isLast ? '최종 결과 보기' : '다음 질문'} onPress={game.next} loading={game.busy} />
            ) : (
              <Text style={s.center}>방장이 다음으로 넘기길 기다리는 중…</Text>
            )}
          </>
        )
      )}
    </View>
  );
}

export function ResultView({ result, compact }: { result: QuestionResult; compact?: boolean }) {
  const pct = result.total ? result.yes / result.total : 0;
  return (
    <Card style={compact ? undefined : { alignItems: 'center' }}>
      {compact && <Text style={s.histQ}>{result.question}</Text>}
      <Text testID="yes-count" style={compact ? s.bigCompact : s.big}>
        <Text style={{ color: C.yes }}>{result.yes}명</Text>
        {compact && <Text style={s.ofTotal}> / {result.total}명</Text>}
      </Text>
      {!compact && <Text style={s.sub}>{result.total}명 중 “예”라고 답한 사람</Text>}
      <View style={[s.bar, compact && { marginTop: 8 }]}>
        <View style={[s.barFill, { width: `${pct * 100}%` }]} />
      </View>
      {result.genderBreakdown && (
        <View testID="gender-breakdown" style={s.genderRow}>
          <Text style={[s.gender, { color: C.male }]}>남자 {result.genderBreakdown.M}명</Text>
          <Text style={[s.gender, { color: C.female }]}>여자 {result.genderBreakdown.F}명</Text>
        </View>
      )}
      {result.genderHidden && (
        <Text style={[s.sub, { marginTop: 10 }]}>👑 한 성별 인원이 너무 적어 익명 보호를 위해 성별을 숨겼어요</Text>
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 16 },
  progress: { color: C.accent, fontWeight: '700', fontSize: 14, textAlign: 'center', marginTop: 8 },
  qCard: { minHeight: 180, justifyContent: 'center' },
  question: { color: C.text, fontSize: 24, fontWeight: '800', textAlign: 'center', lineHeight: 34 },
  voteRow: { flexDirection: 'row', gap: 12 },
  voteBtn: { flex: 1, minHeight: 72 },
  voted: { color: C.text, fontSize: 18, fontWeight: '700' },
  sub: { color: C.sub, fontSize: 14, textAlign: 'center', marginTop: 6 },
  center: { color: C.sub, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  chip: {
    color: C.sub, backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6,
    overflow: 'hidden', fontSize: 13,
  },
  chipOn: { color: C.text, backgroundColor: C.accentDim },
  big: { fontSize: 56, fontWeight: '900' },
  bigCompact: { fontSize: 22, fontWeight: '800', marginTop: 6 },
  ofTotal: { color: C.sub, fontSize: 22, fontWeight: '600' },
  bar: { height: 10, backgroundColor: C.bg, borderRadius: 5, alignSelf: 'stretch', marginTop: 14, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: C.yes, borderRadius: 5 },
  genderRow: { flexDirection: 'row', gap: 20, marginTop: 14, justifyContent: 'center' },
  gender: { fontSize: 16, fontWeight: '800' },
  histQ: { color: C.text, fontSize: 15, fontWeight: '600', lineHeight: 21 },
});

import { StyleSheet, Text, View } from 'react-native';
import type { Game } from '../useGame';
import { MIN_PLAYERS, type QuestionResult, type RoomState } from '../protocol';
import { Button, C, Card, DISPLAY_FONT, MaskAvatar, avatarColor } from '../ui';

/** 투표 중 화면 + 결과 공개 화면 */
export function GameScreen({ game, state, isHost }: { game: Game; state: RoomState; isHost: boolean }) {
  const me = state.players.find((p) => p.id === game.playerId);
  // 내가 무엇을 골랐는지는 화면에 남기지 않는다 (옆 사람이 폰 화면을 볼 수 있으므로)
  const vote = (yes: boolean) => void game.vote(yes);

  const progress = `${state.questionIndex + 1} / ${state.questionCount}`;
  const isLast = state.questionIndex + 1 >= state.questionCount;

  return (
    <View style={s.wrap}>
      <View style={s.progressRow}>
        {Array.from({ length: state.questionCount }, (_, i) => (
          <View key={i} style={[s.pip, i < state.questionIndex && s.pipDone, i === state.questionIndex && s.pipNow]} />
        ))}
      </View>
      <Text style={s.progress}>QUESTION {progress}</Text>
      <Card style={s.qCard}>
        <Text testID="question" style={s.question}>{state.currentQuestion}</Text>
      </Card>

      {state.phase === 'voting' ? (
        <>
          {me?.hasVoted ? (
            <Card style={{ alignItems: 'center' }}>
              <Text testID="voted" style={s.voted}>투표 완료 🎭</Text>
              <Text style={s.sub}>무엇을 골랐는지는 어디에도 남지 않아요.</Text>
            </Card>
          ) : (
            <View style={s.voteRow}>
              <Button testID="vote-yes" kind="yes" title="예" onPress={() => vote(true)} style={s.voteBtn} textStyle={s.voteText} />
              <Button testID="vote-no" kind="no" title="아니오" onPress={() => vote(false)} style={s.voteBtn} textStyle={s.voteText} />
            </View>
          )}
          <Text style={s.lock}>🔒 이름 없이 “예” 숫자만 공개돼요</Text>
          <Text testID="vote-progress" style={s.center}>
            {state.votedCount} / {state.voterCount}명 투표 완료
          </Text>
          <View style={s.chips}>
            {state.players.map((p, i) => (
              <View key={p.id} style={[s.chip, !p.connected && { opacity: 0.4 }]}>
                <MaskAvatar color={avatarColor(i)} size={34} dim={!p.hasVoted} />
                {p.hasVoted && <Text style={s.check}>✓</Text>}
                <Text style={[s.chipName, p.hasVoted && { color: C.text }]} numberOfLines={1}>{p.nickname}</Text>
              </View>
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
        <Text style={{ color: C.yes }}>{result.yes}</Text>
        {!compact && <Text style={s.unit}>명</Text>}
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
  progressRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  pip: { flex: 1, height: 8, borderRadius: 4, backgroundColor: C.cardBorder },
  pipDone: { backgroundColor: C.accent },
  pipNow: { backgroundColor: C.gold },
  progress: { fontFamily: DISPLAY_FONT, color: C.gold, fontSize: 16, letterSpacing: 2, textAlign: 'center' },
  qCard: { minHeight: 200, justifyContent: 'center', borderColor: C.accent, borderBottomWidth: 6 },
  question: { color: C.text, fontSize: 25, fontWeight: '900', textAlign: 'center', lineHeight: 36, letterSpacing: -0.5 },
  voteRow: { flexDirection: 'row', gap: 12 },
  voteBtn: { flex: 1, minHeight: 84, borderRadius: 22 },
  voteText: { fontSize: 24, fontWeight: '900' },
  voted: { color: C.text, fontSize: 20, fontWeight: '900' },
  lock: { color: C.sub, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  sub: { color: C.sub, fontSize: 14, textAlign: 'center', marginTop: 6 },
  center: { color: C.sub, textAlign: 'center', fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  chip: { alignItems: 'center', width: 56, gap: 4 },
  chipName: { color: C.sub, fontSize: 11, fontWeight: '700', maxWidth: 56 },
  check: {
    position: 'absolute', right: 6, top: 22, color: '#03251A', backgroundColor: C.yes, fontSize: 10,
    fontWeight: '900', width: 16, height: 16, borderRadius: 8, textAlign: 'center', lineHeight: 16, overflow: 'hidden',
  },
  big: { fontFamily: DISPLAY_FONT, fontSize: 88, lineHeight: 96 },
  unit: { color: C.text, fontSize: 28, fontWeight: '900' },
  bigCompact: { fontFamily: DISPLAY_FONT, fontSize: 28, marginTop: 6 },
  ofTotal: { color: C.sub, fontSize: 18 },
  bar: { height: 14, backgroundColor: C.inset, borderRadius: 7, alignSelf: 'stretch', marginTop: 14, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: C.yes, borderRadius: 7 },
  genderRow: { flexDirection: 'row', gap: 20, marginTop: 14, justifyContent: 'center' },
  gender: { fontSize: 16, fontWeight: '900' },
  histQ: { color: C.text, fontSize: 15, fontWeight: '700', lineHeight: 21 },
});

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Game } from '../useGame';
import type { RoomState } from '../protocol';
import { Button, C, Card, DISPLAY_FONT } from '../ui';
import { LockedGender, ResultView } from './GameScreen';
import { PremiumCard } from './PremiumCard';
import { PurchaseSheet } from './PurchaseSheet';
import { Mascot } from '../Mascot';
import { RewardedAd } from '../RewardedAd';
import { COPY } from '../copy';

export function FinishedScreen({ game, state, isHost }: { game: Game; state: RoomState; isHost: boolean }) {
  /** 선택창: 누른 질문 번호 (-1: 전부 보기), null: 닫힘 */
  const [sheet, setSheet] = useState<number | null>(null);
  /** 광고를 보고 열 질문 번호 */
  const [adFor, setAdFor] = useState<number | null>(null);
  const locked = state.purchase === 'open';
  const blocked = state.purchase === 'blocked';
  const pickNow = isHost && state.picksLeft > 0; // 광고를 봤는데 아직 못 고른 경우 (앱이 중간에 꺼졌을 때 등)

  return (
    <View style={s.wrap}>
      <View style={s.logo}><Mascot width={120} /></View>
      <Text style={s.title}>MASK OFF</Text>
      <Text style={s.kr}>가면을 벗을 시간</Text>
      <View style={s.quote}>
        <Text style={s.quoteTop}>누가 “예”라고 했을지는</Text>
        <Text style={s.quoteMain}>각자의 상상에 맡길게요 🤫</Text>
      </View>

      {(locked || blocked) && (
        <Card style={s.guideCard}>
          <Text testID="pick-guide" style={[s.guide, blocked && { color: C.sub }]}>
            {blocked ? COPY.blocked : COPY.finishedGuide}
          </Text>
          {locked && (
            <Button testID="open-all" kind="gold" title={COPY.finishedAllButton} onPress={() => setSheet(-1)} style={s.rowBtn} textStyle={s.rowBtnText} />
          )}
        </Card>
      )}
      <PremiumCard game={game} state={state} />

      {state.history.map((r, i) => (
        <ResultView
          key={i}
          result={r}
          compact
          action={
            locked && r.canPick ? (
              <Pressable
                testID={`lock-${i}`}
                accessibilityRole="button"
                onPress={() => (pickNow ? void game.adReveal(i, '') : setSheet(i))}
                style={({ pressed }) => [s.lockRow, pressed && { opacity: 0.6 }]}
              >
                <LockedGender />
              </Pressable>
            ) : undefined
          }
        />
      ))}

      <PurchaseSheet
        game={game}
        state={state}
        isHost={isHost}
        questionIdx={sheet}
        onClose={() => setSheet(null)}
        onWatchAd={(idx) => {
          setSheet(null);
          setAdFor(idx);
        }}
      />
      <RewardedAd
        visible={adFor !== null}
        onClose={() => setAdFor(null)}
        onReward={(token) => {
          const idx = adFor;
          setAdFor(null);
          if (idx !== null) void game.adReveal(idx, token);
        }}
      />

      {isHost ? (
        <Button testID="restart" title="새 질문으로 한 판 더" onPress={game.restart} />
      ) : (
        <Text style={s.sub}>방장이 다음 판을 시작할 수 있어요.</Text>
      )}
      <Button title="방 나가기" kind="ghost" onPress={game.leave} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 14 },
  logo: { alignItems: 'center', marginTop: 8 },
  title: {
    fontFamily: DISPLAY_FONT, color: C.gold, fontSize: 46, textAlign: 'center', letterSpacing: 1.5,
    textShadowColor: C.accentDark, textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 0,
  },
  kr: { color: C.text, fontSize: 20, fontWeight: '900', textAlign: 'center', marginTop: -6 },
  quote: {
    alignItems: 'center', paddingVertical: 16, paddingHorizontal: 12, marginVertical: 4,
    borderTopWidth: 2, borderBottomWidth: 2, borderColor: C.accentDim,
  },
  quoteTop: { color: C.sub, fontSize: 16, fontWeight: '700' },
  quoteMain: { color: C.text, fontSize: 24, fontWeight: '900', marginTop: 4, letterSpacing: -0.5 },
  sub: { color: C.sub, fontSize: 14, textAlign: 'center', marginBottom: 4 },
  guideCard: { borderColor: C.goldDark, paddingVertical: 14 },
  guide: { color: C.gold, fontSize: 15, fontWeight: '900', textAlign: 'center', lineHeight: 21 },
  rowBtn: { marginTop: 12, minHeight: 44 },
  rowBtnText: { fontSize: 15 },
  lockRow: {
    marginTop: 12, borderRadius: 14, borderWidth: 2, borderColor: C.cardBorder, borderStyle: 'dashed',
    paddingBottom: 12, backgroundColor: C.inset,
  },
});

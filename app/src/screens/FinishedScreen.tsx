import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Game } from '../useGame';
import type { RoomState } from '../protocol';
import { Button, C, Card, DISPLAY_FONT } from '../ui';
import { ResultView } from './GameScreen';
import { PremiumCard } from './PremiumCard';
import { Mascot } from '../Mascot';
import { RewardedAd } from '../RewardedAd';
import { ADS_AVAILABLE } from '../purchases';

export function FinishedScreen({ game, state, isHost }: { game: Game; state: RoomState; isHost: boolean }) {
  const [adOpen, setAdOpen] = useState(false);
  // 혼성 게임이고 전체 공개가 꺼져 있으면: 방장이 질문을 골라 성별을 공개한다 (무료 1개 + 광고 1개)
  const picking = state.mode === 'mixed' && !state.premium && state.history.some((r) => r.canPick || r.genderBreakdown);
  const canPickNow = isHost && state.picksLeft > 0;
  const showAd = isHost && ADS_AVAILABLE && state.picksLeft === 0 && state.adAvailable;
  const picked = state.history.filter((r) => r.genderBreakdown).length;

  return (
    <View style={s.wrap}>
      <View style={s.logo}><Mascot width={120} /></View>
      <Text style={s.title}>MASK OFF</Text>
      <Text style={s.kr}>가면을 벗을 시간</Text>
      <View style={s.quote}>
        <Text style={s.quoteTop}>누가 “예”라고 했을지는</Text>
        <Text style={s.quoteMain}>각자의 상상에 맡길게요 🤫</Text>
      </View>

      {picking && (
        <Card style={s.pickCard}>
          <Text testID="pick-guide" style={s.pickTitle}>
            {canPickNow
              ? picked === 0
                ? '👑 질문 1개를 골라 무료로 성별 공개'
                : '👑 하나 더 골라 성별 공개'
              : state.picksLeft > 0
                ? '방장이 성별을 공개할 질문을 고르는 중…'
                : '👑 방장이 고른 질문의 남녀 인원이 공개됐어요'}
          </Text>
          {showAd && (
            <Button testID="watch-ad" kind="gold" title="📺 광고 보고 하나 더 공개" onPress={() => setAdOpen(true)} style={s.pickBtn} textStyle={s.pickBtnText} />
          )}
        </Card>
      )}

      {state.history.map((r, i) => (
        <ResultView
          key={i}
          result={r}
          compact
          action={
            canPickNow && r.canPick ? (
              <Button
                testID={`pick-${i}`}
                kind="gold"
                title="이 질문 남녀 인원 보기"
                onPress={() => void game.pickGender(i)}
                loading={game.busy}
                style={s.pickBtn}
                textStyle={s.pickBtnText}
              />
            ) : undefined
          }
        />
      ))}

      <RewardedAd
        visible={adOpen}
        onClose={() => setAdOpen(false)}
        onReward={(token) => {
          setAdOpen(false);
          void game.claimAdPick(token);
        }}
      />

      <PremiumCard game={game} state={state} />

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
  pickCard: { borderColor: C.goldDark, paddingVertical: 12 },
  pickTitle: { color: C.gold, fontSize: 15, fontWeight: '900', textAlign: 'center', lineHeight: 21 },
  pickBtn: { marginTop: 12, minHeight: 44 },
  pickBtnText: { fontSize: 15 },
});

import { StyleSheet, Text, View } from 'react-native';
import type { Game } from '../useGame';
import type { RoomState } from '../protocol';
import { C } from '../ui';
import { COPY } from '../copy';
import { GoldMask } from '../GoldMask';

/**
 * 성별 공개가 열려 있으면 작은 표시만 보여준다 (결제 칸은 최종 결과의 선택창 PurchaseSheet 에 있다)
 * - 1회권: "👑 이번 판 공개" 글자
 * - GOLD MASK(평생권)가 방에 있으면: GOLD MASK 배지. 켜져 있으면 금색, 꺼져 있으면 회색.
 *   GOLD MASK를 가진 사람은 배지를 눌러 켜고 끌 수 있다 (1회권으로 열린 판은 끌 수 없음).
 * - 누가 샀는지는 서버도 보내지 않는다.
 */
export function PremiumCard({ game, state }: { game: Game; state: RoomState }) {
  const lobby = state.phase === 'lobby';
  const mixedGame = !lobby && state.mode === 'mixed';

  if (state.premiumBy === 'oneGame') {
    return (
      <View style={s.wrap}>
        <Text testID="premium-on" style={s.badge}>{COPY.onByOneGame}</Text>
      </View>
    );
  }
  if (!state.lifetimeInRoom || !(lobby || mixedGame)) return null;

  const on = state.premium || (lobby && state.lifetimeOn);
  return (
    <GoldMask
      testID="gold-mask"
      size="sm"
      on={on}
      onPress={game.lifetime ? () => game.setLifetimeOn(!state.lifetimeOn) : undefined}
    />
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center' },
  badge: {
    color: C.gold, fontSize: 13, fontWeight: '900', borderWidth: 2, borderColor: C.goldDark, borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 6, overflow: 'hidden',
  },
});

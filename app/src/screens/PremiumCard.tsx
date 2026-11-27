import { StyleSheet, Text, View } from 'react-native';
import type { Game } from '../useGame';
import type { RoomState } from '../protocol';
import { Button, C } from '../ui';
import { COPY } from '../copy';

/**
 * 성별 공개가 열려 있으면 작은 표시만 보여준다 (결제 칸은 최종 결과의 선택창 PurchaseSheet 에 있다)
 * - 누가 샀는지는 서버도 보내지 않는다.
 * - 평생권은 가진 사람이 켜고 끌 수 있다 (친구들이 원하지 않을 수 있으므로). 1회권은 끌 수 없다.
 */
export function PremiumCard({ game, state }: { game: Game; state: RoomState }) {
  const lobby = state.phase === 'lobby';
  const mixedGame = !lobby && state.mode === 'mixed';
  const iHaveLifetime = game.lifetime && state.lifetimeInRoom;

  let label: string | null = null;
  if (state.premium) label = state.premiumBy === 'oneGame' ? COPY.onByOneGame : COPY.onByLifetime;
  else if (state.lifetimeInRoom && (lobby || mixedGame)) label = state.lifetimeOn ? COPY.onByLifetime : COPY.lifetimeOff;
  if (!label) return null;

  const showToggle = iHaveLifetime && (lobby || mixedGame) && state.premiumBy !== 'oneGame';
  return (
    <View style={s.wrap}>
      <Text testID="premium-on" style={[s.badge, label === COPY.lifetimeOff && s.off]}>{label}</Text>
      {showToggle && (
        <Button
          testID="lifetime-toggle"
          kind="ghost"
          title={state.lifetimeOn ? COPY.lifetimeTurnOff : COPY.lifetimeTurnOn}
          onPress={() => game.setLifetimeOn(!state.lifetimeOn)}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center' },
  badge: {
    color: C.gold, fontSize: 13, fontWeight: '900', borderWidth: 2, borderColor: C.goldDark, borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 6, overflow: 'hidden',
  },
  off: { color: C.sub, borderColor: C.cardBorder },
});

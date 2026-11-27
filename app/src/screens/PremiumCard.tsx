import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { Game } from '../useGame';
import type { RoomState } from '../protocol';
import { C } from '../ui';
import { COPY } from '../copy';
import { GOLD_TINT, OFF_TINT, mascotSvg } from '../mascotArt';

const GOLD_SVG = mascotSvg({ tint: GOLD_TINT, viewBox: '0 28 240 142' });
const OFF_SVG = mascotSvg({ tint: OFF_TINT, viewBox: '0 28 240 142' });

/**
 * 성별 공개가 열려 있으면 작은 표시만 보여준다 (결제 칸은 최종 결과의 선택창 PurchaseSheet 에 있다)
 * - 1회권: "👑 이번 판 공개" 글자
 * - GOLD MASK(평생권): 가면 그림. 켜져 있으면 금색, 꺼져 있으면 회색.
 *   GOLD MASK를 가진 사람은 그림을 눌러 켜고 끌 수 있다 (1회권으로 열린 판은 끌 수 없음).
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
  const canToggle = game.lifetime;
  return (
    <View style={s.wrap}>
      <Pressable
        testID="gold-mask"
        accessibilityRole={canToggle ? 'switch' : 'image'}
        accessibilityState={{ checked: on }}
        accessibilityLabel={on ? COPY.onByLifetime : COPY.lifetimeOff}
        disabled={!canToggle}
        onPress={() => game.setLifetimeOn(!state.lifetimeOn)}
        style={({ pressed }) => [s.mask, pressed && { transform: [{ scale: 0.92 }] }]}
      >
        <SvgXml xml={on ? GOLD_SVG : OFF_SVG} width={76} height={45} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center' },
  badge: {
    color: C.gold, fontSize: 13, fontWeight: '900', borderWidth: 2, borderColor: C.goldDark, borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 6, overflow: 'hidden',
  },
  mask: { padding: 4 },
});

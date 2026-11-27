import { StyleSheet, Text } from 'react-native';
import type { Game } from '../useGame';
import type { RoomState } from '../protocol';
import { Button, C, Card } from '../ui';
import { COPY } from '../copy';

/**
 * 성별 공개가 켜져 있을 때 모두에게 보여주는 안내 (결제 칸은 최종 결과의 선택창 PurchaseSheet 에 있다)
 * - 누가 샀는지는 서버도 보내지 않는다.
 * - 평생권은 가진 사람이 켜고 끌 수 있다 (친구들이 원하지 않을 수 있으므로). 1회권은 끌 수 없다.
 */
export function PremiumCard({ game, state }: { game: Game; state: RoomState }) {
  const lobby = state.phase === 'lobby';
  const mixedGame = !lobby && state.mode === 'mixed';
  const iHaveLifetime = game.lifetime && state.lifetimeInRoom;

  const lifetimeToggle = iHaveLifetime && (lobby || mixedGame) && state.premiumBy !== 'oneGame' && (
    <Button
      testID="lifetime-toggle"
      kind="secondary"
      title={state.lifetimeOn ? COPY.lifetimeTurnOff : COPY.lifetimeTurnOn}
      onPress={() => game.setLifetimeOn(!state.lifetimeOn)}
      style={{ marginTop: 10 }}
    />
  );

  if (state.premium) {
    return (
      <Card style={s.onCard}>
        <Text testID="premium-on" style={s.onText}>
          {state.premiumBy === 'oneGame' ? COPY.onByOneGame : COPY.onByLifetime}
        </Text>
        {lifetimeToggle}
      </Card>
    );
  }

  // 평생권을 가진 사람이 있는데 꺼져 있거나, 대기실이라 아직 적용 전
  if (state.lifetimeInRoom && (lobby || mixedGame)) {
    return (
      <Card style={s.onCard}>
        <Text style={s.onText}>{!state.lifetimeOn ? COPY.lifetimeOff : COPY.lifetimeInLobby}</Text>
        {lifetimeToggle}
      </Card>
    );
  }
  return null;
}

const s = StyleSheet.create({
  onCard: { borderColor: C.goldDark, paddingVertical: 12 },
  onText: { color: C.gold, fontSize: 14, fontWeight: '800', lineHeight: 20, textAlign: 'center' },
});

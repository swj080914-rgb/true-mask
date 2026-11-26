import { StyleSheet, Text } from 'react-native';
import type { Game } from '../useGame';
import type { RoomState } from '../protocol';
import { Button, C, Card } from '../ui';

/**
 * 유료 기능: 이 방의 결과에 "Yes를 누른 사람의 성별별 인원"을 추가로 보여준다.
 *
 * 지금은 결제 없이 'mock-receipt'로 잠금이 풀리는 개발용 흐름이다.
 * 출시할 때는 react-native-purchases(RevenueCat) 등으로 인앱결제를 붙이고,
 * 받은 영수증을 그대로 서버에 보내 서버의 verifyReceipt 에서 검증하도록 바꾸면 된다.
 */
export function PremiumCard({ game, state, isHost }: { game: Game; state: RoomState; isHost: boolean }) {
  if (state.premium) {
    return (
      <Card style={s.on}>
        <Text style={s.title}>👑 성별 공개 켜짐</Text>
        <Text style={s.body}>결과에 남자·여자 인원이 함께 나와요.</Text>
      </Card>
    );
  }
  return (
    <Card style={s.card}>
      <Text style={s.title}>👑 성별 공개 (프리미엄)</Text>
      <Text style={s.body}>
        “예”를 누른 사람 중 남자·여자가 몇 명인지 보여줘요.
      </Text>
      {isHost ? (
        <Button
          testID="premium"
          kind="gold"
          title="이 방 잠금 해제 · ₩2,900"
          onPress={() => game.unlockPremium('mock-receipt')}
          style={{ marginTop: 14 }}
        />
      ) : (
        <Text style={[s.body, { marginTop: 10 }]}>방장이 잠금 해제할 수 있어요.</Text>
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  on: { borderColor: C.gold },
  card: { borderColor: C.goldDark, backgroundColor: '#2A1F3F' },
  title: { color: C.gold, fontSize: 17, fontWeight: '900' },
  body: { color: C.sub, fontSize: 14, lineHeight: 20, marginTop: 6 },
});

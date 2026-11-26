import { StyleSheet, Text, View } from 'react-native';
import type { Game } from '../useGame';
import type { RoomState } from '../protocol';
import { Button, C, Card } from '../ui';
import { PRICE_LIFETIME, PRICE_ONE_GAME, PURCHASES_AVAILABLE } from '../purchases';

/**
 * 유료 기능: 결과에 "예"를 누른 사람의 남자·여자 인원을 추가로 보여준다.
 *
 * 혼성인지는 게임을 시작해야 정해지므로 대기실에서는 팔지 않는다.
 * 게임이 시작되고 혼성일 때, 결과 화면에서만 보여준다 (다 같은 성별이면 헛돈이 되므로).
 * 결제하면 이미 지나간 질문의 성별 인원까지 공개된다.
 */
export function PremiumCard({ game, state }: { game: Game; state: RoomState }) {
  if (state.mode !== 'mixed' || state.phase === 'lobby') return null;

  if (state.premium) {
    return (
      <View style={s.onRow}>
        <Text style={s.onText}>👑 성별 공개 중{game.lifetime ? ' · 평생권' : ''}</Text>
      </View>
    );
  }

  return (
    <Card style={s.card}>
      <Text style={s.title}>👀 이 중에 남자 몇 명, 여자 몇 명?</Text>
      <View style={s.lockRow}>
        <Text style={[s.lock, { color: C.male }]}>남자 ?명</Text>
        <Text style={[s.lock, { color: C.female }]}>여자 ?명</Text>
      </View>
      <Text style={s.body}>
        잠금을 풀면 지금까지 나온 질문까지 전부 성별 인원이 보여요.{'\n'}누가 눌렀는지는 여전히 아무도 몰라요.
      </Text>
      {PURCHASES_AVAILABLE ? (
        <>
          <Button
            testID="buy-one"
            kind="gold"
            title={`이번 판만 열기 · ${PRICE_ONE_GAME}`}
            onPress={() => void game.buyOneGame()}
            loading={game.busy}
            style={{ marginTop: 14 }}
          />
          <Button
            testID="buy-lifetime"
            kind="secondary"
            title={`평생 열기 · ${PRICE_LIFETIME}`}
            onPress={() => void game.buyLifetime()}
            style={{ marginTop: 10 }}
          />
          <Text style={s.hint}>평생권이 있는 사람이 방에 있으면 혼성 게임은 항상 자동으로 열려요.</Text>
        </>
      ) : (
        <Text style={[s.body, { marginTop: 12, color: C.gold }]}>성별 공개는 트루 마스크 앱에서 열 수 있어요.</Text>
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  card: { borderColor: C.goldDark, backgroundColor: '#2A1F3F' },
  title: { color: C.gold, fontSize: 17, fontWeight: '900' },
  lockRow: { flexDirection: 'row', gap: 20, marginTop: 12, justifyContent: 'center' },
  lock: { fontSize: 16, fontWeight: '900', opacity: 0.55 },
  body: { color: C.sub, fontSize: 14, lineHeight: 20, marginTop: 10 },
  hint: { color: C.sub, fontSize: 12, lineHeight: 17, marginTop: 10, textAlign: 'center' },
  onRow: { alignItems: 'center' },
  onText: { color: C.gold, fontSize: 13, fontWeight: '900' },
});

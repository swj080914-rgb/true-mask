import { StyleSheet, Text, View } from 'react-native';
import type { Game } from '../useGame';
import type { RoomState } from '../protocol';
import { Button, C, Card } from '../ui';
import { PRICE_LIFETIME, PRICE_ONE_GAME, PURCHASES_AVAILABLE } from '../purchases';

/**
 * 성별 공개(유료): 결과에 "예"를 누른 남자·여자 인원을 추가로 보여준다.
 *
 * - 결제는 시작 직후 첫 질문 투표 중에만 (게임 중간에는 팔지 않음). 서버가 state.purchase 로 알려준다.
 * - 이미 켜진 방에는 결제 칸이 없고, 모두에게 "켜졌어요"만 알린다. 누가 샀는지는 서버도 보내지 않는다.
 * - 한 성별이 1명뿐이면 익명 보호를 위해 결제 칸을 회색으로 막는다.
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
      title={state.lifetimeOn ? '내 평생권 성별 공개 끄기' : '내 평생권 성별 공개 켜기'}
      onPress={() => game.setLifetimeOn(!state.lifetimeOn)}
      style={{ marginTop: 10 }}
    />
  );

  // 켜져 있음: 결제 칸 없이 알림만
  if (state.premium) {
    return (
      <Card style={s.onCard}>
        <Text testID="premium-on" style={s.onText}>
          {state.premiumBy === 'oneGame'
            ? '👑 누군가 성별 공개를 열었어요. 이번 판은 남녀 인원도 보여요.'
            : '👑 평생권을 가진 사람이 있어 성별 공개가 켜졌어요.'}
        </Text>
        {lifetimeToggle}
      </Card>
    );
  }

  // 평생권을 가진 사람이 있는데 꺼져 있거나, 대기실이라 아직 적용 전
  const lifetimeNotice = state.lifetimeInRoom && (lobby || mixedGame) && (
    <Card style={s.onCard}>
      <Text style={s.onText}>
        {!state.lifetimeOn
          ? '평생권을 가진 사람이 성별 공개를 꺼 뒀어요.'
          : '👑 평생권을 가진 사람이 있어요. 남녀가 섞인 게임이면 성별 공개가 켜져요.'}
      </Text>
      {lifetimeToggle}
    </Card>
  );

  if (state.purchase !== 'open' && state.purchase !== 'blocked') return lifetimeNotice || null;

  const blocked = state.purchase === 'blocked';
  const finished = state.phase === 'finished';
  return (
    <>
      {lifetimeNotice}
      <Card style={[s.card, blocked && s.cardBlocked]}>
        <Text style={[s.title, blocked && { color: C.sub }]}>
          {finished ? '👀 나머지 질문도 전부 볼까요?' : '👀 이 중에 남자 몇 명, 여자 몇 명?'}
        </Text>
        <View style={s.lockRow}>
          <Text style={[s.lock, { color: blocked ? C.sub : C.male }]}>남자 ?명</Text>
          <Text style={[s.lock, { color: blocked ? C.sub : C.female }]}>여자 ?명</Text>
        </View>
        {blocked ? (
          <Text testID="premium-blocked" style={s.body}>
            한 성별이 1명뿐이라 익명 보호를 위해 이번 판은 열 수 없어요.
          </Text>
        ) : finished ? (
          <Text style={s.body}>
            열면 이번 판 모든 질문에 남녀 인원이 보여요.{'\n'}누가 열었는지는 아무도 몰라요.
          </Text>
        ) : (
          <Text style={s.body}>
            지금 열면 이번 판 모든 질문에 남녀 인원이 바로 보여요.{'\n'}안 열어도 게임이 끝나면 방장이 질문 1개는 무료로 공개할 수 있어요.{'\n'}누가 눌렀는지, 누가 열었는지는 아무도 몰라요.
          </Text>
        )}
        {PURCHASES_AVAILABLE ? (
          <>
            <Button
              testID="buy-one"
              kind="gold"
              title={`${finished ? '이번 판 전체 공개' : '이번 판만 열기'} · ${PRICE_ONE_GAME}`}
              onPress={() => void game.buyOneGame()}
              disabled={blocked}
              loading={game.busy}
              style={{ marginTop: 14 }}
            />
            {!game.lifetime && (
              <Button
                testID="buy-lifetime"
                kind="secondary"
                title={`평생 열기 · 광고 제거 · ${PRICE_LIFETIME}`}
                onPress={() => void game.buyLifetime()}
                disabled={blocked}
                style={{ marginTop: 10 }}
              />
            )}
          </>
        ) : (
          <Text style={[s.body, { color: blocked ? C.sub : C.gold }]}>성별 공개는 트루 마스크 앱에서 열 수 있어요.</Text>
        )}
      </Card>
    </>
  );
}

const s = StyleSheet.create({
  card: { borderColor: C.goldDark, backgroundColor: '#2A1F3F' },
  cardBlocked: { borderColor: C.cardBorder, backgroundColor: C.inset, opacity: 0.7 },
  title: { color: C.gold, fontSize: 17, fontWeight: '900' },
  lockRow: { flexDirection: 'row', gap: 20, marginTop: 12, justifyContent: 'center' },
  lock: { fontSize: 16, fontWeight: '900', opacity: 0.55 },
  body: { color: C.sub, fontSize: 14, lineHeight: 20, marginTop: 10 },
  onCard: { borderColor: C.goldDark, paddingVertical: 12 },
  onText: { color: C.gold, fontSize: 14, fontWeight: '800', lineHeight: 20, textAlign: 'center' },
});

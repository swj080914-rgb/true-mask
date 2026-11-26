import { Share, StyleSheet, Text, View } from 'react-native';
import type { Game } from '../useGame';
import { MAX_QUESTIONS, MIN_PLAYERS, MIN_QUESTIONS, type RoomState } from '../protocol';
import { Button, C, Card, Character, DISPLAY_FONT, Label, Segmented, avatarColor } from '../ui';
import { PremiumCard } from './PremiumCard';

export function LobbyScreen({ game, state, isHost }: { game: Game; state: RoomState; isHost: boolean }) {
  const online = state.players.filter((p) => p.connected).length;
  const canStart = online >= MIN_PLAYERS;

  const share = () =>
    Share.share({ message: `TRUE MASK 방에 들어와! 🎭 방 코드: ${state.code}` }).catch(() => {});

  return (
    <View style={s.wrap}>
      <Card style={s.codeCard}>
        <Text style={s.codeLabel}>ROOM CODE</Text>
        <Text testID="room-code" style={s.code} selectable>{state.code}</Text>
        <Button title="코드 공유하기" kind="secondary" onPress={share} style={{ marginTop: 14, alignSelf: 'stretch' }} />
      </Card>

      <Card>
        <View style={s.headRow}>
          <Label>참가자</Label>
          <Text style={s.count}>
            <Text style={{ color: canStart ? C.yes : C.gold }}>{online}</Text>
            <Text style={{ color: C.sub }}> / {MIN_PLAYERS}+</Text>
          </Text>
        </View>
        <View style={s.grid}>
          {state.players.map((p, i) => {
            const me = p.id === game.playerId;
            return (
              <View key={p.id} style={s.player}>
                {p.isHost && <Text style={s.crown}>👑</Text>}
                <Character kind="anon" color={avatarColor(i)} size={56} bg={C.inset} ring={C.cardBorder} dim={!p.connected} />
                <Text style={[s.name, me && { color: C.gold }]} numberOfLines={1}>
                  {p.nickname}
                </Text>
                {me && <Text style={s.meTag}>나</Text>}
              </View>
            );
          })}
          {Array.from({ length: Math.max(0, MIN_PLAYERS - state.players.length) }, (_, i) => (
            <View key={`empty-${i}`} style={s.player}>
              <View style={s.emptySeat}><Text style={s.emptyQ}>?</Text></View>
              <Text style={[s.name, { color: C.sub }]}>기다리는 중</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <Label>질문 수</Label>
        <Segmented
          disabled={!isHost}
          options={Array.from({ length: MAX_QUESTIONS - MIN_QUESTIONS + 1 }, (_, i) => ({
            value: MIN_QUESTIONS + i,
            label: String(MIN_QUESTIONS + i),
          }))}
          value={state.questionCount}
          onChange={(questionCount) => game.updateSettings({ questionCount })}
        />
        {!isHost && <Text style={s.hint}>설정은 방장만 바꿀 수 있어요.</Text>}
      </Card>
      <PremiumCard game={game} state={state} />

      {isHost ? (
        <>
          <Button testID="start" title="게임 시작" onPress={game.start} disabled={!canStart} loading={game.busy} />
          {!canStart && (
            <Text style={s.center}>
              익명성을 위해 {MIN_PLAYERS}명 이상 필요해요 ({online}/{MIN_PLAYERS})
            </Text>
          )}
        </>
      ) : (
        <Text style={s.center}>방장이 게임을 시작하길 기다리는 중…</Text>
      )}
      <Button title="방 나가기" kind="ghost" onPress={game.leave} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 16 },
  codeCard: { alignItems: 'center', borderColor: C.accent },
  codeLabel: { fontFamily: DISPLAY_FONT, color: C.sub, fontSize: 15, letterSpacing: 3 },
  code: {
    fontFamily: DISPLAY_FONT, color: C.gold, fontSize: 56, letterSpacing: 10, marginVertical: 4,
    textShadowColor: C.accentDark, textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 0,
  },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  count: { fontFamily: DISPLAY_FONT, fontSize: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 18, marginTop: 14 },
  player: { width: '25%', alignItems: 'center', gap: 6 },
  crown: { position: 'absolute', top: -14, zIndex: 1, fontSize: 18 },
  name: { color: C.text, fontSize: 13, fontWeight: '800', maxWidth: '92%' },
  meTag: {
    color: '#2A1A00', backgroundColor: C.gold, fontSize: 10, fontWeight: '900', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden', marginTop: -2,
  },
  emptySeat: {
    width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: C.cardBorder, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  emptyQ: { fontFamily: DISPLAY_FONT, color: C.cardBorder, fontSize: 22 },
  hint: { color: C.sub, fontSize: 12, marginTop: 14 },
  center: { color: C.sub, textAlign: 'center' },
});

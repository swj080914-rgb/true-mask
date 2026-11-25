import { Share, StyleSheet, Text, View } from 'react-native';
import type { Game } from '../useGame';
import { MAX_QUESTIONS, MIN_PLAYERS, MIN_QUESTIONS, type Mode, type RoomState } from '../protocol';
import { Button, C, Card, Label, MODE_LABEL, Segmented } from '../ui';
import { PremiumCard } from './PremiumCard';

export function LobbyScreen({ game, state, isHost }: { game: Game; state: RoomState; isHost: boolean }) {
  const online = state.players.filter((p) => p.connected).length;
  const canStart = online >= MIN_PLAYERS;

  const share = () =>
    Share.share({ message: `트루 마스크 방에 들어와! 방 코드: ${state.code}` }).catch(() => {});

  return (
    <View style={s.wrap}>
      <Card style={{ alignItems: 'center' }}>
        <Text style={s.codeLabel}>방 코드</Text>
        <Text testID="room-code" style={s.code} selectable>{state.code}</Text>
        <Text style={s.sub}>친구들에게 이 코드를 알려주세요</Text>
        <Button title="코드 공유하기" kind="secondary" onPress={share} style={{ marginTop: 14, alignSelf: 'stretch' }} />
      </Card>

      <Card>
        <Label>참가자 {state.players.length}명</Label>
        {state.players.map((p) => (
          <View key={p.id} style={s.player}>
            <View style={[s.dot, { backgroundColor: p.connected ? '#4ADE80' : C.sub }]} />
            <Text style={s.name}>
              {p.nickname}
              {p.id === game.playerId ? ' (나)' : ''}
            </Text>
            {p.isHost && <Text style={s.host}>방장</Text>}
          </View>
        ))}
      </Card>

      <Card>
        <Label>모드</Label>
        <Segmented
          disabled={!isHost}
          options={(['mixed', 'male', 'female'] as Mode[]).map((m) => ({ value: m, label: MODE_LABEL[m] }))}
          value={state.mode}
          onChange={(mode) => game.updateSettings({ mode })}
        />
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

      {state.mode === 'mixed' && <PremiumCard game={game} state={state} isHost={isHost} />}

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
  codeLabel: { color: C.sub, fontSize: 13, fontWeight: '600' },
  code: { color: C.text, fontSize: 48, fontWeight: '800', letterSpacing: 10, marginVertical: 6 },
  sub: { color: C.sub, fontSize: 14 },
  player: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  name: { color: C.text, fontSize: 16, flex: 1 },
  host: {
    color: C.gold, fontSize: 12, fontWeight: '700', borderWidth: 1, borderColor: C.gold,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden',
  },
  hint: { color: C.sub, fontSize: 12, marginTop: 8 },
  center: { color: C.sub, textAlign: 'center' },
});

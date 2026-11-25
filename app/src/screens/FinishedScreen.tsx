import { StyleSheet, Text, View } from 'react-native';
import type { Game } from '../useGame';
import type { RoomState } from '../protocol';
import { Button, C } from '../ui';
import { ResultView } from './GameScreen';

export function FinishedScreen({ game, state, isHost }: { game: Game; state: RoomState; isHost: boolean }) {
  return (
    <View style={s.wrap}>
      <Text style={s.logo}>🎭</Text>
      <Text style={s.title}>가면을 벗을 시간</Text>
      <Text style={s.sub}>누가 “예”라고 했을지는 각자의 상상에 맡길게요.</Text>
      {state.history.map((r, i) => (
        <ResultView key={i} result={r} compact />
      ))}
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
  logo: { fontSize: 48, textAlign: 'center', marginTop: 8 },
  title: { color: C.text, fontSize: 26, fontWeight: '800', textAlign: 'center' },
  sub: { color: C.sub, fontSize: 14, textAlign: 'center', marginBottom: 4 },
});

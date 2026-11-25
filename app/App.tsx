import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useGame } from './src/useGame';
import { C } from './src/ui';
import { HomeScreen } from './src/screens/HomeScreen';
import { LobbyScreen } from './src/screens/LobbyScreen';
import { GameScreen } from './src/screens/GameScreen';
import { FinishedScreen } from './src/screens/FinishedScreen';

export default function App() {
  const game = useGame();
  const { state } = game;
  const isHost = !!state && state.players.some((p) => p.id === game.playerId && p.isHost);

  // 화면은 서버가 보내주는 방 상태(phase)를 그대로 따라간다
  let screen;
  if (!state && game.restoring) screen = <ActivityIndicator color={C.accent} style={{ marginTop: 120 }} />;
  else if (!state) screen = <HomeScreen game={game} />;
  else if (state.phase === 'lobby') screen = <LobbyScreen game={game} state={state} isHost={isHost} />;
  else if (state.phase === 'finished') screen = <FinishedScreen game={game} state={state} isHost={isHost} />;
  else screen = <GameScreen game={game} state={state} isHost={isHost} />;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.root}>
        <StatusBar style="light" />
        {state && !game.connected && (
          <View style={s.banner}>
            <Text style={s.bannerText}>연결이 끊겼어요. 다시 연결하는 중…</Text>
          </View>
        )}
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            <View style={s.inner}>{screen}</View>
          </ScrollView>
        </KeyboardAvoidingView>
        {game.error && (
          <Pressable testID="error" style={s.toast} onPress={game.clearError}>
            <Text style={s.toastText}>{game.error}</Text>
            <Text style={s.toastClose}>닫기</Text>
          </Pressable>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, padding: 16, paddingBottom: 40 },
  inner: { width: '100%', maxWidth: 480, alignSelf: 'center' },
  banner: { backgroundColor: C.accentDim, padding: 8 },
  bannerText: { color: C.text, textAlign: 'center', fontSize: 13 },
  toast: {
    position: 'absolute', left: 16, right: 16, bottom: 24, backgroundColor: C.danger, borderRadius: 14,
    padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  toastText: { color: '#fff', flex: 1, fontWeight: '600' },
  toastClose: { color: '#fff', opacity: 0.8 },
});

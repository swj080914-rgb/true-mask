import { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, LilitaOne_400Regular } from '@expo-google-fonts/lilita-one';
import { useGame } from './src/useGame';
import { C, StarField } from './src/ui';
import { HomeScreen } from './src/screens/HomeScreen';
import { LobbyScreen } from './src/screens/LobbyScreen';
import { GameScreen } from './src/screens/GameScreen';
import { FinishedScreen } from './src/screens/FinishedScreen';
import { Intro } from './src/Intro';

// 폰트와 저장된 방 확인이 끝날 때까지 폰의 로딩 화면(스플래시)을 유지한다
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const game = useGame();
  // 폰트가 늦게 오거나 실패해도 앱은 시스템 글꼴로 바로 뜬다
  const [fontsLoaded, fontError] = useFonts({ LilitaOne_400Regular });
  const { state } = game;
  const isHost = !!state && state.players.some((p) => p.id === game.playerId && p.isHost);
  const ready = (fontsLoaded || !!fontError) && !game.restoring;
  const [introDone, setIntroDone] = useState(false);
  const finishIntro = useCallback(() => setIntroDone(true), []);

  // 준비되면 정지된 로딩 화면을 내리고, 그 자리에서 Intro 가 이어서 윙크한다
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // 화면은 서버가 보내주는 방 상태(phase)를 그대로 따라간다
  let screen;
  if (!ready) screen = null;
  else if (!state) screen = <HomeScreen game={game} />;
  else if (state.phase === 'lobby') screen = <LobbyScreen game={game} state={state} isHost={isHost} />;
  else if (state.phase === 'finished') screen = <FinishedScreen game={game} state={state} isHost={isHost} />;
  else screen = <GameScreen game={game} state={state} isHost={isHost} />;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.root}>
        <StarField />
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
      {/* 안전 영역 밖, 화면 전체 기준으로 가운데: 폰 로딩 화면과 같은 자리 */}
      {!introDone && <Intro ready={ready} onDone={finishIntro} />}
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, padding: 16, paddingBottom: 40 },
  inner: { width: '100%', maxWidth: 480, alignSelf: 'center' },
  banner: { backgroundColor: C.accentDark, padding: 8 },
  bannerText: { color: C.text, textAlign: 'center', fontSize: 13 },
  toast: {
    position: 'absolute', left: 16, right: 16, bottom: 24, backgroundColor: C.danger, borderRadius: 16, borderBottomWidth: 4, borderBottomColor: C.noDark,
    padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  toastText: { color: '#fff', flex: 1, fontWeight: '600' },
  toastClose: { color: '#fff', opacity: 0.8 },
});

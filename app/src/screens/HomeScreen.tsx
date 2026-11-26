import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Game } from '../useGame';
import { MAX_QUESTIONS, MIN_PLAYERS, MIN_QUESTIONS, type Gender } from '../protocol';
import { Button, C, Card, Character, DISPLAY_FONT, Label, ModeGuide, Segmented } from '../ui';

const QUESTION_OPTIONS = Array.from({ length: MAX_QUESTIONS - MIN_QUESTIONS + 1 }, (_, i) => {
  const n = MIN_QUESTIONS + i;
  return { value: n, label: `${n}` };
});

/** 첫 화면에서 돌아가며 보여줄 예시 (실제 질문 목록에서 골랐다) */
const TEASERS = [
  { q: '이 방에 좋아하는 사람이 있다', yes: 3, total: 6 },
  { q: '이 방의 누군가를 질투해 본 적이 있다', yes: 5, total: 7 },
  { q: '이 방의 누군가에게 말 못 한 비밀이 있다', yes: 4, total: 5 },
  { q: '이 모임에 나오기 싫었던 날이 있다', yes: 2, total: 6 },
];

const NATIVE_DRIVER = Platform.OS !== 'web';

/** 질문 하나가 올라오고 → 결과 숫자가 뜨고 → 다음 질문으로 넘어가는 짧은 미리보기 */
function Teaser() {
  const [i, setI] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fade.setValue(0);
    pop.setValue(0);
    const anim = Animated.sequence([
      Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: NATIVE_DRIVER }),
      Animated.delay(700),
      Animated.spring(pop, { toValue: 1, friction: 5, tension: 120, useNativeDriver: NATIVE_DRIVER }),
      Animated.delay(1900),
      Animated.timing(fade, { toValue: 0, duration: 300, useNativeDriver: NATIVE_DRIVER }),
    ]);
    anim.start(({ finished }) => finished && setI((n) => (n + 1) % TEASERS.length));
    return () => anim.stop();
  }, [i, fade, pop]);

  const t = TEASERS[i];
  return (
    <Animated.View
      style={[
        s.teaser,
        { opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] },
      ]}
    >
      <Text style={s.teaserQ} numberOfLines={2}>Q. {t.q}?</Text>
      <Animated.View style={[s.teaserResult, { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]}>
        <Text style={s.teaserNum}>{t.yes}</Text>
        <Text style={s.teaserOf}> / {t.total}명이 “예”</Text>
      </Animated.View>
    </Animated.View>
  );
}

export function HomeScreen({ game }: { game: Game }) {
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [nickname, setNickname] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [count, setCount] = useState(6);
  const [code, setCode] = useState('');

  const ready = nickname.trim().length > 0 && gender !== null;

  const submit = () => {
    if (!gender) return;
    if (tab === 'create') game.createRoom({ nickname: nickname.trim(), gender, questionCount: count });
    else game.joinRoom({ code: code.trim().toUpperCase(), nickname: nickname.trim(), gender });
  };

  return (
    <View style={s.wrap}>
      <View style={s.hero}>
        <View style={s.logoRing}>
          <Text style={s.logo}>🎭</Text>
        </View>
        <Text style={s.title} accessibilityRole="header">TRUE MASK</Text>
        <Text style={s.tagline}>가면을 쓰면, 진심이 나온다</Text>
        <Text style={s.taglineSub}>
          누가 눌렀는지는 아무도 몰라요.{'\n'}몇 명이 “예”라고 했는지만 공개돼요.
        </Text>
        <Teaser />
      </View>

      <Card>
        <Label>닉네임</Label>
        <TextInput
          testID="nickname"
          value={nickname}
          onChangeText={setNickname}
          placeholder="친구들이 알아볼 이름"
          placeholderTextColor={C.sub}
          maxLength={12}
          style={s.input}
        />
        <Text style={[s.hint, { marginTop: 0, marginBottom: 12 }]}>🔒 투표 결과엔 이름이 나오지 않아요.</Text>

        <Label>성별</Label>
        <Segmented
          options={[
            { value: 'M' as Gender, label: '남자', icon: <Character kind="male" color={C.male} size={64} ring={C.maleDark} />, color: C.male, edge: C.maleDark },
            { value: 'F' as Gender, label: '여자', icon: <Character kind="female" color={C.female} size={64} ring={C.femaleDark} />, color: C.female, edge: C.femaleDark },
          ]}
          value={gender}
          onChange={setGender}
        />
        <View style={{ marginTop: 12 }}>
          <ModeGuide />
        </View>
        <Text style={s.hint}>🔒 성별은 다른 사람에게 보이지 않아요.</Text>
      </Card>

      <Card style={{ gap: 4 }}>
        <Segmented
          options={[{ value: 'create', label: '방 만들기' }, { value: 'join', label: '코드로 입장' }]}
          value={tab}
          onChange={setTab}
        />
        {tab === 'create' ? (
          <View style={{ marginTop: 12 }}>
            <Label>질문 수</Label>
            <Segmented options={QUESTION_OPTIONS} value={count} onChange={setCount} />
            <Text style={s.hint}>최소 {MIN_PLAYERS}명이 모이면 시작할 수 있어요.</Text>
          </View>
        ) : (
          <View style={{ marginTop: 12 }}>
            <Label>방 코드</Label>
            <TextInput
              testID="code"
              value={code}
              onChangeText={(t) => setCode(t.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
              placeholder="ABCDE"
              placeholderTextColor={C.cardBorder}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={5}
              style={[s.input, s.codeInput]}
            />
          </View>
        )}
      </Card>

      <Button
        testID="submit"
        title={tab === 'create' ? '방 만들기' : '입장하기'}
        onPress={submit}
        disabled={!ready || !game.connected || (tab === 'join' && code.length !== 5)}
        loading={game.busy}
      />
      {!game.connected && <Text style={s.offline}>서버에 연결하는 중…</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 16 },
  hero: { alignItems: 'center', paddingTop: 16, paddingBottom: 4 },
  logoRing: {
    width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.accentDim, borderWidth: 3, borderColor: C.accent,
    shadowColor: C.accent, shadowOpacity: 0.8, shadowRadius: 24, shadowOffset: { width: 0, height: 0 },
  },
  logo: { fontSize: 54 },
  title: {
    fontFamily: DISPLAY_FONT, color: C.gold, fontSize: 54, marginTop: 14, letterSpacing: 1.5,
    textShadowColor: C.accentDark, textShadowOffset: { width: 0, height: 5 }, textShadowRadius: 0,
  },
  tagline: { color: C.text, fontSize: 22, fontWeight: '900', marginTop: 6, letterSpacing: -0.5 },
  taglineSub: { color: C.sub, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 21 },
  teaser: {
    marginTop: 18, alignSelf: 'stretch', backgroundColor: C.inset, borderRadius: 20, borderWidth: 2,
    borderColor: C.cardBorder, borderStyle: 'dashed', paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center',
    minHeight: 96, justifyContent: 'center',
  },
  teaserQ: { color: C.text, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  teaserResult: { flexDirection: 'row', alignItems: 'baseline', marginTop: 8 },
  teaserNum: { fontFamily: DISPLAY_FONT, color: C.yes, fontSize: 30 },
  teaserOf: { color: C.sub, fontSize: 14, fontWeight: '700' },
  input: {
    backgroundColor: C.inset, color: C.text, fontSize: 17, fontWeight: '700', borderRadius: 14,
    borderWidth: 2, borderColor: C.cardBorder, paddingHorizontal: 14, minHeight: 52, marginBottom: 10,
  },
  codeInput: { fontFamily: DISPLAY_FONT, fontSize: 32, letterSpacing: 10, textAlign: 'center', fontWeight: '400' },
  hint: { color: C.sub, fontSize: 12, marginTop: 10 },
  offline: { color: C.sub, textAlign: 'center' },
});

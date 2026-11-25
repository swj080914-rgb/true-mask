import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { Game } from '../useGame';
import { MAX_QUESTIONS, MIN_PLAYERS, MIN_QUESTIONS, type Gender, type Mode } from '../protocol';
import { Button, C, Card, Label, Segmented } from '../ui';

const QUESTION_OPTIONS = Array.from({ length: MAX_QUESTIONS - MIN_QUESTIONS + 1 }, (_, i) => {
  const n = MIN_QUESTIONS + i;
  return { value: n, label: `${n}` };
});

export function HomeScreen({ game }: { game: Game }) {
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [nickname, setNickname] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [mode, setMode] = useState<Mode>('mixed');
  const [count, setCount] = useState(6);
  const [code, setCode] = useState('');

  const ready = nickname.trim().length > 0 && gender !== null;

  const submit = () => {
    if (!gender) return;
    if (tab === 'create') game.createRoom({ nickname: nickname.trim(), gender, mode, questionCount: count });
    else game.joinRoom({ code: code.trim().toUpperCase(), nickname: nickname.trim(), gender });
  };

  return (
    <View style={s.wrap}>
      <View style={s.hero}>
        <Text style={s.logo}>🎭</Text>
        <Text style={s.title}>트루 마스크</Text>
        <Text style={s.tagline}>누가 눌렀는지는 아무도 몰라요.{'\n'}몇 명이 “예”라고 했는지만 알려드려요.</Text>
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
        <Label>성별</Label>
        <Segmented
          options={[{ value: 'M' as Gender, label: '남자' }, { value: 'F' as Gender, label: '여자' }]}
          value={gender}
          onChange={setGender}
        />
        <Text style={s.hint}>성별은 다른 사람에게 표시되지 않아요.</Text>
      </Card>

      <Card style={{ gap: 4 }}>
        <Segmented
          options={[{ value: 'create', label: '방 만들기' }, { value: 'join', label: '코드로 입장' }]}
          value={tab}
          onChange={setTab}
        />
        {tab === 'create' ? (
          <View style={{ marginTop: 12 }}>
            <Label>모드</Label>
            <Segmented
              options={[
                { value: 'mixed' as Mode, label: '혼성' },
                { value: 'male' as Mode, label: '남자만' },
                { value: 'female' as Mode, label: '여자만' },
              ]}
              value={mode}
              onChange={setMode}
            />
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
              placeholderTextColor={C.sub}
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
  hero: { alignItems: 'center', paddingVertical: 20 },
  logo: { fontSize: 64 },
  title: { color: C.text, fontSize: 32, fontWeight: '800', marginTop: 8, letterSpacing: -0.5 },
  tagline: { color: C.sub, fontSize: 15, textAlign: 'center', marginTop: 10, lineHeight: 22 },
  input: {
    backgroundColor: C.bg, color: C.text, fontSize: 17, borderRadius: 12,
    paddingHorizontal: 14, minHeight: 50, marginBottom: 12,
  },
  codeInput: { fontSize: 26, letterSpacing: 8, textAlign: 'center', fontWeight: '700' },
  hint: { color: C.sub, fontSize: 12, marginTop: 8 },
  offline: { color: C.sub, textAlign: 'center' },
});

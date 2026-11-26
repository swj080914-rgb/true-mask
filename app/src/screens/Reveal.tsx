import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import type { QuestionResult } from '../protocol';
import { C, Card, DISPLAY_FONT } from '../ui';
import { Mascot } from '../Mascot';

const STEP_MS = 650; // 카운트다운 한 칸
const COUNT_MS = 1100; // 숫자 올라가는 시간

/**
 * 결과를 바로 보여주지 않고 뜸을 들인다.
 * 1) 가면이 덜덜 떨면서 3 · 2 · 1
 * 2) 숫자가 0부터 올라가며 막대가 찬다
 * 3) 다 끝나면 onDone (그때 "다음 질문" 버튼과 남녀 인원이 나온다)
 */
export function Reveal({ result, onDone }: { result: QuestionResult; onDone: () => void }) {
  const [step, setStep] = useState<3 | 2 | 1 | 0>(3);
  const pop = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => {
        if (alive && reduce) {
          setStep(0);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // 가면 덜덜
  useEffect(() => {
    if (step === 0) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 120, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [step === 0, shake]);

  // 3 → 2 → 1 → 0
  useEffect(() => {
    if (step === 0) return;
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start();
    const t = setTimeout(() => setStep((s) => (s - 1) as 3 | 2 | 1 | 0), STEP_MS);
    return () => clearTimeout(t);
  }, [step, pop]);

  if (step > 0) {
    const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [1.8, 1] });
    const rotate = shake.interpolate({ inputRange: [-1, 1], outputRange: ['-6deg', '6deg'] });
    return (
      <Card style={s.drum}>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Mascot width={110} expression="blink" animated={false} />
        </Animated.View>
        <Animated.Text testID="countdown" style={[s.count, { opacity: pop, transform: [{ scale }] }]}>
          {step}
        </Animated.Text>
        <Text style={s.drumText}>두구두구… 몇 명이 “예”라고 했을까?</Text>
      </Card>
    );
  }
  return <CountUp result={result} onDone={() => done.current()} />;
}

/** 숫자가 0부터 올라가고 막대가 차오른다 */
function CountUp({ result, onDone }: { result: QuestionResult; onDone: () => void }) {
  const v = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const id = v.addListener(({ value }) => setShown(Math.round(value)));
    Animated.sequence([
      Animated.timing(v, {
        toValue: result.yes,
        duration: result.yes === 0 ? 300 : COUNT_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.spring(pop, { toValue: 1, friction: 3, tension: 140, useNativeDriver: false }),
    ]).start(() => onDone());
    return () => v.removeListener(id);
  }, []);

  const width = v.interpolate({
    inputRange: [0, Math.max(1, result.total)],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });
  const scale = pop.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.25, 1] });

  return (
    <Card style={{ alignItems: 'center' }}>
      <Animated.Text testID="yes-count" style={[s.big, { transform: [{ scale }] }]}>
        <Text style={{ color: C.yes }}>{shown}</Text>
        <Text style={s.unit}>명</Text>
      </Animated.Text>
      <Text style={s.sub}>{result.total}명 중 “예”라고 답한 사람</Text>
      <View style={s.bar}>
        <Animated.View style={[s.barFill, { width }]} />
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  drum: { alignItems: 'center', paddingVertical: 22, borderColor: C.gold },
  count: { fontFamily: DISPLAY_FONT, color: C.gold, fontSize: 84, lineHeight: 92, marginTop: 4 },
  drumText: { color: C.sub, fontSize: 15, fontWeight: '700', marginTop: 4 },
  big: { fontFamily: DISPLAY_FONT, fontSize: 88, lineHeight: 96 },
  unit: { color: C.text, fontSize: 28, fontWeight: '900' },
  sub: { color: C.sub, fontSize: 14, textAlign: 'center', marginTop: 6 },
  bar: { height: 14, backgroundColor: C.inset, borderRadius: 7, alignSelf: 'stretch', marginTop: 14, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: C.yes, borderRadius: 7 },
});

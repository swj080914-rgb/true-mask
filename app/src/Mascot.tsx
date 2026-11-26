import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { mascotSvg, type MascotExpression } from './mascotArt';

/** 움직임 줄이기 설정을 따른다 */
function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReduce(v)).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

/**
 * 둥실 떠다니는 흰 가면. 가끔 눈을 깜빡이고, 아주 가끔 윙크한다.
 * expression 을 주면 그 표정으로 고정한다.
 */
export function Mascot({ width = 180, expression, animated = true }: { width?: number; expression?: MascotExpression; animated?: boolean }) {
  const reduce = useReduceMotion();
  const move = animated && !reduce;
  const float = useRef(new Animated.Value(0)).current;
  const [face, setFace] = useState<MascotExpression>('smile');

  // 위아래로 둥실
  useEffect(() => {
    if (!move) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [move, float]);

  // 몇 초에 한 번 깜빡, 가끔 윙크
  useEffect(() => {
    if (!move || expression) return;
    let n = 0;
    let back: ReturnType<typeof setTimeout> | undefined;
    const timer = setInterval(() => {
      n += 1;
      setFace(n % 3 === 0 ? 'wink' : 'blink');
      back = setTimeout(() => setFace('smile'), n % 3 === 0 ? 900 : 160);
    }, 3200);
    return () => {
      clearInterval(timer);
      if (back) clearTimeout(back);
    };
  }, [move, expression]);

  const height = (width * 200) / 240;
  const lift = float.interpolate({ inputRange: [0, 1], outputRange: [0, -height * 0.07] });
  const shadowScale = float.interpolate({ inputRange: [0, 1], outputRange: [1, 0.85] });

  return (
    <View style={{ width, height }} accessibilityRole="image" accessibilityLabel="트루 마스크 가면">
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scaleX: shadowScale }] }]}>
        <SvgXml xml={SHADOW} width={width} height={height} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: lift }] }]}>
        <SvgXml xml={mascotSvg({ expression: expression ?? face })} width={width} height={height} />
      </Animated.View>
    </View>
  );
}

const SHADOW =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 200"><ellipse cx="120" cy="188" rx="62" ry="7" fill="#000" opacity="0.3"/></svg>';

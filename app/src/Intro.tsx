import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { mascotSvg, SPLASH_VIEWBOX } from './mascotArt';
import { C } from './ui';

/** 스플래시 이미지 너비 (app.json 의 expo-splash-screen imageWidth 와 같아야 이어져 보인다) */
export const SPLASH_IMAGE_WIDTH = 200;

/**
 * 폰의 로딩 화면(정지 그림)이 사라진 자리에 똑같은 화면을 이어 띄우고,
 * 가면이 윙크한 뒤 사라진다. 로딩 화면은 움직일 수 없어서 이렇게 이어 붙인다.
 */
export function Intro({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const fade = useRef(new Animated.Value(1)).current;
  const [face, setFace] = useState<'smile' | 'wink'>('smile');

  useEffect(() => {
    if (!ready) return;
    const t1 = setTimeout(() => setFace('wink'), 120);
    const t2 = setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: 260, useNativeDriver: true }).start(() => onDone());
    }, 720);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [ready, fade, onDone]);

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, s.wrap, { opacity: fade }]}>
      <SvgXml
        xml={mascotSvg({ expression: face, viewBox: SPLASH_VIEWBOX })}
        width={SPLASH_IMAGE_WIDTH}
        height={SPLASH_IMAGE_WIDTH}
      />
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', zIndex: 100 },
});

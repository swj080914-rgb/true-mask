import { Pressable, StyleSheet, Text } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { goldMaskSvg } from './mascotArt';
import { C, DISPLAY_FONT } from './ui';

const ON_SVG = goldMaskSvg(true);
const OFF_SVG = goldMaskSvg(false);

/**
 * GOLD MASK 배지: 왕관 쓴 가면 + "GOLD MASK" 글자, 금색 테두리.
 * on 이면 금색, 아니면 회색. onPress 가 있으면 버튼으로 동작한다.
 */
export function GoldMask({ on, size = 'lg', onPress, testID }: {
  on: boolean;
  size?: 'lg' | 'sm';
  onPress?: () => void;
  testID?: string;
}) {
  const lg = size === 'lg';
  const w = lg ? 120 : 64;
  return (
    <Pressable
      testID={testID}
      accessibilityRole={onPress ? 'button' : 'image'}
      accessibilityState={{ checked: on }}
      accessibilityLabel={on ? 'GOLD MASK 켜짐' : 'GOLD MASK 꺼짐'}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        s.box,
        lg ? s.lg : s.sm,
        on && s.boxOn,
        pressed && { transform: [{ scale: 0.95 }] },
      ]}
    >
      <SvgXml xml={on ? ON_SVG : OFF_SVG} width={w} height={(w * 190) / 240} />
      <Text style={[s.name, { fontSize: lg ? 26 : 14 }, !on && s.nameOff]}>GOLD MASK</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  box: {
    alignSelf: 'center', alignItems: 'center', borderWidth: 3, borderColor: C.gold, borderBottomWidth: 6,
    borderBottomColor: C.goldDark, backgroundColor: C.card,
  },
  boxOn: { backgroundColor: '#2A1F3F' },
  lg: { borderRadius: 24, paddingHorizontal: 28, paddingTop: 14, paddingBottom: 10 },
  sm: { borderRadius: 16, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 6, borderWidth: 2, borderBottomWidth: 4 },
  name: { fontFamily: DISPLAY_FONT, color: C.gold, letterSpacing: 1, marginTop: 2 },
  nameOff: { color: '#7A7299' },
});

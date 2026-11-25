import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { Mode } from './protocol';

export const C = {
  bg: '#14101F',
  card: '#221A33',
  cardBorder: '#33284A',
  text: '#F4F0FA',
  sub: '#A89BBF',
  accent: '#FF4D8D',
  accentDim: '#5A2440',
  yes: '#FF4D8D',
  no: '#5B6CFF',
  gold: '#FFC857',
  male: '#5B9BFF',
  female: '#FF7AB6',
  danger: '#FF6B6B',
};

export const MODE_LABEL: Record<Mode, string> = {
  mixed: '혼성',
  male: '남자만',
  female: '여자만',
};

type BtnKind = 'primary' | 'secondary' | 'ghost' | 'gold';

export function Button({
  title, onPress, kind = 'primary', disabled, loading, style, testID,
}: {
  title: string;
  onPress: () => void;
  kind?: BtnKind;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const bg = { primary: C.accent, secondary: C.card, ghost: 'transparent', gold: C.gold }[kind];
  const fg = kind === 'gold' ? '#2A1A00' : C.text;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
        kind === 'secondary' && { borderWidth: 1, borderColor: C.cardBorder },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[s.btnText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

/** 여러 개 중 하나를 고르는 토글 버튼 묶음 */
export function Segmented<T extends string | number>({
  options, value, onChange, disabled,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <View style={s.seg}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            disabled={disabled}
            onPress={() => onChange(o.value)}
            style={[s.segItem, on && s.segOn, disabled && !on && { opacity: 0.5 }]}
          >
            <Text style={[s.segText, on && { color: C.text, fontWeight: '700' }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={s.label}>{children}</Text>;
}

const s = StyleSheet.create({
  btn: { minHeight: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  btnText: { fontSize: 17, fontWeight: '700' },
  card: { backgroundColor: C.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: C.cardBorder },
  seg: { flexDirection: 'row', backgroundColor: C.bg, borderRadius: 14, padding: 4, gap: 4 },
  segItem: { flex: 1, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: C.accentDim },
  segText: { color: C.sub, fontSize: 15 },
  label: { color: C.sub, fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 4 },
});

import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import type { Mode } from './protocol';

/**
 * 디자인 방향: 밤하늘 배경 + 두툼한 3D 버튼 + 굵고 둥근 글씨 (파티 게임 느낌)
 * - 버튼·선택지는 아래쪽에 진한 테두리를 깔아 "눌리는" 입체감을 준다.
 * - 파랑/분홍은 성별 표시에만 쓴다. 다른 곳(투표 버튼, 아바타)에 쓰면 성별을 떠올리게 하므로 피한다.
 */
export const C = {
  bg: '#110B22',
  bgDeep: '#0A0616',
  card: '#1F1641',
  cardBorder: '#33286A',
  inset: '#160F30',
  text: '#FFFFFF',
  sub: '#A99CCF',
  accent: '#7C4DFF',
  accentDark: '#4F2BC4',
  accentDim: '#2C2163',
  yes: '#22D39B',
  yesDark: '#11946B',
  no: '#FF5D73',
  noDark: '#C23149',
  gold: '#FFC83D',
  goldDark: '#C48F0F',
  male: '#3D8BFF',
  maleDark: '#2160C9',
  female: '#FF6FB5',
  femaleDark: '#C9428A',
  online: '#4ADE80',
  danger: '#FF5D73',
};

/** 영어 제목·숫자용 게임 폰트 (한글은 시스템 굵은 글꼴을 쓴다) */
export const DISPLAY_FONT = 'LilitaOne_400Regular';

/** 참가자 아바타 색. 성별을 떠올리게 하는 파랑/분홍은 일부러 뺐다 */
const AVATAR_COLORS = ['#FFC83D', '#22D39B', '#FF8A3D', '#B47CFF', '#3DE0E0', '#C6F04A', '#FF5D73', '#E8E3F5'];
export const avatarColor = (i: number) => AVATAR_COLORS[i % AVATAR_COLORS.length];

export const MODE_LABEL: Record<Mode, string> = {
  mixed: '혼성',
  male: '남자만',
  female: '여자만',
};

type BtnKind = 'primary' | 'secondary' | 'ghost' | 'gold' | 'yes' | 'no';

const BTN_COLORS: Record<BtnKind, { bg: string; edge: string; fg: string }> = {
  primary: { bg: C.accent, edge: C.accentDark, fg: C.text },
  secondary: { bg: C.card, edge: C.cardBorder, fg: C.text },
  ghost: { bg: 'transparent', edge: 'transparent', fg: C.sub },
  gold: { bg: C.gold, edge: C.goldDark, fg: '#2A1A00' },
  yes: { bg: C.yes, edge: C.yesDark, fg: '#03251A' },
  no: { bg: C.no, edge: C.noDark, fg: C.text },
};

const EDGE = 5;

export function Button({
  title, onPress, kind = 'primary', disabled, loading, style, textStyle, testID,
}: {
  title: string;
  onPress: () => void;
  kind?: BtnKind;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
}) {
  const c = BTN_COLORS[kind];
  const flat = kind === 'ghost';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => {
        const down = pressed && !flat ? EDGE - 1 : 0;
        return [
          s.btn,
          {
            backgroundColor: c.bg,
            borderBottomWidth: flat ? 0 : EDGE - down,
            borderBottomColor: c.edge,
            marginTop: down,
            opacity: disabled ? 0.4 : 1,
          },
          kind === 'secondary' && { borderWidth: 2, borderColor: C.cardBorder },
          style,
        ];
      }}
    >
      {loading ? (
        <ActivityIndicator color={c.fg} />
      ) : (
        <Text style={[s.btnText, flat && s.ghostText, { color: c.fg }, textStyle]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export type SegOption<T> = { value: T; label: string; icon?: ReactNode; color?: string; edge?: string };

/** 여러 개 중 하나를 고르는 두툼한 선택 버튼 묶음 */
export function Segmented<T extends string | number>({
  options, value, onChange, disabled,
}: {
  options: SegOption<T>[];
  value: T | null;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <View style={s.seg}>
      {options.map((o) => {
        const on = o.value === value;
        const color = o.color ?? C.accent;
        const edge = o.edge ?? C.accentDark;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="button"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on }}
            disabled={disabled}
            onPress={() => onChange(o.value)}
            style={[
              s.segItem,
              o.icon ? s.segItemTall : null,
              on
                ? { backgroundColor: color, borderColor: color, borderBottomColor: edge }
                : { backgroundColor: C.inset, borderColor: C.cardBorder, borderBottomColor: C.cardBorder },
              disabled && !on && { opacity: 0.5 },
            ]}
          >
            {o.icon}
            <Text style={[s.segText, on && s.segTextOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={s.label}>{children}</Text>;
}

/* ───────── 그림 요소 (이미지 파일 없이 도형으로 그린다) ───────── */

/** 사람 실루엣. 남자는 어깨가 각진 몸, 여자는 아래로 퍼지는 원피스 모양 */
export function Person({ kind, color, size = 26 }: { kind: 'M' | 'F'; color: string; size?: number }) {
  const head = size * 0.42;
  const bodyW = size * 0.72;
  const bodyH = size * 0.5;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'flex-end' }}>
      <View style={{ width: head, height: head, borderRadius: head / 2, backgroundColor: color, marginBottom: size * 0.06 }} />
      {kind === 'M' ? (
        <View
          style={{
            width: bodyW, height: bodyH, backgroundColor: color,
            borderTopLeftRadius: bodyW * 0.45, borderTopRightRadius: bodyW * 0.45,
            borderBottomLeftRadius: 2, borderBottomRightRadius: 2,
          }}
        />
      ) : (
        <View
          style={{
            width: bodyW * 0.34, height: 0,
            borderBottomWidth: bodyH, borderBottomColor: color,
            borderLeftWidth: bodyW * 0.36, borderLeftColor: 'transparent',
            borderRightWidth: bodyW * 0.36, borderRightColor: 'transparent',
            borderTopLeftRadius: 6, borderTopRightRadius: 6,
          }}
        />
      )}
    </View>
  );
}

/** 모드 그림: 혼성은 파랑+분홍이 섞이고, 남자만/여자만은 같은 색 두 명 */
export function ModeIcon({ mode, size = 26 }: { mode: Mode; size?: number }) {
  const [a, b]: ['M' | 'F', 'M' | 'F'] = mode === 'mixed' ? ['M', 'F'] : mode === 'male' ? ['M', 'M'] : ['F', 'F'];
  const col = (k: 'M' | 'F') => (k === 'M' ? C.male : C.female);
  return (
    <View style={{ flexDirection: 'row', marginBottom: 6 }}>
      <View style={s.iconBadge}>
        <Person kind={a} color={col(a)} size={size} />
      </View>
      <View style={[s.iconBadge, { marginLeft: -size * 0.3 }]}>
        <Person kind={b} color={col(b)} size={size} />
      </View>
    </View>
  );
}

/** 참가자 아바타: 색깔 동그라미에 가면 눈구멍. 성별과 무관한 색을 쓴다 */
export function MaskAvatar({ color, size = 44, dim }: { color: string; size?: number; dim?: boolean }) {
  const eyeW = size * 0.24;
  const eyeH = size * 0.15;
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size / 2, backgroundColor: color,
        borderBottomWidth: size * 0.08, borderBottomColor: 'rgba(0,0,0,0.25)',
        alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: size * 0.1,
        opacity: dim ? 0.35 : 1,
      }}
    >
      {[0, 1].map((i) => (
        <View
          key={i}
          style={{
            width: eyeW, height: eyeH, backgroundColor: '#1A1033',
            borderTopLeftRadius: i ? eyeH * 0.3 : eyeH, borderTopRightRadius: i ? eyeH : eyeH * 0.3,
            borderBottomLeftRadius: eyeH, borderBottomRightRadius: eyeH,
            marginTop: -size * 0.08,
          }}
        />
      ))}
    </View>
  );
}

/** 밤하늘 별 배경 (위치는 고정값이라 화면이 바뀌어도 흔들리지 않는다) */
const STARS = Array.from({ length: 42 }, (_, i) => {
  const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  return { left: `${r(1) * 100}%` as const, top: `${r(2) * 100}%` as const, size: r(3) < 0.8 ? 2 : 3, o: 0.25 + r(4) * 0.55 };
});

export function StarField() {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      <View style={s.glowTop} />
      {STARS.map((st, i) => (
        <View
          key={i}
          style={{
            position: 'absolute', left: st.left, top: st.top, width: st.size, height: st.size,
            borderRadius: st.size, backgroundColor: '#fff', opacity: st.o,
          }}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  btn: { minHeight: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  btnText: { fontSize: 18, fontWeight: '800', letterSpacing: -0.2 },
  ghostText: { fontSize: 15, fontWeight: '700' },
  card: { backgroundColor: C.card, borderRadius: 24, padding: 20, borderWidth: 2, borderColor: C.cardBorder },
  seg: { flexDirection: 'row', gap: 8 },
  segItem: {
    flex: 1, minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderBottomWidth: 4, paddingVertical: 6,
  },
  segItemTall: { minHeight: 86, paddingVertical: 10 },
  segText: { color: C.sub, fontSize: 15, fontWeight: '700' },
  segTextOn: { color: C.text, fontWeight: '800' },
  label: { color: C.sub, fontSize: 13, fontWeight: '800', marginBottom: 10, marginTop: 6, letterSpacing: 0.3 },
  iconBadge: {
    backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 100, padding: 4, borderWidth: 2, borderColor: 'rgba(17,11,34,0.55)',
  },
  glowTop: {
    position: 'absolute', top: -160, alignSelf: 'center', width: 420, height: 420, borderRadius: 210,
    backgroundColor: C.accent, opacity: 0.16,
  },
});

import { View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

/**
 * 트루 마스크 캐릭터 (심플 픽토그램 스타일)
 * - male / female: 성별 선택·모드 그림에만 쓴다 (파랑 / 분홍)
 * - anon: 후드를 쓴 얼굴 없는 사람. 대기실에서는 사람마다 색이 다르고,
 *   게임이 시작되면 모두 같은 색이 되어 누가 누군지 알 수 없게 된다.
 */

function Male({ color }: { color: string }) {
  return (
    <G>
      <Circle cx={50} cy={34} r={15} fill={color} />
      <Rect x={26} y={55} width={48} height={50} rx={22} fill={color} />
    </G>
  );
}

function Female({ color }: { color: string }) {
  return (
    <G>
      <Circle cx={68} cy={27} r={7} fill={color} />
      <Circle cx={50} cy={34} r={15} fill={color} />
      <Path d="M30 105 Q32 70 50 58 Q68 70 70 105 Z" fill={color} />
    </G>
  );
}

function Anon({ color }: { color: string }) {
  return (
    <G>
      <Path d="M22 105 C22 78 34 64 50 64 C66 64 78 78 78 105 Z" fill={color} />
      <Path d="M50 13 C32 13 25 27 25 42 C25 52 29 59 34 63 L66 63 C71 59 75 52 75 42 C75 27 68 13 50 13 Z" fill={color} />
      <Ellipse cx={50} cy={43} rx={16} ry={17} fill="rgba(0,0,0,0.18)" />
      <Ellipse cx={50} cy={44} rx={13.5} ry={14.5} fill="#fff" />
      <Path d="M44 64 V75 M56 64 V75" stroke="rgba(255,255,255,0.75)" strokeWidth={2.5} strokeLinecap="round" />
      <Circle cx={44} cy={77} r={2.2} fill="rgba(255,255,255,0.75)" />
      <Circle cx={56} cy={77} r={2.2} fill="rgba(255,255,255,0.75)" />
    </G>
  );
}

export type CharacterKind = 'male' | 'female' | 'anon';

/** 동그란 배지 안에 들어간 캐릭터 */
export function Character({
  kind, color, size = 56, bg = '#fff', ring, dim,
}: {
  kind: CharacterKind;
  color: string;
  size?: number;
  bg?: string;
  ring?: string;
  dim?: boolean;
}) {
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: bg,
        borderWidth: ring ? Math.max(2, size * 0.05) : 0, borderColor: ring, opacity: dim ? 0.35 : 1,
      }}
    >
      <Svg width="100%" height="100%" viewBox="0 0 100 100">
        {kind === 'male' ? <Male color={color} /> : kind === 'female' ? <Female color={color} /> : <Anon color={color} />}
      </Svg>
    </View>
  );
}

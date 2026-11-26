import { View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

/**
 * 트루 마스크 캐릭터. 모두 눈가면을 쓰고 있다.
 * - male / female: 성별 선택·모드 그림에만 쓴다 (파랑 / 분홍)
 * - anon: 후드를 깊게 쓴 익명 캐릭터. 대기실·투표 화면에서 참가자를 나타낸다 (성별을 알 수 없음)
 */

const SKIN = '#FFD9B8';
const SKIN_SHADE = '#F2C29C';
const MASK = '#1A1033';

function Mask({ trim, y = 44 }: { trim: string; y?: number }) {
  return (
    <G>
      <Path
        d={`M27 ${y} C27 ${y - 8} 40 ${y - 9} 50 ${y - 4} C60 ${y - 9} 73 ${y - 8} 73 ${y} C73 ${y + 8} 62 ${y + 10} 56 ${y + 5} C53 ${y + 3} 47 ${y + 3} 44 ${y + 5} C38 ${y + 10} 27 ${y + 8} 27 ${y} Z`}
        fill={MASK}
        stroke={trim}
        strokeWidth={2}
      />
      <Ellipse cx={39.5} cy={y} rx={5} ry={3.6} fill="#fff" />
      <Ellipse cx={60.5} cy={y} rx={5} ry={3.6} fill="#fff" />
      <Circle cx={40.5} cy={y + 0.4} r={2} fill={MASK} />
      <Circle cx={61.5} cy={y + 0.4} r={2} fill={MASK} />
    </G>
  );
}

function Male({ color }: { color: string }) {
  return (
    <G>
      {/* 몸 (후드티) */}
      <Path d="M12 100 C12 76 29 66 50 66 C71 66 88 76 88 100 Z" fill={color} />
      <Path d="M39 67 L50 81 L61 67 Z" fill="rgba(0,0,0,0.22)" />
      <Path d="M32 74 C30 84 31 92 33 100" stroke="rgba(255,255,255,0.35)" strokeWidth={2} fill="none" />
      {/* 목·얼굴 */}
      <Path d="M43 56 H57 V70 Q50 75 43 70 Z" fill={SKIN_SHADE} />
      <Circle cx={31} cy={45} r={4.5} fill={SKIN} />
      <Circle cx={69} cy={45} r={4.5} fill={SKIN} />
      <Ellipse cx={50} cy={43} rx={19} ry={21} fill={SKIN} />
      {/* 앞머리를 올린 짧은 머리 */}
      <Path
        d="M30 42 C26 22 38 12 53 13 C67 14 75 24 71 40 C68 32 63 27 55 26 C50 30 42 31 36 29 C33 32 31 36 30 42 Z"
        fill="#2B2140"
      />
      <Path d="M50 16 C56 15 63 18 66 23" stroke="rgba(255,255,255,0.25)" strokeWidth={2} fill="none" strokeLinecap="round" />
      <Mask trim={color} />
      <Path d="M44 56 Q50 60 56 56" stroke="#8A4B3A" strokeWidth={2.4} fill="none" strokeLinecap="round" />
    </G>
  );
}

function Female({ color }: { color: string }) {
  const hair = '#3A2350';
  return (
    <G>
      {/* 뒷머리 (긴 머리) */}
      <Path d="M26 44 C24 21 37 12 50 12 C64 12 77 21 74 44 L77 72 C69 77 61 74 59 69 L41 69 C39 74 31 77 23 72 Z" fill={hair} />
      {/* 몸 */}
      <Path d="M14 100 C14 77 30 67 50 67 C70 67 86 77 86 100 Z" fill={color} />
      <Path d="M40 67 Q50 79 60 67 Z" fill={SKIN_SHADE} />
      <Path d="M44 56 H56 V68 Q50 72 44 68 Z" fill={SKIN_SHADE} />
      <Ellipse cx={50} cy={43} rx={18.5} ry={20.5} fill={SKIN} />
      {/* 앞머리 */}
      <Path
        d="M30 42 C29 24 40 16 51 17 C63 18 71 27 70 41 C66 33 59 28 52 26 C47 32 39 37 30 42 Z"
        fill={hair}
      />
      {/* 머리핀 */}
      <Circle cx={65} cy={26} r={4.2} fill={color} stroke="#fff" strokeWidth={1.5} />
      <Mask trim={color} />
      {/* 속눈썹 */}
      <Path d="M30 38 L27 35 M70 38 L73 35" stroke={MASK} strokeWidth={2} strokeLinecap="round" />
      <Path d="M45 56 Q50 59.5 55 56" stroke="#D9547F" strokeWidth={2.4} fill="none" strokeLinecap="round" />
    </G>
  );
}

function Anon({ color }: { color: string }) {
  return (
    <G>
      <Path d="M12 100 C12 76 29 64 50 64 C71 64 88 76 88 100 Z" fill={color} />
      <Path d="M50 70 V100" stroke="rgba(0,0,0,0.2)" strokeWidth={2} />
      {/* 후드 */}
      <Path d="M22 54 C18 26 33 12 50 12 C67 12 82 26 78 54 C76 66 66 72 50 72 C34 72 24 66 22 54 Z" fill={color} />
      <Path d="M30 20 C36 15 43 13 50 13" stroke="rgba(255,255,255,0.35)" strokeWidth={2.5} fill="none" strokeLinecap="round" />
      {/* 그림자 진 얼굴 */}
      <Ellipse cx={50} cy={47} rx={18} ry={20} fill="#140C2A" />
      <Mask trim={color} y={46} />
    </G>
  );
}

export type CharacterKind = 'male' | 'female' | 'anon';

/** 동그란 배지 안에 들어간 캐릭터 상반신 */
export function Character({
  kind, color, size = 56, bg = 'rgba(255,255,255,0.95)', ring, dim,
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
      <Svg width="100%" height="100%" viewBox="0 6 100 100">
        {kind === 'male' ? <Male color={color} /> : kind === 'female' ? <Female color={color} /> : <Anon color={color} />}
      </Svg>
    </View>
  );
}

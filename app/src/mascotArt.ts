/**
 * 트루 마스크 마스코트: 눈웃음 짓는 흰 가면 하나가 둥실 떠 있다.
 *
 * 앱 화면(Mascot.tsx, SvgXml)과 아이콘·스플래시 PNG(design/export-icons.ts)가
 * 이 파일 하나의 SVG 를 같이 쓴다. 그래서 어디서 보든 똑같이 생겼다.
 * react-native-svg 가 지원하지 않는 필터·그라데이션은 쓰지 않는다.
 */

export type MascotExpression = 'smile' | 'wink' | 'blink';

const INK = '#2B1A5E';
const MASK_FILL = '#FFFFFF';
const MASK_SHADE = '#D9CFFF'; // 아래쪽 두께감
const BLUSH = '#FF8FB1';
const SPARKLE = '#FFC83D';

// 가면 모양 (아이콘 시안 때부터 쓰던 모양). 원래 좌표 중심 (512, 500)
const MASK_PATH =
  'M190 500 C190 370 300 330 405 352 C462 364 488 392 512 392 C536 392 562 364 619 352 C724 330 834 370 834 500 C834 616 754 668 662 656 C600 648 562 604 512 604 C462 604 424 648 362 656 C270 668 190 616 190 500 Z';

const CX = 120;
const CY = 96;
const KX = 0.3;
const KY = 0.36; // 원래 모양보다 살짝 통통하게
/** 가면을 viewBox(240x200) 안 (cx, cy) 에 놓는 transform */
const place = (cx: number, cy: number) => `translate(${cx} ${cy}) scale(${KX} ${KY}) translate(-512 -500)`;

const EYE_DX = 140 * KX; // 눈구멍 중심까지 거리
const EYE_Y = CY + 2;

/** 눈웃음: 끝이 뾰족한 ∩ 모양 구멍 */
const smileEye = (x: number, fill: string) =>
  `<path d="M${x - 24} ${EYE_Y + 9} Q${x} ${EYE_Y - 30} ${x + 24} ${EYE_Y + 9} Q${x} ${EYE_Y - 6} ${x - 24} ${EYE_Y + 9} Z" fill="${fill}" stroke="${fill}" stroke-width="3" stroke-linejoin="round"/>`;

/** 감은 눈: 선 하나 (lift 가 음수면 아래로 볼록 = 윙크) */
const closedEye = (x: number, stroke: string, lift: number) =>
  `<path d="M${x - 20} ${EYE_Y + 2} Q${x} ${EYE_Y + 2 - lift} ${x + 20} ${EYE_Y + 2}" stroke="${stroke}" stroke-width="8" fill="none" stroke-linecap="round"/>`;

const sparkle = (x: number, y: number, r: number, fill: string) => {
  const c = r * 0.15;
  return `<path d="M${x} ${y - r} C${x + c} ${y - c} ${x + c} ${y - c} ${x + r} ${y} C${x + c} ${y + c} ${x + c} ${y + c} ${x} ${y + r} C${x - c} ${y + c} ${x - c} ${y + c} ${x - r} ${y} C${x - c} ${y - c} ${x - c} ${y - c} ${x} ${y - r} Z" fill="${fill}"/>`;
};

export interface MascotSvgOptions {
  expression?: MascotExpression;
  /** 둥실 떠 있는 그림자 (앱 화면용) */
  shadow?: boolean;
  /** 배경색 (아이콘용). 없으면 투명 */
  bg?: string;
  /** 안드로이드 테마 아이콘용: 흰색 실루엣만 (눈은 뚫림) */
  monochrome?: boolean;
  /** 보여줄 영역. 기본은 전체 "0 0 240 200" */
  viewBox?: string;
  size?: number;
  /** 가면 색 바꾸기 (GOLD MASK: 금색 / 꺼짐: 회색). 없으면 흰 가면 */
  tint?: { fill: string; shade: string; blush?: string };
}

/** GOLD MASK 켜짐 / 꺼짐 색 */
export const GOLD_TINT = { fill: '#FFC83D', shade: '#C48F0F', blush: '#FF9F5A' };
export const OFF_TINT = { fill: '#7A7299', shade: '#4E4770', blush: '#7A7299' };

export function mascotSvg(o: MascotSvgOptions = {}): string {
  const { expression = 'smile', shadow = false, bg, monochrome = false, viewBox = '0 0 240 200', size, tint } = o;
  const fill = tint?.fill ?? MASK_FILL;
  const shade = tint?.shade ?? MASK_SHADE;
  const blush = tint?.blush ?? BLUSH;
  const parts: string[] = [];
  const [vx, vy, vw, vh] = viewBox.split(' ').map(Number);

  if (bg) parts.push(`<rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="${bg}"/>`);
  if (shadow) parts.push(`<ellipse cx="${CX}" cy="188" rx="62" ry="7" fill="#000" opacity="0.3"/>`);

  if (monochrome) {
    parts.push(
      `<mask id="tm-eyes" maskUnits="userSpaceOnUse" x="${vx}" y="${vy}" width="${vw}" height="${vh}"><rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="#fff"/>${smileEye(CX - EYE_DX, '#000')}${smileEye(CX + EYE_DX, '#000')}</mask>`,
      `<g mask="url(#tm-eyes)"><path d="${MASK_PATH}" transform="${place(CX, CY)}" fill="#fff"/></g>`,
    );
  } else {
    const sw = 5 / KX;
    parts.push(
      `<path d="${MASK_PATH}" transform="${place(CX, CY + 7)}" fill="${shade}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>`,
      `<path d="${MASK_PATH}" transform="${place(CX, CY)}" fill="${fill}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>`,
      `<ellipse cx="${CX - EYE_DX - 4}" cy="${EYE_Y + 26}" rx="14" ry="6.5" fill="${blush}" opacity="0.8"/>`,
      `<ellipse cx="${CX + EYE_DX + 4}" cy="${EYE_Y + 26}" rx="14" ry="6.5" fill="${blush}" opacity="0.8"/>`,
    );
    if (expression === 'smile') parts.push(smileEye(CX - EYE_DX, INK), smileEye(CX + EYE_DX, INK));
    if (expression === 'wink') {
      parts.push(smileEye(CX - EYE_DX, INK), closedEye(CX + EYE_DX, INK, -14));
      parts.push(sparkle(CX + 100, CY - 54, 12, SPARKLE), sparkle(CX + 80, CY - 74, 6.5, SPARKLE));
    }
    if (expression === 'blink') parts.push(closedEye(CX - EYE_DX, INK, 8), closedEye(CX + EYE_DX, INK, 8));
  }

  const wh = size ? ` width="${size}" height="${size}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"${wh}>${parts.join('')}</svg>`;
}

/** 아이콘처럼 가면을 크게 자른 영역 (정사각형) */
export const ICON_VIEWBOX = '0 -16 240 240';

/** 스플래시(로딩 화면) 그림 영역: 가면이 가운데 오는 정사각형. 윙크 반짝이까지 들어가게 */
export const SPLASH_VIEWBOX = '0 -24 240 240';

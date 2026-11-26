// 마스코트 캐릭터 1차 시안 생성기
// 사용: node design/mascot-drafts/gen.js  → 같은 폴더에 SVG 생성
// react-native-svg 로 그대로 옮길 수 있도록 필터 없이 path/ellipse 만 쓴다.
const fs = require('fs');
const path = require('path');

const INK = '#2B1A5E';
const MASK = 'M190 500 C190 370 300 330 405 352 C462 364 488 392 512 392 C536 392 562 364 619 352 C724 330 834 370 834 500 C834 616 754 668 662 656 C600 648 562 604 512 604 C462 604 424 648 362 656 C270 668 190 616 190 500 Z';

/** 가면 + 눈 (wink=true 면 오른쪽 눈 윙크) */
function face({ cx, cy, scale: k, maskColor, wink, mouth = 'smile', mouthY = 70, tails = true }) {
  const s = 0.33 * k;           // 가면 크기
  const ex = 140 * s;           // 가면 눈구멍 중심까지 거리
  const ey = cy + 2 * k;
  const hole = (x) => `<ellipse cx="${x}" cy="${ey}" rx="${24 * k}" ry="${18 * k}" fill="#fff"/>`;
  const eye = (x) => `${hole(x)}<ellipse cx="${x + 2 * k}" cy="${ey + 1 * k}" rx="${11 * k}" ry="${13 * k}" fill="${INK}"/><circle cx="${x + 6 * k}" cy="${ey - 4 * k}" r="${4 * k}" fill="#fff"/>`;
  const winkEye = (x) => `${hole(x)}<path d="M${x - 14 * k} ${ey + 5 * k} Q${x} ${ey - 12 * k} ${x + 14 * k} ${ey + 5 * k}" stroke="${INK}" stroke-width="${7 * k}" fill="none" stroke-linecap="round"/>`;
  const edge = cx + 318 * s;
  const tail = tails
    ? `<path d="M${edge - 6 * k} ${ey - 8 * k} q${26 * k} ${-4 * k} ${40 * k} ${-24 * k} M${edge - 6 * k} ${ey} q${30 * k} ${8 * k} ${44 * k} ${-2 * k}" stroke="${maskColor}" stroke-width="${9 * k}" stroke-linecap="round" fill="none"/>`
    : '';
  let m = '';
  if (mouth === 'smile') m = `<path d="M${cx - 14 * k} ${cy + mouthY * k} Q${cx} ${cy + (mouthY + 14) * k} ${cx + 14 * k} ${cy + mouthY * k}" stroke="${INK}" stroke-width="${7 * k}" fill="none" stroke-linecap="round"/>`;
  if (mouth === 'open') m = `<path d="M${cx - 15 * k} ${cy + mouthY * k} Q${cx} ${cy + (mouthY + 26) * k} ${cx + 15 * k} ${cy + mouthY * k} Z" fill="${INK}" stroke="${INK}" stroke-width="${5 * k}" stroke-linejoin="round"/><path d="M${cx - 7 * k} ${cy + (mouthY + 12) * k} Q${cx} ${cy + (mouthY + 18) * k} ${cx + 7 * k} ${cy + (mouthY + 12) * k}" fill="#FF6F8E"/>`;
  return `${tail}
    <path d="${MASK}" transform="translate(${cx} ${cy}) scale(${s}) translate(-512 -500)" fill="${maskColor}" stroke="${INK}" stroke-width="${9 / s}" stroke-linejoin="round"/>
    ${eye(cx - ex)}${wink ? winkEye(cx + ex) : eye(cx + ex)}
    ${m}`;
}

const blush = (cx, cy, dx, k = 1) =>
  `<ellipse cx="${cx - dx}" cy="${cy}" rx="${16 * k}" ry="${9 * k}" fill="#FF6F8E" opacity="0.55"/><ellipse cx="${cx + dx}" cy="${cy}" rx="${16 * k}" ry="${9 * k}" fill="#FF6F8E" opacity="0.55"/>`;

const C = {};

// 1. 콩이 — 노란 콩 모양, 보라 가면
C['1'] = {
  name: '콩이',
  desc: '노란 콩알 몸에 보라 가면. 앱의 금색 제목과 가장 잘 어울리고 제일 단순해서 작게 봐도 또렷해요.',
  body: (w) => `
    <ellipse cx="160" cy="350" rx="30" ry="14" fill="${INK}"/><ellipse cx="240" cy="350" rx="30" ry="14" fill="${INK}"/>
    <path d="M200 72 C287 70 334 152 334 238 C334 312 280 346 200 346 C120 346 66 314 66 238 C66 150 114 74 200 72 Z" fill="#FFC83D" stroke="${INK}" stroke-width="12"/>
    <path d="M118 150 C130 118 156 100 180 96" stroke="#FFF1B0" stroke-width="14" stroke-linecap="round" fill="none"/>
    ${blush(200, 270, 82)}
    ${face({ cx: 200, cy: 205, scale: 1, maskColor: '#7C4DFF', wink: w, mouth: w ? 'open' : 'smile', mouthY: 50 })}`,
  iconBg: '#7C4DFF',
};

// 2. 모찌 — 납작하고 말랑한 찹쌀떡, 분홍 가면
C['2'] = {
  name: '모찌',
  desc: '말랑한 찹쌀떡처럼 납작한 흰 몸에 분홍 가면. 순하고 귀여운 느낌이라 누구나 부담 없이 좋아할 스타일.',
  body: (w) => `
    <path d="M200 132 C306 130 362 200 362 268 C362 326 304 348 200 348 C96 348 38 326 38 268 C38 200 94 134 200 132 Z" fill="#FFF6E8" stroke="${INK}" stroke-width="12"/>
    <path d="M52 290 q-22 6 -26 -12 M348 290 q22 6 26 -12" stroke="${INK}" stroke-width="12" stroke-linecap="round" fill="none"/>
    <path d="M110 176 C126 160 148 150 168 148" stroke="#fff" stroke-width="14" stroke-linecap="round" fill="none"/>
    ${blush(200, 292, 96)}
    ${face({ cx: 200, cy: 236, scale: 1, maskColor: '#FF6FB5', wink: w, mouth: w ? 'open' : 'smile', mouthY: 44 })}`,
  iconBg: '#FF6FB5',
};

// 3. 젤리 — 민트색 젤리, 아래가 물결, 금색 가면
C['3'] = {
  name: '젤리',
  desc: '말랑한 민트 젤리, 아래가 살짝 흘러내린 모양에 금색 가면. 장난스럽고 생동감 있어요.',
  body: (w) => `
    <path d="M200 74 C282 74 326 140 328 220 L330 318 C330 342 306 348 296 330 C286 312 268 312 260 334 C250 356 222 356 214 334 C206 312 186 312 178 334 C168 356 140 356 132 334 C124 312 104 312 98 330 C88 348 70 340 70 318 L72 220 C74 140 118 74 200 74 Z" fill="#3BE0A8" stroke="${INK}" stroke-width="12" stroke-linejoin="round"/>
    <path d="M112 160 C120 124 146 102 172 96" stroke="#C8FFE9" stroke-width="14" stroke-linecap="round" fill="none"/>
    <circle cx="282" cy="140" r="7" fill="#C8FFE9"/><circle cx="300" cy="170" r="4" fill="#C8FFE9"/>
    ${blush(200, 272, 84)}
    ${face({ cx: 200, cy: 205, scale: 1, maskColor: '#FFC83D', wink: w, mouth: w ? 'open' : 'smile', mouthY: 50 })}`,
  iconBg: '#4F2BC4',
};

// 4. 새싹이 — 분홍 방울 몸 + 머리 위 새싹, 금색 가면
C['4'] = {
  name: '새싹이',
  desc: '머리에 새싹이 난 분홍 방울에 금색 가면. 새싹이 살랑살랑 움직이게 만들 수 있어서 애니메이션이 제일 재밌어요.',
  body: (w) => `
    <path d="M200 92 C200 70 206 56 214 46" stroke="${INK}" stroke-width="9" stroke-linecap="round" fill="none"/>
    <path d="M212 50 C222 22 256 16 270 26 C258 50 236 60 212 50 Z" fill="#4ADE80" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/>
    <path d="M206 56 C192 34 164 32 154 42 C166 60 188 66 206 56 Z" fill="#4ADE80" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/>
    <ellipse cx="160" cy="350" rx="28" ry="13" fill="${INK}"/><ellipse cx="240" cy="350" rx="28" ry="13" fill="${INK}"/>
    <path d="M200 90 C290 90 336 166 334 244 C332 314 278 346 200 346 C122 346 68 314 66 244 C64 166 110 90 200 90 Z" fill="#FF8FB1" stroke="${INK}" stroke-width="12"/>
    <path d="M116 168 C126 136 150 116 174 112" stroke="#FFD1DF" stroke-width="14" stroke-linecap="round" fill="none"/>
    ${blush(200, 280, 84)}
    ${face({ cx: 200, cy: 218, scale: 1, maskColor: '#FFC83D', wink: w, mouth: w ? 'open' : 'smile', mouthY: 48 })}`,
  iconBg: '#2A1D57',
};

const wrap = (inner, viewBox = '0 0 400 400', bg = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="1024" height="1024">${bg}${inner}</svg>`;

const dir = __dirname;
for (const [k, c] of Object.entries(C)) {
  fs.writeFileSync(path.join(dir, `${k}-default.svg`), wrap(c.body(false)));
  fs.writeFileSync(path.join(dir, `${k}-wink.svg`), wrap(c.body(true)));
  // 아이콘: 얼굴 쪽을 크게 확대해 자른다
  fs.writeFileSync(path.join(dir, `${k}-icon.svg`),
    wrap(c.body(true), '40 70 320 320', `<rect x="0" y="0" width="400" height="400" fill="${c.iconBg}"/>`));
}
fs.writeFileSync(path.join(dir, 'concepts.json'), JSON.stringify(Object.fromEntries(Object.entries(C).map(([k, c]) => [k, [c.name, c.desc]]))));

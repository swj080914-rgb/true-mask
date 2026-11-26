// 마스코트 시안 비교 이미지 렌더: node design/mascot-drafts/render.js [scale]
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const dir = __dirname;
const names = JSON.parse(fs.readFileSync(path.join(dir, 'concepts.json'), 'utf8'));
const uri = (f) => 'data:image/svg+xml;base64,' + fs.readFileSync(path.join(dir, f)).toString('base64');

const cards = Object.keys(names).map((k) => `
  <div class="card">
    <div class="row">
      <div class="hero"><img class="m" src="${uri(`${k}-default.svg`)}"><div class="t">TRUE MASK</div><div class="cap">첫 화면</div></div>
      <div class="hero"><img class="m" src="${uri(`${k}-wink.svg`)}"><div class="t">TRUE MASK</div><div class="cap">로딩 끝 → 윙크!</div></div>
      <div class="col">
        <img class="big" src="${uri(`${k}-icon.svg`)}">
        <div class="phone"><img class="small" src="${uri(`${k}-icon.svg`)}"><span>트루 마스크</span></div>
      </div>
    </div>
    <h2>${k}. ${names[k][0]}</h2><p>${names[k][1]}</p>
  </div>`).join('');

const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:48px;background:#F2EFF7;font-family:'Noto Sans CJK KR',sans-serif;width:1904px}
h1{margin:0 0 6px;font-size:44px}.lead{color:#666;font-size:22px;margin:0 0 32px}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:28px}
.card{background:#fff;border-radius:28px;padding:28px}
.row{display:flex;gap:18px;align-items:stretch}
.hero{background:#110B22;border-radius:20px;padding:16px 10px 12px;display:flex;flex-direction:column;align-items:center;width:250px}
.m{width:190px;height:190px}
.t{font:900 32px sans-serif;color:#FFC83D;letter-spacing:1px;text-shadow:0 4px 0 #4F2BC4;margin-top:-6px}
.cap{color:#A99CCF;font-size:16px;margin-top:6px}
.col{display:flex;flex-direction:column;gap:12px;align-items:center;justify-content:center}
.big{width:150px;height:150px;border-radius:34px}
.phone{background:#2B2B33;border-radius:16px;padding:10px 12px 6px;display:flex;flex-direction:column;align-items:center;gap:4px}
.small{width:60px;height:60px;border-radius:14px}.phone span{color:#fff;font-size:13px}
h2{margin:20px 0 6px;font-size:30px}p{margin:0;color:#555;font-size:20px;line-height:1.5}
</style><h1>마스코트 캐릭터 1차 시안</h1>
<p class="lead">왼쪽: 첫 화면 TRUE MASK 위 · 가운데: 로딩이 끝나면 윙크 · 오른쪽: 앱 아이콘(얼굴 확대)과 홈 화면 실제 크기</p>
<div class="grid">${cards}</div>`;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 2000, height: 1000 }, deviceScaleFactor: Number(process.argv[2] || 1) });
  await p.setContent(html);
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(dir, 'mascot-options.png'), fullPage: true });
  await b.close();
})();

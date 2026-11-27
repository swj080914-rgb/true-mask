/**
 * 성별 공개 · 1회권 · 평생권 · 광고 관련 문구를 전부 여기 모아 뒀어요.
 * 따옴표 안의 글자만 바꾸면 앱에 그대로 반영돼요.
 * (가격은 아래 PRICE 두 줄만 바꾸면 되고, 실제 스토어 가격도 같이 맞춰 주세요)
 */

export const PRICE = {
  oneGame: '₩1,700',
  lifetime: '₩5,900',
};

export const COPY = {
  // ── 결과 숫자 아래 가려진 남녀 인원 (게임 중, 최종 결과 둘 다) ──
  lockedMale: '남자 ?',
  lockedFemale: '여자 ?',

  // ── 최종 결과 화면 ────────────────────────────────────────────
  finishedGuide: '궁금한 질문을 눌러보세요',
  finishedAllButton: '👑 이번 판 전부 보기',
  blocked: '남자나 여자가 한 명뿐이라 이번 판은 못 열어요',

  // ── 질문을 눌렀을 때 아래에서 올라오는 선택창 ─────────────────
  sheetTitle: '남자 몇 명, 여자 몇 명?',
  sheetAd: '📺 광고 보고 이 질문만 보기',
  sheetOneGame: `이번 판 전부 보기 · ${PRICE.oneGame}`,
  sheetLifetime: `👑 GOLD MASK · ${PRICE.lifetime}`,
  sheetFooter: '누가 열었는지는 아무도 몰라요.',
  sheetAppOnly: '결제는 트루 마스크 앱에서 할 수 있어요.',
  sheetClose: '닫기',

  // ── 광고 화면 (지금은 테스트용 가짜 광고) ─────────────────────
  adTag: '광고',
  adTitle: '여기에 광고가 나와요',
  adDone: '다 봤어요!',
  adReward: '이 질문 열기',
  adClose: '닫기',

  // ── 열려 있을 때 모두에게 보이는 작은 표시 ────────────────────
  onByOneGame: '👑 이번 판 공개',
  // GOLD MASK는 글자 대신 가면 그림으로 보여줘요 (켜짐: 금색, 꺼짐: 회색). 아래 두 줄은 화면 읽기 기능용 이름
  onByLifetime: 'GOLD MASK 켜짐',
  lifetimeOff: 'GOLD MASK 꺼짐',

  // ── 홈 화면: 평생권 (이름: GOLD MASK) ──────────────────────────────────────────
  homeLifetimeTitle: '👑 GOLD MASK',
  homeLifetimeBody: '성별 공개 무제한 + 광고 제거',
  homeLifetimeBuy: `GOLD MASK 받기 · ${PRICE.lifetime}`,
  homeLifetimeOwned: '👑 GOLD MASK 쓰는 중',
  homeRestore: '구매 복원',
  homeRestoreNone: '복원할 구매가 없어요.',
  homeAppOnly: 'GOLD MASK는 트루 마스크 앱에서 받을 수 있어요.',
};

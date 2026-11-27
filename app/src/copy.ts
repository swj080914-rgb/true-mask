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
  // ── 게임 중: 결과 숫자 아래 잠금 표시 ─────────────────────────
  lockedLine: '🔒 남자 ?명 · 여자 ?명',
  lockedHint: '게임이 끝나면 열어볼 수 있어요',

  // ── 최종 결과 화면 ────────────────────────────────────────────
  finishedGuide: '🔒 질문을 누르면 남녀 몇 명인지 볼 수 있어요',
  finishedAllButton: '👑 이번 판 전부 보기',
  lockedRowButton: '🔒 남녀 몇 명인지 보기',
  blocked: '남자나 여자가 한 명뿐이라, 누군지 티 날 수 있어서 이번 판은 못 열어요.',
  genderHidden: '이 질문은 남자나 여자가 한 명뿐이라 숨겼어요',

  // ── 질문을 눌렀을 때 아래에서 올라오는 선택창 ─────────────────
  sheetTitle: '남자 몇 명, 여자 몇 명?',
  sheetAd: '📺 광고 보고 이 질문만 보기',
  sheetOneGame: `이번 판 전부 보기 · ${PRICE.oneGame}`,
  sheetLifetime: `평생권 (광고 제거) · ${PRICE.lifetime}`,
  sheetFooter: '누가 열었는지는 아무도 몰라요.',
  sheetAppOnly: '결제는 트루 마스크 앱에서 할 수 있어요.',
  sheetClose: '닫기',

  // ── 광고 화면 (지금은 테스트용 가짜 광고) ─────────────────────
  adTag: '광고',
  adTitle: '여기에 광고가 나와요',
  adDone: '다 봤어요!',
  adReward: '이 질문 열기',
  adClose: '닫기',

  // ── 누군가 열었을 때 모두에게 뜨는 안내 ───────────────────────
  onByOneGame: '👑 누군가 이번 판을 열었어요. 남녀 인원이 다 보여요.',
  onByLifetime: '👑 평생권 있는 사람이 있어서 남녀 인원이 다 보여요.',
  lifetimeInLobby: '👑 평생권 있는 사람이 있어요. 남녀가 섞여 있으면 결과에 남녀 인원도 나와요.',
  lifetimeOff: '평생권 있는 사람이 성별 공개를 꺼 뒀어요.',
  lifetimeTurnOff: '내 평생권 끄기',
  lifetimeTurnOn: '내 평생권 켜기',

  // ── 홈 화면: 평생권 ──────────────────────────────────────────
  homeLifetimeTitle: '👑 평생권',
  homeLifetimeBody: '남녀가 섞인 게임이면 매판 남녀 인원이 다 보여요.\n내가 들어간 방이면 친구들도 같이 봐요. 광고도 안 나와요.',
  homeLifetimeBuy: `평생권 사기 · ${PRICE.lifetime}`,
  homeLifetimeOwned: '👑 평생권 쓰는 중',
  homeRestore: '구매 복원',
  homeRestoreNone: '복원할 구매가 없어요.',
  homeAppOnly: '평생권은 트루 마스크 앱에서 살 수 있어요.',
};

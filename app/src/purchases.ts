import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 성별 공개 결제 (지금은 개발용 가짜 결제)
 *
 * 광고: 게임이 끝나면 방장이 보상형 광고를 보고 질문 1개를 골라 성별 공개 (판마다 1번). 무료 공개는 없다.
 *
 * 상품 2개 (화면 문구와 가격 표시는 copy.ts)
 *  - 1회권 (소모성): 게임이 끝난 뒤, 이번 판 모든 질문 성별 공개. 참가자 누구나 살 수 있다.
 *  - 평생권 (비소모성): 홈 화면이나 최종 결과에서 산다. 산 사람이 들어간 혼성 게임은 항상 자동으로 성별 공개 + 광고 제거.
 *
 * TODO(출시): react-native-purchases(RevenueCat)로 교체
 *  - buyOneGame: 소모성 상품 구매 → 거래 ID를 영수증으로 돌려준다 (서버가 재사용을 막음)
 *  - buyLifetime / hasLifetime: 'lifetime' 권한(entitlement) 확인
 *  - 서버 쪽은 Edge Function 에서 RevenueCat 으로 검증하고 config.allow_mock_premium 을 false 로
 */

/** 인앱결제는 앱에서만 된다. 웹은 개발 중(로컬)일 때만 가짜 결제로 시험할 수 있다. */
export const PURCHASES_AVAILABLE = Platform.OS !== 'web' || __DEV__;

/**
 * 보상형 광고 (지금은 개발용 가짜 광고: RewardedAd.tsx 가 몇 초짜리 화면을 띄운다)
 * TODO(출시): react-native-google-mobile-ads 의 RewardedAd 로 교체하고,
 *   AdMob 서버 확인(SSV) 콜백을 Edge Function 으로 받아 서버의 tm_ad_pick 을 열도록 바꾼다.
 */
export const ADS_AVAILABLE = PURCHASES_AVAILABLE;
export const mockAdToken = () => `mock-ad:${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const LIFETIME_KEY = 'truemask.lifetime';
export const LIFETIME_RECEIPT = 'mock-lifetime';

export async function buyOneGame(): Promise<string | null> {
  if (!PURCHASES_AVAILABLE) return null;
  return `mock-receipt:${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export async function buyLifetime(): Promise<boolean> {
  if (!PURCHASES_AVAILABLE) return false;
  await AsyncStorage.setItem(LIFETIME_KEY, '1').catch(() => {});
  return true;
}

/** 구매 복원: 앱을 다시 깔았을 때 스토어 계정으로 평생권을 되찾는다 (지금은 이 폰 저장값만 확인) */
export async function restoreLifetime(): Promise<boolean> {
  return hasLifetime();
}

export async function hasLifetime(): Promise<boolean> {
  if (!PURCHASES_AVAILABLE) return false;
  try {
    return (await AsyncStorage.getItem(LIFETIME_KEY)) === '1';
  } catch {
    return false;
  }
}

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 성별 공개 결제 (지금은 개발용 가짜 결제)
 *
 * 상품 2개
 *  - 1회권 (소모성): 이번 판만 성별 공개. 참가자 누구나 살 수 있다.
 *  - 평생권 (비소모성): 산 사람이 들어간 혼성 게임은 항상 자동으로 성별 공개.
 *
 * TODO(출시): react-native-purchases(RevenueCat)로 교체
 *  - buyOneGame: 소모성 상품 구매 → 거래 ID를 영수증으로 돌려준다 (서버가 재사용을 막음)
 *  - buyLifetime / hasLifetime: 'lifetime' 권한(entitlement) 확인
 *  - 서버 쪽은 Edge Function 에서 RevenueCat 으로 검증하고 config.allow_mock_premium 을 false 로
 */

export const PRICE_ONE_GAME = '₩1,500';
export const PRICE_LIFETIME = '₩7,900';

/** 인앱결제는 앱에서만 된다. 웹은 개발 중(로컬)일 때만 가짜 결제로 시험할 수 있다. */
export const PURCHASES_AVAILABLE = Platform.OS !== 'web' || __DEV__;

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

export async function hasLifetime(): Promise<boolean> {
  if (!PURCHASES_AVAILABLE) return false;
  try {
    return (await AsyncStorage.getItem(LIFETIME_KEY)) === '1';
  } catch {
    return false;
  }
}

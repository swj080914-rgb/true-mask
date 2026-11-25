import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * 게임 서버 주소.
 * - 배포 시: EXPO_PUBLIC_SERVER_URL=https://your-server.example.com 로 지정
 * - 개발 시: 지정하지 않으면 Expo 개발 서버를 띄운 컴퓨터의 3001 포트를 사용
 */
function devServerUrl() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }
  const host = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';
  return `http://${host}:3001`;
}

export const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL || devServerUrl();

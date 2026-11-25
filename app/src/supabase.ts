import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!url || !key) {
  throw new Error('app/.env 에 EXPO_PUBLIC_SUPABASE_URL 과 EXPO_PUBLIC_SUPABASE_KEY 를 넣어주세요.');
}

// 로그인 기능은 쓰지 않으므로 세션 저장은 끈다. 참가자 확인은 게임 함수의 비밀 토큰으로 한다.
export const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

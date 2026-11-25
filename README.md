# 🎭 트루 마스크 (True Mask)

친구들이 같은 방에 모여 질문에 **예 / 아니오**로 답하는 게임.
결과에는 **몇 명이 “예”라고 했는지만** 나오고, 누가 눌렀는지는 아무도 알 수 없습니다.

## 구조

```
truemask/
├── app/        React Native + Expo + TypeScript  (iOS / Android / 웹)
└── supabase/   DB 스키마와 게임 로직 (Postgres 함수) + 테스트
```

| 영역 | 기술 | 이유 |
|---|---|---|
| 앱 | React Native + Expo (TypeScript) | 코드 하나로 iOS·Android 출시, EAS로 빌드·스토어 제출 |
| 백엔드 | Supabase (Postgres + RPC 함수) | 서버를 따로 운영하지 않아도 됨. 게임 규칙은 DB 함수로 실행 |
| 실시간 | Supabase Realtime | 방 상태가 바뀌면 모든 폰이 바로 새 상태를 받아옴 |
| 결제(예정) | RevenueCat + Supabase Edge Function | 애플·구글 인앱결제, 영수증은 서버에서 검증 |

## 처음 설정 (한 번만)

1. Supabase 대시보드 → **SQL Editor** → New query
2. `supabase/migrations/0001_true_mask.sql` 전체를 붙여넣고 **Run**
   - 여러 번 실행해도 안전합니다. SQL을 고친 뒤 다시 실행하면 함수가 갱신됩니다.
3. 앱 접속 정보는 `app/.env`에 있습니다 (프로젝트 URL과 **공개키(publishable)**만 넣습니다. secret 키는 넣지 마세요).

## 실행 방법

```bash
cd app && npm install && npx expo start
```

- 폰에 **Expo Go** 앱을 설치하고 QR을 찍으면 바로 실행됩니다.
- 브라우저로 보려면 `npx expo start --web`을 실행하세요. 탭을 여러 개 열면 여러 명처럼 테스트할 수 있습니다.

DB 로직 테스트는 로컬 Postgres가 필요합니다.

```bash
cd supabase && npm install && DATABASE_URL=postgres://postgres@localhost:5432/postgres npm test
```

## 게임 흐름

1. 닉네임과 성별을 입력합니다. 성별은 다른 사람에게 표시되지 않습니다.
2. 방장이 **모드**(혼성 / 남자만 / 여자만)와 **질문 수**(5~8)를 골라 방을 만들면 5자리 코드가 나옵니다.
3. 친구들이 코드를 입력해 입장합니다. **최소 3명**이 모여야 시작할 수 있습니다.
4. 질문마다 모두 투표하면 자동으로 결과가 공개됩니다. 방장은 “남은 사람 기다리지 않고 공개”도 할 수 있습니다.
5. 마지막에 모든 질문의 결과를 한 번에 보여주고, “한 판 더”로 새 질문을 받을 수 있습니다.

## 익명성 설계 (핵심)

- 앱에 들어가는 공개키는 누구나 볼 수 있는 키입니다. 그래서 게임 테이블은 API로 노출되지 않는 `truemask` 스키마에 두고 RLS로 잠갔습니다. 앱은 `public.tm_*` 함수만 호출할 수 있고, 함수는 집계 숫자만 돌려줍니다.
- 개별 투표(`truemask.votes`)는 결과를 공개하는 즉시 삭제됩니다.
- 각 참가자는 입장할 때 비밀 토큰을 받습니다. 토큰이 없으면 남의 자리로 투표할 수 없습니다.
- Realtime으로 나가는 것은 "방 상태가 바뀌었다"는 버전 숫자뿐이고, 앱은 그 신호를 받으면 함수로 새 상태를 받아옵니다.
- 위 내용은 `supabase/test`의 테스트로 확인합니다 (앱과 같은 anon 권한으로 테이블 직접 조회 시 거부되는지 등).
- 2명이면 내 답으로 상대 답을 알 수 있으므로 **3명 미만이면 시작할 수 없고**, 게임 중 3명 미만으로 줄면 대기실로 돌아갑니다.
- 방장이 일찍 공개하는 것도 3명 이상 투표했을 때만 가능합니다.

## 유료화: 성별 공개 (프리미엄)

혼성 모드에서 방장이 잠금을 해제하면 결과에 **“예”를 누른 남자 / 여자 인원**이 추가로 표시됩니다.

- **익명 보호 장치:** 한 성별이 1명뿐인 질문은 성별 내역을 숨깁니다. 여자 1명뿐인데 “여자 1명이 예”라고 나오면 그 사람 답이 그대로 드러나기 때문입니다.
- **지금은 개발용 모의 결제입니다.** 앱이 `mock-receipt`를 보내면 `tm_unlock_premium` 함수가 받아줍니다. 출시 전에 할 일은 세 가지입니다.
  1. 앱의 `src/screens/PremiumCard.tsx`에 RevenueCat 결제를 연결합니다.
  2. 영수증을 검증하고 secret 키로 방의 `premium`을 켜는 Supabase Edge Function을 만듭니다.
  3. `truemask.config` 테이블의 `allow_mock_premium`을 `false`로 바꿉니다.

## 질문 추가·수정

Supabase 대시보드 → Table Editor → 스키마 `truemask` → `questions` 테이블에서 추가·수정합니다. `mode`는 `common`(모든 모드), `mixed`, `male`, `female` 중 하나이고, `enabled`를 끄면 숨겨집니다. 앱을 다시 배포할 필요가 없습니다.

## 출시까지 남은 일

- [ ] 인앱결제 연동 + Edge Function 영수증 검증
- [ ] 앱 아이콘과 스플래시 이미지 (`app/assets`)
- [ ] `eas build` → `eas submit`으로 스토어 제출
- [ ] 방 만들기 남용 방지 (공개키로 누구나 함수를 부를 수 있으므로, 사용자가 늘면 요청 제한 추가)

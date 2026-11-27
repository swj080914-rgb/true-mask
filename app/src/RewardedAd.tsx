import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Button, C, DISPLAY_FONT } from './ui';
import { Mascot } from './Mascot';
import { mockAdToken } from './purchases';
import { COPY } from './copy';

/** 가짜 광고 길이(초). 실제 보상형 광고는 보통 15~30초 */
const MOCK_AD_SECONDS = 5;

/**
 * 보상형 광고 (지금은 개발용 가짜 광고 화면)
 * 끝까지 보면 onReward(광고 확인 토큰), 중간에 닫으면 onClose 만 부른다.
 * TODO(출시): react-native-google-mobile-ads 의 RewardedAd 로 교체 (purchases.ts 참고)
 */
export function RewardedAd({ visible, onReward, onClose }: {
  visible: boolean;
  onReward: (token: string) => void;
  onClose: () => void;
}) {
  const [left, setLeft] = useState(MOCK_AD_SECONDS);

  useEffect(() => {
    if (!visible) return;
    setLeft(MOCK_AD_SECONDS);
    const t = setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(t);
  }, [visible]);

  const done = left === 0;
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.box}>
          <Text style={s.tag}>{COPY.adTag}</Text>
          <Mascot width={110} />
          <Text style={s.title}>{COPY.adTitle}</Text>
          <Text style={s.count}>{done ? COPY.adDone : `${left}초`}</Text>
          {done ? (
            <Button testID="ad-reward" kind="gold" title={COPY.adReward} onPress={() => onReward(mockAdToken())} style={s.btn} />
          ) : (
            <Button testID="ad-close" kind="ghost" title={COPY.adClose} onPress={onClose} style={s.btn} />
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(5,3,12,0.88)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  box: {
    width: '100%', maxWidth: 400, backgroundColor: C.card, borderRadius: 24, borderWidth: 2, borderColor: C.cardBorder,
    padding: 24, alignItems: 'center', gap: 10,
  },
  tag: { color: C.sub, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  title: { color: C.text, fontSize: 18, fontWeight: '900' },
  count: { fontFamily: DISPLAY_FONT, color: C.gold, fontSize: 36 },
  btn: { alignSelf: 'stretch', marginTop: 6 },
});

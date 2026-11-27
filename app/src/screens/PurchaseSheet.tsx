import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Game } from '../useGame';
import type { RoomState } from '../protocol';
import { Button, C } from '../ui';
import { ADS_AVAILABLE, PURCHASES_AVAILABLE } from '../purchases';
import { COPY } from '../copy';

/**
 * 최종 결과에서 잠긴 질문(또는 "전부 보기")을 누르면 아래에서 올라오는 선택창.
 * - 광고: 방장만, 판마다 1번, 질문을 눌러서 열었을 때만 (그 질문 하나를 연다)
 * - 1회권: 참가자 누구나 (이번 판 전부)
 * - 평생권: 이미 가진 사람에겐 안 보임
 */
export function PurchaseSheet({ game, state, isHost, questionIdx, onClose, onWatchAd }: {
  game: Game;
  state: RoomState;
  isHost: boolean;
  /** 누른 질문 번호. "전부 보기"로 열었으면 -1, 닫혀 있으면 null */
  questionIdx: number | null;
  onClose: () => void;
  onWatchAd: (idx: number) => void;
}) {
  const visible = questionIdx !== null;
  const canAd = isHost && ADS_AVAILABLE && state.adAvailable && questionIdx !== null && questionIdx >= 0;
  const buy = async (fn: () => Promise<boolean>) => {
    if (await fn()) onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <View style={s.grip} />
          <Text style={s.title}>{COPY.sheetTitle}</Text>
          {canAd && (
            <Button testID="sheet-ad" kind="secondary" title={COPY.sheetAd} onPress={() => onWatchAd(questionIdx!)} style={s.btn} />
          )}
          {PURCHASES_AVAILABLE ? (
            <>
              <Button
                testID="buy-one"
                kind="gold"
                title={COPY.sheetOneGame}
                onPress={() => void buy(game.buyOneGame)}
                loading={game.busy}
                style={s.btn}
              />
              {!game.lifetime && (
                <Button testID="buy-lifetime" kind="secondary" title={COPY.sheetLifetime} onPress={() => void buy(game.buyLifetime)} style={s.btn} />
              )}
            </>
          ) : (
            <Text style={s.note}>{COPY.sheetAppOnly}</Text>
          )}
          <Text style={s.note}>{COPY.sheetFooter}</Text>
          <Button kind="ghost" title={COPY.sheetClose} onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(5,3,12,0.7)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 2, borderColor: C.cardBorder,
    padding: 20, paddingBottom: 32, gap: 4, width: '100%', maxWidth: 480, alignSelf: 'center',
  },
  grip: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: C.cardBorder, marginBottom: 12 },
  title: { color: C.gold, fontSize: 20, fontWeight: '900', textAlign: 'center', marginBottom: 6 },
  btn: { marginTop: 10 },
  note: { color: C.sub, fontSize: 13, textAlign: 'center', marginTop: 12 },
});

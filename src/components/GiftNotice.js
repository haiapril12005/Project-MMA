import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius } from '../theme';
import { formatVND, giftFor, nextGiftFor } from '../utils';
import { Icon, Txt } from './ui';

// Quà tặng đơn hiện tại + nhắc mua thêm để lên mốc quà kế tiếp
export default function GiftNotice({ rules, itemsTotal, style }) {
  const gift = giftFor(rules, itemsTotal);
  const next = nextGiftFor(rules, itemsTotal);
  if (!gift && !next) return null;
  return (
    <View style={[s.box, style]}>
      <Icon name="gift-outline" size={22} color={colors.primary} />
      <View style={{ flex: 1, gap: 2 }}>
        {!!gift && <Txt v="bodyStrong" style={{ fontSize: 14 }}>{`Quà tặng: ${gift.product.name}`}</Txt>}
        {!!next && (
          <Txt v="small" color={colors.inkSoft}>
            {`Mua thêm ${formatVND(next.minTotal - itemsTotal)} để ${gift ? 'đổi sang quà' : 'nhận quà'} ${next.product.name}`}
          </Txt>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.input, backgroundColor: colors.primarySoft },
});

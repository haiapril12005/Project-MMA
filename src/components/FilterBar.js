import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Chip, Menu, Text } from 'react-native-paper';
import { CATEGORIES, PRICE_RANGES, SORTS } from '../utils';

export default function FilterBar({ cat, setCat, range, setRange, sort, setSort, count }) {
  const [open, setOpen] = useState(false);
  const row = { paddingHorizontal: 12, gap: 8, paddingVertical: 4 };
  return (
    <View style={{ paddingBottom: 4 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={row}>
        {CATEGORIES.map((c) => <Chip key={c} selected={cat === c} onPress={() => setCat(c)} showSelectedCheck={false} mode={cat === c ? 'flat' : 'outlined'}>{c}</Chip>)}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={row}>
        {PRICE_RANGES.map((r, i) => <Chip key={r.label} icon="tag-outline" selected={range === i} onPress={() => setRange(i)} showSelectedCheck={false} mode={range === i ? 'flat' : 'outlined'}>{r.label}</Chip>)}
      </ScrollView>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16 }}>
        <Text variant="bodyMedium">{count} sản phẩm</Text>
        <Menu visible={open} onDismiss={() => setOpen(false)} anchor={<Button icon="sort" onPress={() => setOpen(true)}>{SORTS.find((s) => s.key === sort).label}</Button>}>
          {SORTS.map((s) => <Menu.Item key={s.key} title={s.label} onPress={() => { setSort(s.key); setOpen(false); }} />)}
        </Menu>
      </View>
    </View>
  );
}

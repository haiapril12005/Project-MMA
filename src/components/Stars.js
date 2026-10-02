import React from 'react';
import { Pressable, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Hiển thị sao; truyền onChange để cho phép chọn sao
export default function Stars({ value = 0, size = 18, onChange }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {[1, 2, 3, 4, 5].map((i) => {
        const name = value >= i ? 'star' : value >= i - 0.5 ? 'star-half-full' : 'star-outline';
        const icon = <MaterialCommunityIcons name={name} size={size} color="#C99A2E" />;
        return onChange ? (
          <Pressable key={i} onPress={() => onChange(i)} hitSlop={6} style={{ padding: 4 }} accessibilityLabel={`${i} sao`}>{icon}</Pressable>
        ) : <View key={i}>{icon}</View>;
      })}
    </View>
  );
}

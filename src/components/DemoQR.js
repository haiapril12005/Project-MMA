import React, { useMemo } from 'react';
import { View } from 'react-native';
import { colors } from '../theme';

// Mã QR MINH HỌA (không quét để chuyển tiền được): vẽ lưới ô vuông từ nội dung chuyển khoản,
// có 3 ô định vị ở góc giống QR thật. Dùng để demo bước khách chuyển khoản tiền cọc.
const SIZE = 21;

const isFinder = (row, col) => {
  const inBox = (r0, c0) => row >= r0 && row < r0 + 7 && col >= c0 && col < c0 + 7;
  return inBox(0, 0) || inBox(0, SIZE - 7) || inBox(SIZE - 7, 0);
};

const finderCell = (row, col) => {
  const r = row >= SIZE - 7 ? row - (SIZE - 7) : row;
  const c = col >= SIZE - 7 ? col - (SIZE - 7) : col;
  const ring = Math.max(Math.abs(r - 3), Math.abs(c - 3));
  return ring !== 2; // viền ngoài đen, vòng trắng, lõi 3x3 đen
};

export default function DemoQR({ value, size = 168 }) {
  const cells = useMemo(() => {
    let seed = 0;
    for (const ch of String(value)) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const next = () => {
      seed = (seed * 1103515245 + 12345) >>> 0;
      return seed % 100;
    };
    return Array.from({ length: SIZE * SIZE }, (_, index) => {
      const row = Math.floor(index / SIZE);
      const col = index % SIZE;
      if (isFinder(row, col)) return finderCell(row, col);
      const nearFinder = (row < 8 && (col < 8 || col > SIZE - 9)) || (row > SIZE - 9 && col < 8);
      return !nearFinder && next() < 48;
    });
  }, [value]);

  // Gộp các ô liền nhau cùng màu thành một khối để vẽ ít View hơn
  const rows = useMemo(() => Array.from({ length: SIZE }, (_, row) => {
    const runs = [];
    for (let col = 0; col < SIZE; col += 1) {
      const dark = cells[row * SIZE + col];
      const last = runs[runs.length - 1];
      if (last && last.dark === dark) last.length += 1;
      else runs.push({ dark, length: 1 });
    }
    return runs;
  }), [cells]);

  const cell = size / SIZE;
  return (
    <View
      accessible
      accessibilityLabel="Mã QR minh họa"
      style={{ width: size + 16, padding: 8, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: colors.line }}
    >
      {rows.map((runs, row) => (
        <View key={row} style={{ flexDirection: 'row', height: cell }}>
          {runs.map((run, index) => (
            <View key={index} style={{ width: run.length * cell, backgroundColor: run.dark ? '#1F1A17' : '#FFFFFF' }} />
          ))}
        </View>
      ))}
    </View>
  );
}

// Bảng màu "Gỗ ấm": nền vải lanh sáng, nhấn màu đất nung dịu, chữ nâu cacao.
// Không dùng màu chói và không dùng nền tối. Muốn đổi tông cả app thì chỉ cần sửa ở đây.

export const colors = {
  bg: '#F6F0E9', // nền chính, lanh ấm
  surface: '#FFFBF6', // nền thẻ, ô nhập
  sunken: '#EFE6DC', // nền ảnh chờ tải, ô chip chưa chọn
  line: '#E6D9CB', // đường kẻ, viền
  ink: '#4A3A30', // chữ chính, nâu cacao (không dùng đen)
  inkSoft: '#76655A', // chữ phụ
  inkMuted: '#7A685C', // placeholder, chú thích
  primary: '#985333', // đất nung dịu, màu nhấn duy nhất
  primaryPressed: '#834A2F',
  primarySoft: '#F2E1D4', // nền nhạt của màu nhấn
  onPrimary: '#FFF8F2',
  star: '#C9973F', // màu sao đánh giá
  success: '#5B744D', // xanh ô liu dịu cho trạng thái còn hàng
  danger: '#99423A',
  scrim: 'rgba(74, 58, 48, 0.42)',
};

// Font Be Vietnam Pro hiển thị dấu tiếng Việt rất đẹp (nạp trong App.js)
export const fonts = {
  regular: 'BeVietnamPro_400Regular',
  medium: 'BeVietnamPro_500Medium',
  semibold: 'BeVietnamPro_600SemiBold',
  bold: 'BeVietnamPro_700Bold',
};

// Một thang bo góc duy nhất: thẻ 20, ảnh 16, ô nhập 14, nút và chip dạng viên thuốc
export const radius = { sm: 10, input: 14, img: 16, card: 20, sheet: 28, pill: 999 };

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };

export const SCREEN_PADDING = 20;

// Bóng đổ nhuộm màu nâu, nhẹ
export const shadow = {
  shadowColor: '#6B4A35',
  shadowOpacity: 0.08,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
};

export const navTheme = {
  dark: false,
  colors: {
    primary: colors.primary,
    background: colors.bg,
    card: colors.surface,
    text: colors.ink,
    border: colors.line,
    notification: colors.primary,
  },
  fonts: {
    regular: { fontFamily: fonts.regular, fontWeight: '400' },
    medium: { fontFamily: fonts.medium, fontWeight: '500' },
    bold: { fontFamily: fonts.semibold, fontWeight: '600' },
    heavy: { fontFamily: fonts.bold, fontWeight: '700' },
  },
};

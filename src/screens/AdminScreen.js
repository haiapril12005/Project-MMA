import React, { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { useAdminDashboard } from '../hooks/useAdminDashboard';
import { colors, radius, SCREEN_PADDING } from '../theme';
import { deliveryZone, formatDateOnly, formatVND, orderStatus } from '../utils';
import { Button, Chip, EmptyState, Icon, IconButton, Skeleton, Txt } from '../components/ui';

const PERIODS = [
  { days: 7, label: '7 ngày' },
  { days: 30, label: '30 ngày' },
  { days: 365, label: '12 tháng' },
];

export default function AdminScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const [days, setDays] = useState(30);
  const { data, loading, error, retry } = useAdminDashboard(days);
  // Quay lại màn này (ví dụ sau khi nhận cọc ở tab Đơn hàng) thì tải lại số liệu mới
  const firstFocus = useRef(true);
  useFocusEffect(useCallback(() => {
    if (firstFocus.current) { firstFocus.current = false; return; }
    retry();
  }, [retry]));

  const header = (
    <View style={[s.header, { paddingTop: insets.top + 10 }]}>
      {!route?.params?.tab && <IconButton icon="chevron-left" iconSize={26} label="Quay lại" onPress={() => navigation.goBack()} />}
      <View style={{ flex: 1, paddingLeft: route?.params?.tab ? 4 : 0 }}>
        <Txt v="title">Thống kê cửa hàng</Txt>
        <Txt v="small" color={colors.inkSoft}>Thu chi, sản phẩm, lịch giao</Txt>
      </View>
    </View>
  );

  if (!user?.isAdmin) {
    return (
      <View style={s.screen}>
        {header}
        <EmptyState icon="shield-lock-outline" title="Chỉ dành cho quản trị viên" text="Tài khoản này không có quyền xem thống kê." action="Quay lại" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  const summary = data?.summary;
  const grossProfit = summary ? summary.revenue - summary.costOfGoods - (summary.afterSalesCost ?? 0) : 0;
  const maxCategory = Math.max(1, ...(data?.categories || []).map((item) => item.revenue));

  return (
    <View style={s.screen}>
      {header}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: SCREEN_PADDING, paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={retry} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        <Button title="Quản lý đơn hàng" icon="clipboard-list-outline" variant="soft" onPress={() => navigation.navigate('AdminOrders')} style={{ marginBottom: 14 }} />

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          {PERIODS.map((period) => <Chip key={period.days} label={period.label} selected={days === period.days} onPress={() => setDays(period.days)} />)}
        </View>

        {error ? (
          <EmptyState icon="alert-circle-outline" title="Chưa tải được thống kê" text={error} action="Thử lại" onPress={retry} />
        ) : !summary ? (
          <View style={{ gap: 12 }}>
            <Skeleton style={{ height: 96, borderRadius: radius.card }} />
            <Skeleton style={{ height: 96, borderRadius: radius.card }} />
            <Skeleton style={{ height: 180, borderRadius: radius.card }} />
          </View>
        ) : (
          <>
            {/* Thu - chi - lợi nhuận */}
            <View style={s.kpiGrid}>
              <Kpi icon="cash-plus" label="Thu (đơn đã giao)" value={formatVND(summary.revenue)} color={colors.success} />
              <Kpi icon="cash-minus" label="Chi (giá vốn)" value={formatVND(summary.costOfGoods)} color={colors.danger} />
              <Kpi icon="chart-line" label="Lợi nhuận gộp" value={formatVND(grossProfit)} color={grossProfit >= 0 ? colors.primary : colors.danger} />
              <Kpi icon="receipt-text-outline" label="Đơn trong kỳ" value={`${summary.orderCount} đơn`} note={`${summary.deliveredCount} đã giao · ${summary.cancelledCount} đã hủy`} />
            </View>

            <Section icon="chart-bar" title={days > 31 ? 'Thu chi theo tháng' : 'Thu chi theo ngày'} />
            <RevenueChart series={data.series || []} />

            <Section icon="swap-vertical" title="Chi tiết dòng tiền" />
            <View style={s.card}>
              <Line label="Tiền hàng đã giao" value={formatVND(summary.goodsRevenue)} />
              <Line label="Phí giao và lắp đặt đã thu" value={formatVND(summary.shippingRevenue)} />
              <Line label="Giá vốn hàng đã giao" value={`-${formatVND(summary.costOfGoods)}`} color={colors.danger} />
              {summary.giftCost > 0 && <Line label="  Trong đó: quà tặng" value={`-${formatVND(summary.giftCost)}`} color={colors.danger} />}
              <Line label="Chi phí sau bán (tổn thất, đổi trả, bảo hành)" value={`-${formatVND(summary.afterSalesCost ?? 0)}`} color={colors.danger} />
              <Line label="Tiền cọc đã nhận (đơn trong kỳ)" value={formatVND(summary.depositsReceived ?? 0)} />
              <Line label="Tiền cọc đang giữ (đơn chưa giao xong)" value={formatVND(summary.depositsHeld)} />
              <Line label="Tiền cọc phải hoàn (đơn hủy)" value={formatVND(summary.refundedDeposits)} />
              <Line label="Giá trị đơn đang xử lý" value={formatVND(summary.openOrderValue)} last />
            </View>
            <Txt v="caption" color={colors.inkMuted} style={{ marginTop: 6 }}>Giá vốn lấy từ cột cost_price của sản phẩm; dữ liệu mẫu đang để 60% giá niêm yết.</Txt>

            <Section icon="clipboard-list-outline" title="Đơn theo trạng thái" />
            <View style={s.chipWrap}>
              {Object.entries(data.statusCounts || {}).length === 0 && <Txt v="small" color={colors.inkSoft}>Chưa có đơn trong kỳ.</Txt>}
              {Object.entries(data.statusCounts || {}).map(([status, count]) => {
                const info = orderStatus(status);
                return (
                  <Pressable
                    key={status}
                    onPress={() => navigation.navigate('AdminOrders', { status })}
                    accessibilityRole="button"
                    accessibilityLabel={`Xem đơn ${info.label}`}
                    style={[s.statusPill, { backgroundColor: info.bg }]}
                  >
                    <Icon name={info.icon} size={15} color={info.color} />
                    <Txt v="caption" color={info.color}>{`${info.label}: ${count}`}</Txt>
                  </Pressable>
                );
              })}
            </View>

            <Section icon="shape-outline" title="Doanh thu theo danh mục" />
            <View style={s.card}>
              {!data.categories.length && <Txt v="small" color={colors.inkSoft}>Chưa có đơn đã giao trong kỳ.</Txt>}
              {data.categories.map((item) => (
                <View key={item.category} style={{ gap: 6 }}>
                  <View style={s.lineRow}>
                    <Txt v="bodyStrong" style={{ fontSize: 14 }}>{item.category}</Txt>
                    <Txt v="small">{formatVND(item.revenue)}</Txt>
                  </View>
                  <View style={s.barTrack}><View style={[s.barFill, { width: `${Math.round((item.revenue / maxCategory) * 100)}%` }]} /></View>
                  <Txt v="caption" color={colors.inkSoft}>{`Lãi gộp ${formatVND(item.revenue - item.cost)}`}</Txt>
                </View>
              ))}
            </View>

            <Section icon="trophy-outline" title="Sản phẩm bán chạy" />
            <View style={s.card}>
              {!data.topProducts.length && <Txt v="small" color={colors.inkSoft}>Chưa có sản phẩm bán ra trong kỳ.</Txt>}
              {data.topProducts.map((item, index) => (
                <View key={item.productId} style={[s.lineRow, { alignItems: 'flex-start' }]}>
                  <Txt v="bodyStrong" color={colors.primary} style={{ width: 22 }}>{index + 1}</Txt>
                  <View style={{ flex: 1 }}>
                    <Txt v="bodyStrong" numberOfLines={2} style={{ fontSize: 14 }}>{item.name}</Txt>
                    <Txt v="caption" color={colors.inkSoft}>{`Đã bán ${item.quantity} · lãi gộp ${formatVND(item.revenue - item.cost)}`}</Txt>
                  </View>
                  <Txt v="small">{formatVND(item.revenue)}</Txt>
                </View>
              ))}
            </View>

            <Section icon="package-variant" title="Màu sắp hết hàng (còn ≤ 2)" />
            <View style={s.card}>
              {!data.lowStock.length && <Txt v="small" color={colors.inkSoft}>Không có màu nào sắp hết.</Txt>}
              {data.lowStock.map((item) => (
                <View key={`${item.productId}:${item.color}`} style={s.lineRow}>
                  <Txt v="small" style={{ flex: 1 }} numberOfLines={1}>{`${item.name} · ${item.color || 'Mặc định'}`}</Txt>
                  <Txt v="bodyStrong" color={item.stock ? colors.ink : colors.danger}>{item.stock ? `còn ${item.stock}` : 'hết'}</Txt>
                </View>
              ))}
            </View>

            <Section icon="truck-delivery-outline" title="Lịch giao gộp theo ngày và khu vực" />
            <Txt v="caption" color={colors.inkMuted} style={{ marginBottom: 8 }}>Đơn cùng ngày, cùng khu vực được xếp chung một chuyến xe.</Txt>
            {!data.deliveryPlan.length && <View style={s.card}><Txt v="small" color={colors.inkSoft}>Chưa có đơn nào sắp giao.</Txt></View>}
            <View style={{ gap: 10 }}>
              {data.deliveryPlan.map((trip) => (
                <View key={`${trip.date}:${trip.zone}`} style={s.card}>
                  <View style={s.lineRow}>
                    <Txt v="bodyStrong" style={{ flex: 1 }}>{formatDateOnly(trip.date)}</Txt>
                    <Txt v="caption" color={colors.primary}>{`${trip.orderCount} đơn · ${trip.itemCount} món`}</Txt>
                  </View>
                  <Txt v="small" color={colors.inkSoft}>{deliveryZone(trip.zone)?.label || 'Chưa chọn khu vực'}</Txt>
                  {trip.orders.map((order) => (
                    <View key={order.code} style={s.tripOrder}>
                      <Txt v="caption" color={colors.ink}>{`${order.timeSlot} · ${order.code} · ${orderStatus(order.status).label}${order.staff ? ` · NV ${order.staff}` : ''}`}</Txt>
                      <Txt v="caption" color={colors.inkSoft} numberOfLines={1}>{order.address}</Txt>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// Cột xanh = thu, cột đỏ = chi; cao theo giá trị lớn nhất trong kỳ
function RevenueChart({ series }) {
  const max = Math.max(1, ...series.map((point) => Math.max(point.revenue, point.cost)));
  const hasData = series.some((point) => point.revenue > 0 || point.cost > 0);
  return (
    <View style={s.card}>
      <View style={{ flexDirection: 'row', gap: 16 }}>
        <Legend color={colors.success} label="Thu" />
        <Legend color={colors.danger} label="Chi (giá vốn)" />
      </View>
      {!hasData && <Txt v="small" color={colors.inkSoft}>Chưa có đơn đã giao trong kỳ.</Txt>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'flex-end', gap: 6, paddingTop: 6 }}>
        {series.map((point) => (
          <View key={point.label} style={{ alignItems: 'center', width: 34 }} accessible accessibilityLabel={`${point.label}: thu ${formatVND(point.revenue)}, chi ${formatVND(point.cost)}`}>
            <View style={s.chartBars}>
              <View style={[s.chartBar, { height: Math.max(2, (point.revenue / max) * 120), backgroundColor: colors.success }]} />
              <View style={[s.chartBar, { height: Math.max(2, (point.cost / max) * 120), backgroundColor: colors.danger }]} />
            </View>
            <Txt v="caption" color={colors.inkMuted} style={{ fontSize: 10.5, marginTop: 4 }}>{point.label}</Txt>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function Legend({ color, label }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
      <Txt v="caption" color={colors.inkSoft}>{label}</Txt>
    </View>
  );
}

function Kpi({ icon, label, value, note, color = colors.ink }) {
  return (
    <View style={s.kpi}>
      <Icon name={icon} size={20} color={color} />
      <Txt v="caption" color={colors.inkMuted} style={{ marginTop: 6 }}>{label}</Txt>
      <Txt v="bodyStrong" color={color}>{value}</Txt>
      {!!note && <Txt v="caption" color={colors.inkSoft}>{note}</Txt>}
    </View>
  );
}

function Section({ icon, title }) {
  return (
    <View style={s.section}>
      <Icon name={icon} size={19} color={colors.primary} />
      <Txt v="subtitle">{title}</Txt>
    </View>
  );
}

function Line({ label, value, color = colors.ink, last }) {
  return (
    <View style={[s.lineRow, !last && s.divider]}>
      <Txt v="small" color={colors.inkSoft} style={{ flex: 1 }}>{label}</Txt>
      <Txt v="small" color={color}>{value}</Txt>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: SCREEN_PADDING - 4, paddingBottom: 12 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpi: { flexGrow: 1, flexBasis: '45%', backgroundColor: colors.surface, borderRadius: radius.card, padding: 14 },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 14, gap: 12 },
  section: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 10 },
  lineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.bg, paddingBottom: 10 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.bg, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 122 },
  chartBar: { width: 12, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  tripOrder: { borderLeftWidth: 3, borderLeftColor: colors.primarySoft, paddingLeft: 10, gap: 2 },
});

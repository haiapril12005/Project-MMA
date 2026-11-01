import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { colors, radius, SCREEN_PADDING } from '../theme';
import { Button, Field, IconButton, Txt } from '../components/ui';

const AUTH_IMG = 'https://images.pexels.com/photos/4112598/pexels-photo-4112598.jpeg?auto=compress&cs=tinysrgb&w=1000';

// Khung chung cho các màn nhập liệu
function Shell({ title, subtitle, image, children, navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {image ? (
          <View style={s.cover}>
            <Image source={{ uri: AUTH_IMG }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            <View style={s.coverScrim} />
          </View>
        ) : <View style={{ height: insets.top + 64 }} />}
        <View style={[s.body, image && s.bodyOverlap]}>
          <Txt v="display">{title}</Txt>
          <Txt v="body" color={colors.inkSoft} style={{ marginTop: 6, marginBottom: 22 }}>{subtitle}</Txt>
          <View style={{ gap: 16 }}>{children}</View>
        </View>
      </ScrollView>
      <IconButton icon={image ? 'close' : 'chevron-left'} iconSize={image ? 22 : 26} onPress={() => navigation.goBack()} label="Đóng" bg="rgba(255, 251, 246, 0.94)" style={[s.back, { top: insets.top + 8 }]} />
    </KeyboardAvoidingView>
  );
}

const FormError = ({ text }) => (text ? <View style={s.formError}><Txt v="small" color={colors.danger}>{text}</Txt></View> : null);
const FormNotice = ({ text }) => (text ? <View style={s.formNotice}><Txt v="small" color={colors.success}>{text}</Txt></View> : null);

export function LoginScreen({ navigation, route }) {
  const { login, resendConfirmation } = useApp();
  const [email, setEmail] = useState(route.params?.email || '');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState(route.params?.notice || '');
  const [needsConfirmation, setNeedsConfirmation] = useState(Boolean(route.params?.needsConfirmation));
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const submit = async () => {
    if (!email.trim() || !pw) { setErr('Nhập email và mật khẩu để tiếp tục.'); return; }
    setBusy(true); setErr(''); setNotice('');
    try { await login(email, pw); navigation.goBack(); } catch (e) {
      setErr(e.message);
      setNeedsConfirmation(e.code === 'email_not_confirmed');
      setBusy(false);
    }
  };
  const resend = async () => {
    setResending(true); setErr(''); setNotice('');
    try {
      await resendConfirmation(email);
      setNotice('Đã gửi lại email xác nhận. Hãy kiểm tra cả hộp thư Spam/Thư rác.');
    } catch (e) { setErr(e.message); }
    setResending(false);
  };
  return (
    <Shell navigation={navigation} image title="Đăng nhập" subtitle="Tiếp tục chọn nội thất cho ngôi nhà của bạn.">
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="ban@email.com" />
      <Field label="Mật khẩu" value={pw} onChangeText={setPw} secure placeholder="Ít nhất 6 ký tự" onSubmitEditing={submit} />
      <FormNotice text={notice} />
      <FormError text={err} />
      <Button title="Đăng nhập" onPress={submit} loading={busy} />
      {needsConfirmation && <Button title="Gửi lại email xác nhận" variant="soft" onPress={resend} loading={resending} />}
      <Pressable onPress={() => navigation.replace('Register')} style={{ alignSelf: 'center', padding: 8 }}>
        <Txt v="small" color={colors.inkSoft}>Chưa có tài khoản? <Txt v="small" color={colors.primary} style={{ textDecorationLine: 'underline' }}>Đăng ký</Txt></Txt>
      </Pressable>
    </Shell>
  );
}

export function RegisterScreen({ navigation }) {
  const { register, notify } = useApp();
  const [f, setF] = useState({ name: '', email: '', pw: '', pw2: '' });
  const [errs, setErrs] = useState({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => { setF({ ...f, [k]: v }); setErrs({ ...errs, [k]: undefined }); };
  const submit = async () => {
    const e = {};
    if (!f.name.trim()) e.name = 'Nhập họ và tên.';
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = 'Email chưa đúng định dạng.';
    if (f.pw.length < 6) e.pw = 'Mật khẩu cần ít nhất 6 ký tự.';
    if (f.pw !== f.pw2) e.pw2 = 'Mật khẩu nhập lại không khớp.';
    setErrs(e);
    if (Object.keys(e).length) return;
    setBusy(true); setErr('');
    try {
      const result = await register({ name: f.name, email: f.email, password: f.pw });
      setBusy(false);
      if (result.needsEmailConfirmation) {
        notify('Đã tạo tài khoản. Hãy xác nhận email trước khi đăng nhập.');
        navigation.replace('Login', {
          email: f.email.trim(),
          needsConfirmation: true,
          notice: 'Đăng ký thành công. Supabase đã gửi liên kết xác nhận đến email của bạn.',
        });
      } else {
        navigation.goBack();
      }
    } catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <Shell navigation={navigation} image title="Tạo tài khoản" subtitle="Chỉ mất một phút để bắt đầu mua sắm.">
      <Field label="Họ và tên" value={f.name} onChangeText={set('name')} error={errs.name} placeholder="Nguyễn Văn An" />
      <Field label="Email" value={f.email} onChangeText={set('email')} error={errs.email} autoCapitalize="none" keyboardType="email-address" placeholder="ban@email.com" />
      <Field label="Mật khẩu" value={f.pw} onChangeText={set('pw')} error={errs.pw} secure helper="Ít nhất 6 ký tự" />
      <Field label="Nhập lại mật khẩu" value={f.pw2} onChangeText={set('pw2')} error={errs.pw2} secure />
      <FormError text={err} />
      <Button title="Đăng ký" onPress={submit} loading={busy} />
      <Pressable onPress={() => navigation.replace('Login')} style={{ alignSelf: 'center', padding: 8 }}>
        <Txt v="small" color={colors.inkSoft}>Đã có tài khoản? <Txt v="small" color={colors.primary} style={{ textDecorationLine: 'underline' }}>Đăng nhập</Txt></Txt>
      </Pressable>
    </Shell>
  );
}

export function EditProfileScreen({ navigation }) {
  const { user, updateProfile, notify } = useApp();
  const [f, setF] = useState({ name: user.name, phone: user.phone || '', address: user.address || '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF({ ...f, [k]: v });
  const submit = async () => {
    if (!f.name.trim()) { setErr('Tên không được để trống.'); return; }
    setBusy(true);
    const ok = await updateProfile({ name: f.name.trim(), phone: f.phone.trim(), address: f.address.trim() });
    setBusy(false);
    if (ok) { notify('Đã lưu thông tin'); navigation.goBack(); }
  };
  return (
    <Shell navigation={navigation} title="Sửa thông tin" subtitle="Thông tin này dùng để giao hàng và lắp đặt.">
      <Field label="Email" value={user.email} editable={false} helper="Email dùng để đăng nhập nên không đổi được." />
      <Field label="Họ và tên" value={f.name} onChangeText={set('name')} error={err} />
      <Field label="Số điện thoại" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" placeholder="0901 234 567" />
      <Field label="Địa chỉ giao hàng" value={f.address} onChangeText={set('address')} multiline placeholder="Số nhà, đường, phường, quận" />
      <Button title="Lưu thay đổi" onPress={submit} loading={busy} style={{ marginTop: 6 }} />
    </Shell>
  );
}

export function ChangePasswordScreen({ navigation }) {
  const { changePassword, notify } = useApp();
  const [f, setF] = useState({ old: '', pw: '', pw2: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => { setF({ ...f, [k]: v }); setErr(''); };
  const submit = async () => {
    if (f.pw.length < 6) return setErr('Mật khẩu mới cần ít nhất 6 ký tự.');
    if (f.pw !== f.pw2) return setErr('Mật khẩu nhập lại không khớp.');
    setBusy(true);
    try {
      const ok = await changePassword(f.old, f.pw);
      setBusy(false);
      if (ok) { notify('Đã đổi mật khẩu'); navigation.goBack(); }
    } catch (e) { setErr(e.message); setBusy(false); }
    return undefined;
  };
  return (
    <Shell navigation={navigation} title="Đổi mật khẩu" subtitle="Nhập mật khẩu hiện tại và mật khẩu mới.">
      <Field label="Mật khẩu hiện tại" value={f.old} onChangeText={set('old')} secure />
      <Field label="Mật khẩu mới" value={f.pw} onChangeText={set('pw')} secure helper="Ít nhất 6 ký tự" />
      <Field label="Nhập lại mật khẩu mới" value={f.pw2} onChangeText={set('pw2')} secure />
      <FormError text={err} />
      <Button title="Đổi mật khẩu" onPress={submit} loading={busy} style={{ marginTop: 6 }} />
    </Shell>
  );
}

const s = StyleSheet.create({
  cover: { height: 240, backgroundColor: colors.sunken },
  coverScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(74, 52, 38, 0.18)' },
  body: { paddingHorizontal: SCREEN_PADDING, paddingTop: 8 },
  bodyOverlap: { marginTop: -28, paddingTop: 28, backgroundColor: colors.bg, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet },
  back: { position: 'absolute', left: SCREEN_PADDING - 4 },
  formError: { backgroundColor: '#F6E4DF', borderRadius: radius.input, paddingHorizontal: 14, paddingVertical: 10 },
  formNotice: { backgroundColor: '#E2EEE7', borderRadius: radius.input, paddingHorizontal: 14, paddingVertical: 10 },
});

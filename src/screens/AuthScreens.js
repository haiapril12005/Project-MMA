import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Button, HelperText, Text, TextInput, useTheme } from 'react-native-paper';
import { useApp } from '../context/AppContext';

function Shell({ title, subtitle, children }) {
  const { colors } = useTheme();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 12 }} keyboardShouldPersistTaps="handled">
        <Text variant="headlineMedium" style={{ color: colors.primary, fontWeight: '700' }}>{title}</Text>
        <Text style={{ color: colors.onSurfaceVariant, marginBottom: 8 }}>{subtitle}</Text>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function LoginScreen({ navigation }) {
  const { login } = useApp();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!email.trim() || !pw) { setErr('Nhập email và mật khẩu.'); return; }
    setBusy(true); setErr('');
    try { await login(email, pw); navigation.goBack(); } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  return (
    <Shell title="Chào mừng đến FurWorld" subtitle="Đăng nhập để lưu món yêu thích và đặt hàng. Tài khoản thử: demo@furworld.vn / 123456">
      <TextInput mode="outlined" label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput mode="outlined" label="Mật khẩu" value={pw} onChangeText={setPw} secureTextEntry />
      <HelperText type="error" visible={!!err}>{err}</HelperText>
      <Button mode="contained" onPress={submit} loading={busy} disabled={busy}>Đăng nhập</Button>
      <Button onPress={() => navigation.replace('Register')}>Chưa có tài khoản? Đăng ký</Button>
    </Shell>
  );
}

export function RegisterScreen({ navigation }) {
  const { register } = useApp();
  const [f, setF] = useState({ name: '', email: '', pw: '', pw2: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF({ ...f, [k]: v });
  const submit = async () => {
    if (!f.name.trim() || !f.email.trim() || !f.pw) return setErr('Điền đầy đủ các trường.');
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return setErr('Email chưa đúng định dạng.');
    if (f.pw.length < 6) return setErr('Mật khẩu cần ít nhất 6 ký tự.');
    if (f.pw !== f.pw2) return setErr('Mật khẩu nhập lại không khớp.');
    setBusy(true); setErr('');
    try { await register({ name: f.name, email: f.email, password: f.pw }); navigation.goBack(); } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  return (
    <Shell title="Tạo tài khoản" subtitle="Chỉ mất một phút để bắt đầu mua sắm.">
      <TextInput mode="outlined" label="Họ và tên" value={f.name} onChangeText={set('name')} />
      <TextInput mode="outlined" label="Email" value={f.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" />
      <TextInput mode="outlined" label="Mật khẩu" value={f.pw} onChangeText={set('pw')} secureTextEntry />
      <TextInput mode="outlined" label="Nhập lại mật khẩu" value={f.pw2} onChangeText={set('pw2')} secureTextEntry />
      <HelperText type="error" visible={!!err}>{err}</HelperText>
      <Button mode="contained" onPress={submit} loading={busy} disabled={busy}>Đăng ký</Button>
      <Button onPress={() => navigation.replace('Login')}>Đã có tài khoản? Đăng nhập</Button>
    </Shell>
  );
}

export function EditProfileScreen({ navigation }) {
  const { user, updateProfile } = useApp();
  const [f, setF] = useState({ name: user.name, phone: user.phone || '', address: user.address || '' });
  const [err, setErr] = useState('');
  const set = (k) => (v) => setF({ ...f, [k]: v });
  const submit = () => {
    if (!f.name.trim()) return setErr('Tên không được để trống.');
    updateProfile({ name: f.name.trim(), phone: f.phone.trim(), address: f.address.trim() });
    navigation.goBack();
  };
  return (
    <Shell title="Sửa thông tin" subtitle="Email dùng để đăng nhập nên không thể thay đổi.">
      <TextInput mode="outlined" label="Email" value={user.email} disabled />
      <TextInput mode="outlined" label="Họ và tên" value={f.name} onChangeText={set('name')} />
      <TextInput mode="outlined" label="Số điện thoại" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
      <TextInput mode="outlined" label="Địa chỉ giao hàng" value={f.address} onChangeText={set('address')} multiline />
      <HelperText type="error" visible={!!err}>{err}</HelperText>
      <Button mode="contained" onPress={submit}>Lưu thay đổi</Button>
    </Shell>
  );
}

export function ChangePasswordScreen({ navigation }) {
  const { changePassword } = useApp();
  const [f, setF] = useState({ old: '', pw: '', pw2: '' });
  const [err, setErr] = useState('');
  const set = (k) => (v) => setF({ ...f, [k]: v });
  const submit = () => {
    if (f.pw.length < 6) return setErr('Mật khẩu mới cần ít nhất 6 ký tự.');
    if (f.pw !== f.pw2) return setErr('Mật khẩu nhập lại không khớp.');
    try { changePassword(f.old, f.pw); navigation.goBack(); } catch (e) { setErr(e.message); }
  };
  return (
    <Shell title="Đổi mật khẩu" subtitle="Nhập mật khẩu hiện tại và mật khẩu mới.">
      <TextInput mode="outlined" label="Mật khẩu hiện tại" value={f.old} onChangeText={set('old')} secureTextEntry />
      <TextInput mode="outlined" label="Mật khẩu mới" value={f.pw} onChangeText={set('pw')} secureTextEntry />
      <TextInput mode="outlined" label="Nhập lại mật khẩu mới" value={f.pw2} onChangeText={set('pw2')} secureTextEntry />
      <HelperText type="error" visible={!!err}>{err}</HelperText>
      <Button mode="contained" onPress={submit}>Đổi mật khẩu</Button>
    </Shell>
  );
}

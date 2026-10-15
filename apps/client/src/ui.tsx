import React from 'react';
import { Pressable, Text, TextInput, View, StyleSheet } from 'react-native';
export const colors = { bg: '#0a1110', card: '#14201d', green: '#34d399', text: '#effaf5', muted: '#92a69e', border: '#293d35' };
export const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg }, content: { width: '100%', maxWidth: 1120, alignSelf: 'center', padding: 24, gap: 20, paddingBottom: 110 },
  title: { color: colors.text, fontSize: 32, fontWeight: '700', letterSpacing: -1 }, subtitle: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  card: { backgroundColor: colors.card, padding: 22, borderRadius: 20, borderWidth: 1, borderColor: colors.border, gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' }, label: { color: colors.text, fontSize: 16, fontWeight: '600' },
  input: { backgroundColor: '#0e1814', borderWidth: 1, borderColor: colors.border, padding: 14, borderRadius: 12, color: colors.text, minWidth: 100 },
  error: { color: '#fda4af', lineHeight: 22 }, button: { backgroundColor: colors.green, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 14, alignItems: 'center' },
});
export function Button({ title, onPress, disabled = false, quiet = false }: { title: string; onPress: () => void; disabled?: boolean; quiet?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[s.button, quiet && { backgroundColor: colors.border }, disabled && { opacity: .45 }]}><Text style={{ color: quiet ? colors.text : '#062019', fontWeight: '700' }}>{title}</Text></Pressable>;
}
export function Input({ label, value, onChangeText, numeric = false, secure = false }: { label: string; value: string; onChangeText: (v: string) => void; numeric?: boolean; secure?: boolean }) {
  return <View style={{ gap: 8, flexGrow: 1 }}><Text style={s.subtitle}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} style={s.input} keyboardType={numeric ? 'decimal-pad' : 'default'} secureTextEntry={secure} autoCapitalize="none" /></View>;
}
export function Card({ children }: React.PropsWithChildren) { return <View style={s.card}>{children}</View>; }

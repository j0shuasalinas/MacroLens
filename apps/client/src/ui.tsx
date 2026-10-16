import React from 'react';
import { Pressable, Text, TextInput, View, StyleSheet, type TextInputProps } from 'react-native';

export const colors = {
  bg: '#f7f8f5', card: '#ffffff', green: '#167451', text: '#17201c', muted: '#65716a',
  border: '#e6eae3', primary: '#18241e', soft: '#edf4eb', protein: '#b9534e',
  carbs: '#5278a4', fat: '#a47722', danger: '#ad333e',
};
export const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  content: { width: '100%', maxWidth: 1040, alignSelf: 'center', padding: 24, gap: 20, paddingBottom: 48 },
  title: { color: colors.text, fontSize: 34, fontWeight: '800', letterSpacing: -1.3 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  eyebrow: { color: colors.green, fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  card: { backgroundColor: colors.card, padding: 22, borderRadius: 26, borderWidth: 1, borderColor: colors.border, gap: 14 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' },
  label: { color: colors.text, fontSize: 17, fontWeight: '700', letterSpacing: -.3 },
  input: { backgroundColor: '#f7f8f5', borderWidth: 1, borderColor: colors.border, padding: 14, borderRadius: 14, color: colors.text, minWidth: 100, fontSize: 16, minHeight: 50 },
  error: { color: colors.danger, lineHeight: 22, fontSize: 14 },
  button: { backgroundColor: colors.primary, borderRadius: 18, paddingHorizontal: 20, paddingVertical: 16, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
});
export function Button({ title, onPress, disabled = false, quiet = false }: { title: string; onPress: () => void; disabled?: boolean; quiet?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [s.button, quiet && { backgroundColor: colors.soft }, { opacity: disabled ? .4 : pressed ? .75 : 1 }]}>
    <Text style={{ color: quiet ? colors.text : '#ffffff', fontWeight: '700', fontSize: 14, textAlign: 'center' }}>{title}</Text>
  </Pressable>;
}
export function Input({ label, value, onChangeText, numeric = false, secure = false, placeholder, keyboardType }: {
  label: string; value: string; onChangeText: (v: string) => void; numeric?: boolean; secure?: boolean; placeholder?: string; keyboardType?: TextInputProps['keyboardType'];
}) {
  return <View style={{ gap: 7, flexGrow: 1 }}><Text style={{ color: colors.muted, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} placeholder={placeholder}
      placeholderTextColor="#8a958e" style={s.input} keyboardType={keyboardType || (numeric ? 'decimal-pad' : 'default')}
      secureTextEntry={secure} autoCapitalize="none" /></View>;
}
export function Card({ children }: React.PropsWithChildren) { return <View style={s.card}>{children}</View>; }

export function Choices<T extends string | number>({ label, value, options, onChange }: {
  label: string; value: T; options: { label: string; value: T }[]; onChange: (value: T) => void;
}) {
  return <View style={{ gap: 10 }}><Text style={s.subtitle}>{label}</Text><View style={[s.row, { gap: 8 }]}>{options.map(option => {
    const selected = option.value === value;
    return <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => onChange(option.value)}
      style={{ paddingHorizontal: 16, paddingVertical: 12, minHeight: 44, borderRadius: 14, backgroundColor: selected ? colors.primary : colors.bg, borderWidth: 1, borderColor: selected ? colors.primary : colors.border }}>
      <Text style={{ color: selected ? '#ffffff' : colors.text, fontSize: 13, fontWeight: '600' }}>{option.label}</Text>
    </Pressable>;
  })}</View></View>;
}

// Segments render identically on native and web without an additional chart dependency.
export function ProgressRing({ value, size = 150 }: { value: number; size?: number }) {
  const progress = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const radius = size / 2 - 9;
  return <View accessible accessibilityLabel={`${Math.round(progress * 100)} percent of calorie goal consumed`} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
    {Array.from({ length: 56 }, (_, i) => {
      const angle = i / 56 * Math.PI * 2 - Math.PI / 2;
      return <View key={i} style={{ position: 'absolute', width: 5, height: 13, borderRadius: 3,
        backgroundColor: i < Math.round(progress * 56) ? colors.green : '#e9eee7',
        left: size / 2 + Math.cos(angle) * radius - 2.5, top: size / 2 + Math.sin(angle) * radius - 6.5,
        transform: [{ rotate: `${i / 56 * 360}deg` }] }} />;
    })}
    <Text style={{ color: colors.text, fontSize: 29, fontWeight: '800', letterSpacing: -1 }}>{Math.round(progress * 100)}%</Text>
    <Text style={{ color: colors.muted, fontSize: 11, marginTop: 3 }}>of daily goal</Text>
  </View>;
}

import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, Pressable,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import Button from '../components/Button';
import { COLORS, FONT, TYPE, RADIUS, SPACING, HIT } from '../theme';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const passwordRef = useRef(null);

  const handleAuth = async () => {
    setError(''); setNotice('');
    if (!email || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        setNotice('Account created. Check your email to verify, then sign in.');
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => { setIsSignUp(v => !v); setError(''); setNotice(''); };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.inner, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <Text style={styles.logo} accessibilityRole="header">MENTZER</Text>
          <Text style={styles.subtitle}>HEAVY DUTY</Text>
        </View>

        <Text style={styles.tagline}>Train hard.{'\n'}Train briefly.{'\n'}Train infrequently.</Text>
        <Text style={styles.lede}>
          A personal coach built on Mike Mentzer's Heavy Duty system. One set to failure, then let your body grow.
        </Text>

        <View style={styles.form}>
          <Text style={styles.label} nativeID="emailLabel">Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={COLORS.textFaint}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            accessibilityLabelledBy="emailLabel"
            accessibilityLabel="Email"
          />

          <Text style={styles.label} nativeID="passwordLabel">Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              ref={passwordRef}
              style={styles.passwordInput}
              placeholder={isSignUp ? 'At least 6 characters' : 'Your password'}
              placeholderTextColor={COLORS.textFaint}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              textContentType={isSignUp ? 'newPassword' : 'password'}
              returnKeyType="go"
              onSubmitEditing={handleAuth}
              accessibilityLabelledBy="passwordLabel"
              accessibilityLabel="Password"
            />
            <Pressable
              style={styles.eyeBtn}
              onPress={() => setShowPassword(p => !p)}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            >
              <Feather name={showPassword ? 'eye-off' : 'eye'} size={20} color={COLORS.textMuted} />
            </Pressable>
          </View>

          {error ? (
            <View style={[styles.msg, styles.msgError]} accessibilityLiveRegion="polite" accessibilityRole="alert">
              <Feather name="alert-circle" size={15} color={COLORS.red} />
              <Text style={[styles.msgText, { color: COLORS.red }]}>{error}</Text>
            </View>
          ) : null}
          {notice ? (
            <View style={[styles.msg, styles.msgOk]} accessibilityLiveRegion="polite">
              <Feather name="check-circle" size={15} color={COLORS.green} />
              <Text style={[styles.msgText, { color: COLORS.green }]}>{notice}</Text>
            </View>
          ) : null}

          <Button
            title={isSignUp ? 'CREATE ACCOUNT' : 'SIGN IN'}
            onPress={handleAuth}
            loading={loading}
            style={{ marginTop: SPACING.lg }}
          />

          <Pressable
            style={styles.switchButton}
            onPress={switchMode}
            accessibilityRole="button"
            accessibilityLabel={isSignUp ? 'Already have an account? Sign in' : 'No account yet? Create one'}
          >
            <Text style={styles.switchText}>
              {isSignUp ? 'Already have an account? ' : 'No account yet? '}
              <Text style={styles.switchTextHighlight}>{isSignUp ? 'Sign in' : 'Create one'}</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  inner:     { flexGrow: 1, justifyContent: 'center', paddingHorizontal: SPACING.xl, maxWidth: 480, width: '100%', alignSelf: 'center' },

  brand:    { marginBottom: SPACING.xxl },
  logo:     { fontSize: 40, fontWeight: FONT.black, color: COLORS.white, letterSpacing: 8 },
  subtitle: { fontSize: 12, fontWeight: FONT.semibold, color: COLORS.gold, letterSpacing: 6, marginTop: 4 },

  tagline:  { ...TYPE.display, color: COLORS.white, marginBottom: SPACING.md },
  lede:     { ...TYPE.body, color: COLORS.textMuted, marginBottom: SPACING.xxl },

  form:  { width: '100%' },
  label: { ...TYPE.caption, color: COLORS.textSecondary, marginBottom: 6, marginTop: SPACING.md },
  input: {
    backgroundColor: COLORS.surfaceDark, color: COLORS.white,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: 16, minHeight: 52, fontSize: 16,
  },
  passwordRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surfaceDark,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
  },
  passwordInput: { flex: 1, color: COLORS.white, paddingHorizontal: 16, minHeight: 52, fontSize: 16 },
  eyeBtn:        { width: HIT + 4, height: 52, alignItems: 'center', justifyContent: 'center' },

  msg:      { flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderRadius: RADIUS.md, padding: 12, marginTop: SPACING.md },
  msgError: { backgroundColor: COLORS.redFaint },
  msgOk:    { backgroundColor: COLORS.greenFaint },
  msgText:  { ...TYPE.callout, flex: 1 },

  switchButton:        { marginTop: SPACING.lg, alignItems: 'center', minHeight: HIT, justifyContent: 'center' },
  switchText:          { color: COLORS.textMuted, fontSize: 14 },
  switchTextHighlight: { color: COLORS.gold, fontWeight: FONT.semibold },
});

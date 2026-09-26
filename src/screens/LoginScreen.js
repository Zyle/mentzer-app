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
  // Password reset: 'request' (enter email) → 'verify' (enter emailed code + new password)
  const [resetStep, setResetStep] = useState(null);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
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

  const startReset = () => { setResetStep('request'); setIsSignUp(false); setError(''); setNotice(''); };
  const cancelReset = () => { setResetStep(null); setCode(''); setNewPassword(''); setError(''); setNotice(''); };

  const requestReset = async () => {
    setError(''); setNotice('');
    if (!email.trim()) { setError('Enter the email you signed up with.'); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    setLoading(false);
    if (error) { setError(error.message); return; }
    setResetStep('verify');
    setNotice(`If an account exists for ${email.trim()}, we've emailed it a reset code.`);
  };

  const confirmReset = async () => {
    setError(''); setNotice('');
    if (!code.trim()) { setError('Enter the code from the email.'); return; }
    if (newPassword.length < 6) { setError('New password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      // Verifying the code signs the user in; then set the new password.
      const { error: otpError } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'recovery' });
      if (otpError) throw otpError;
      const { error: pwError } = await supabase.auth.updateUser({ password: newPassword });
      if (pwError) throw pwError;
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

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
          {resetStep && (
            <>
              <Text style={styles.resetTitle} accessibilityRole="header">Reset password</Text>
              <Text style={styles.resetBody}>
                {resetStep === 'request'
                  ? "Enter your email and we'll send you a code to set a new password."
                  : 'Enter the code from the email and choose a new password.'}
              </Text>
            </>
          )}
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
            returnKeyType={resetStep === 'request' ? 'send' : 'next'}
            onSubmitEditing={() => (resetStep === 'request' ? requestReset() : passwordRef.current?.focus())}
            editable={resetStep !== 'verify'}
            accessibilityLabelledBy="emailLabel"
            accessibilityLabel="Email"
          />

          {resetStep === 'verify' && (
            <>
              <Text style={styles.label}>Reset code</Text>
              <TextInput
                style={styles.input}
                placeholder="6-digit code"
                placeholderTextColor={COLORS.textFaint}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                accessibilityLabel="Reset code from email"
              />
              <Text style={styles.label}>New password</Text>
              <TextInput
                style={styles.input}
                placeholder="At least 6 characters"
                placeholderTextColor={COLORS.textFaint}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="go"
                onSubmitEditing={confirmReset}
                accessibilityLabel="New password"
              />
            </>
          )}

          {!resetStep && (<>
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

          {!isSignUp && (
            <Pressable
              onPress={startReset}
              style={styles.forgot}
              accessibilityRole="button"
              accessibilityLabel="Forgot password?"
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>
          )}
          </>)}

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

          {resetStep ? (
            <>
              <Button
                title={resetStep === 'request' ? 'SEND CODE' : 'SET NEW PASSWORD'}
                onPress={resetStep === 'request' ? requestReset : confirmReset}
                loading={loading}
                style={{ marginTop: SPACING.lg }}
              />
              {resetStep === 'verify' && (
                <Button title="Resend code" variant="ghost" size="md" onPress={requestReset} style={{ marginTop: SPACING.sm }} />
              )}
              <Button title="Back to sign in" variant="ghost" size="md" onPress={cancelReset} style={{ marginTop: SPACING.xs }} />
            </>
          ) : (
          <Button
            title={isSignUp ? 'CREATE ACCOUNT' : 'SIGN IN'}
            onPress={handleAuth}
            loading={loading}
            style={{ marginTop: SPACING.lg }}
          />
          )}

          {!resetStep && <Pressable
            style={styles.switchButton}
            onPress={switchMode}
            accessibilityRole="button"
            accessibilityLabel={isSignUp ? 'Already have an account? Sign in' : 'No account yet? Create one'}
          >
            <Text style={styles.switchText}>
              {isSignUp ? 'Already have an account? ' : 'No account yet? '}
              <Text style={styles.switchTextHighlight}>{isSignUp ? 'Sign in' : 'Create one'}</Text>
            </Text>
          </Pressable>}
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
  forgot:        { alignSelf: 'flex-end', minHeight: HIT, justifyContent: 'center', paddingLeft: 12 },
  forgotText:    { color: COLORS.gold, fontSize: 14, fontWeight: FONT.medium },
  resetTitle:    { ...TYPE.title, color: COLORS.white, marginBottom: 6 },
  resetBody:     { ...TYPE.callout, color: COLORS.textMuted, marginBottom: SPACING.sm },

  msg:      { flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderRadius: RADIUS.md, padding: 12, marginTop: SPACING.md },
  msgError: { backgroundColor: COLORS.redFaint },
  msgOk:    { backgroundColor: COLORS.greenFaint },
  msgText:  { ...TYPE.callout, flex: 1 },

  switchButton:        { marginTop: SPACING.lg, alignItems: 'center', minHeight: HIT, justifyContent: 'center' },
  switchText:          { color: COLORS.textMuted, fontSize: 14 },
  switchTextHighlight: { color: COLORS.gold, fontWeight: FONT.semibold },
});

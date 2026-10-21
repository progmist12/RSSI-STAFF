import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StaffSession } from '../types';
import { PrimaryButton } from '../components/ui';
export function LoginScreen({
  styles,
  colors,
  resolved,
  insets,
  email,
  setEmail,
  password,
  setPassword,
  busy,
  error,
  onLogin,
}: any) {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar
        barStyle={resolved === 'dark' ? 'light-content' : 'dark-content'}
      />
      <KeyboardAvoidingView
        style={styles.loginKeyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.loginScroll,
            { paddingBottom: Math.max(insets, 26) },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.loginBrand}>
            <View style={styles.brandMarkLarge}>
              <Text style={styles.brandMarkLargeText}>R</Text>
              <View style={styles.brandLeafLarge} />
            </View>
            <Text style={styles.loginBrandName}>RSSI</Text>
            <Text style={styles.loginBrandSub}>
              SUGAR CANE FIELD MONITORING
            </Text>
          </View>
          <View style={styles.loginCard}>
            <View style={styles.loginEyebrow}>
              <Text style={styles.loginEyebrowText}>SRA STAFF ACCESS</Text>
            </View>
            <Text style={styles.loginTitle}>Welcome back</Text>
            <Text style={styles.loginDetail}>
              Sign in to review farmer observations and monitor reports across
              your assigned province.
            </Text>
            {error ? (
              <View style={styles.loginError}>
                <Text style={styles.loginErrorText}>{error}</Text>
              </View>
            ) : null}
            <Text style={styles.fieldLabel}>Work email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="name@sra.gov.ph"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="username"
              style={styles.input}
              returnKeyType="next"
            />
            <Text style={[styles.fieldLabel, { marginTop: 15 }]}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor={colors.muted}
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              style={styles.input}
              onSubmitEditing={onLogin}
              returnKeyType="done"
            />
            <PrimaryButton
              label={busy ? 'Signing in…' : 'Sign in to workspace'}
              onPress={onLogin}
              disabled={busy}
              styles={styles}
            />
            {busy ? (
              <ActivityIndicator
                color={colors.blue}
                style={{ marginTop: 14 }}
              />
            ) : null}
            <View style={styles.loginSecurity}>
              <Text style={styles.securityGlyph}>◈</Text>
              <Text style={styles.loginSecurityText}>
                Your session is stored securely on this device.
              </Text>
            </View>
          </View>
          <Text style={styles.loginFoot}>
            Sugarcane field observation · Negros Oriental & Negros Occidental
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

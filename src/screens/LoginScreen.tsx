import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { ScrollViewInstance } from 'react-native';
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
  const loginScrollRef = useRef<ScrollViewInstance>(null);
  const passwordFocused = useRef(false);
  const keyboardTop = useRef<number | null>(null);
  const scrollOffset = useRef(0);
  const loginCardTop = useRef(0);
  const passwordFieldTop = useRef(0);
  const passwordFieldHeight = useRef(0);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const eyeProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(eyeProgress, {
      toValue: passwordVisible ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [eyeProgress, passwordVisible]);

  const scrollPasswordIntoView = (keyboardScreenY: number) => {
    loginScrollRef.current?.measureInWindow((_x, scrollScreenY) => {
      const visibleHeight = keyboardScreenY - scrollScreenY;
      const fieldBottom =
        loginCardTop.current +
        passwordFieldTop.current +
        passwordFieldHeight.current;
      const overlap =
        fieldBottom - scrollOffset.current - visibleHeight + 18;
      if (overlap > 0) {
        loginScrollRef.current?.scrollTo({
          y: scrollOffset.current + overlap,
          animated: true,
        });
      }
    });
  };

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', event => {
      keyboardTop.current = event.endCoordinates.screenY;
      if (passwordFocused.current) {
        requestAnimationFrame(() => {
          if (keyboardTop.current !== null) {
            scrollPasswordIntoView(keyboardTop.current);
          }
        });
      }
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTop.current = null;
    });
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar
        barStyle={resolved === 'dark' ? 'light-content' : 'dark-content'}
      />
      <KeyboardAvoidingView
        style={styles.loginKeyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          ref={loginScrollRef}
          onScroll={event => {
            scrollOffset.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          contentContainerStyle={[
            styles.loginScroll,
            { paddingBottom: Math.max(insets, 26) },
          ]}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        >
          <View style={styles.loginBrand}>
            <Image
              source={require('../assets/rssi-logo.png')}
              resizeMode="contain"
              style={{ width: 100, height: 100 }}
              accessibilityLabel="RSSI logo"
            />
            <Text style={styles.loginBrandName}>RSSI</Text>
            <Text style={styles.loginBrandSub}>
              SUGAR CANE FIELD MONITORING
            </Text>
          </View>
          <View
            style={styles.loginCard}
            onLayout={event => {
              loginCardTop.current = event.nativeEvent.layout.y;
            }}
          >
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
            <View
              onLayout={event => {
                passwordFieldTop.current = event.nativeEvent.layout.y;
                passwordFieldHeight.current = event.nativeEvent.layout.height;
              }}
            >
              <Text style={[styles.fieldLabel, { marginTop: 15 }]}>Password</Text>
              <View style={{ position: 'relative', justifyContent: 'center' }}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.muted}
                  secureTextEntry={!passwordVisible}
                  autoComplete="password"
                  textContentType="password"
                  style={[styles.input, { paddingRight: 48 }]}
                  onFocus={() => {
                    passwordFocused.current = true;
                    if (keyboardTop.current !== null) {
                      requestAnimationFrame(() => {
                        if (keyboardTop.current !== null) {
                          scrollPasswordIntoView(keyboardTop.current);
                        }
                      });
                    }
                  }}
                  onBlur={() => {
                    passwordFocused.current = false;
                  }}
                  onSubmitEditing={onLogin}
                  returnKeyType="done"
                />
                <Pressable
                  onPress={() => setPasswordVisible(visible => !visible)}
                  accessibilityRole="button"
                  accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
                  accessibilityState={{ selected: passwordVisible }}
                  hitSlop={10}
                  style={{
                    position: 'absolute',
                    right: 12,
                    width: 28,
                    height: 36,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Animated.View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      opacity: eyeProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                      transform: [{ scale: eyeProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.82] }) }],
                    }}
                  >
                    <View style={{ width: 21, height: 13, borderWidth: 1.7, borderColor: colors.muted, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
                      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.muted }} />
                    </View>
                  </Animated.View>
                  <Animated.View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      opacity: eyeProgress,
                      transform: [{ scale: eyeProgress.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) }],
                    }}
                  >
                    <View style={{ width: 21, height: 13, borderWidth: 1.7, borderColor: colors.blue, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
                      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.blue }} />
                    </View>
                    <View style={{ position: 'absolute', width: 25, height: 1.7, backgroundColor: colors.blue, left: -2, top: 5.5, transform: [{ rotate: '-42deg' }] }} />
                  </Animated.View>
                </Pressable>
              </View>
            </View>
            <PrimaryButton
              label={busy ? 'Signing in…' : 'Sign in to workspace'}
              onPress={onLogin}
              disabled={busy}
              styles={styles}
            />
            {/* <View style={styles.loginSecurity}>
              <Text style={styles.securityGlyph}>◈</Text>
              <Text style={styles.loginSecurityText}>
                Your session is stored securely on this device.
              </Text>
            </View> */}
          </View>
          <Text style={styles.loginFoot}>
            Sugarcane field observation · Negros Oriental & Negros Occidental
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

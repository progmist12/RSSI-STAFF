import React from 'react';
import { Image, Pressable, Text, TextInput, View } from 'react-native';
import { photoUrl } from '../api';
import { Farmer, FieldReport, ReviewForm, StaffSession } from '../types';
import { ThemeMode } from '../theme';
import {
  Choice,
  EmptyCard,
  InfoLine,
  PrimaryButton,
  SectionIntro,
  SectionTitle,
  Badge,
} from '../components/ui';
import { formatDate, initials, roleName, severityStyle } from '../utils';
export function SettingsScreen({
  session,
  mode,
  setMode,
  styles,
  onSignOut,
}: any) {
  return (
    <View>
      <SectionIntro
        eyebrow="PREFERENCES"
        title="Your workspace"
        detail="Personal app preferences and secure account controls."
        styles={styles}
      />
      <View style={styles.profileCard}>
        <View style={styles.profileHero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(session.user.name)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{session.user.name}</Text>
            <Text style={styles.profileSub}>{session.user.email}</Text>
          </View>
        </View>
        <InfoLine
          label="Staff role"
          value={roleName(session.user.role)}
          styles={styles}
        />
        <InfoLine
          label="Province access"
          value={session.user.province_access}
          styles={styles}
        />
      </View>
      <View style={styles.card}>
        <SectionTitle
          title="Appearance"
          detail="Choose how RSSI looks on this device."
          styles={styles}
        />
        {(
          [
            ['system', 'System', 'Follow your phone appearance'],
            ['light', 'Light', 'Bright surfaces and dark text'],
            ['dark', 'Dark', 'Dim surfaces for low-light use'],
          ] as [ThemeMode, string, string][]
        ).map(([value, label, help]) => (
          <Pressable
            key={value}
            onPress={() => void setMode(value)}
            style={styles.themeOption}
          >
            <View
              style={[styles.radio, mode === value && styles.radioSelected]}
            >
              {mode === value ? <View style={styles.radioDot} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.themeLabel}>{label}</Text>
              <Text style={styles.themeHelp}>{help}</Text>
            </View>
            <Text style={styles.themePreview}>
              {value === 'system' ? '◐' : value === 'light' ? '☀' : '☾'}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.card}>
        <SectionTitle
          title="Access and privacy"
          detail="Your account is limited to the staff data and actions allowed by SRA."
          styles={styles}
        />
        <View style={styles.scopeRow}>
          <Text style={styles.scopeCheck}>✓</Text>
          <Text style={styles.scopeText}>
            Report and farmer access is limited by assigned province.
          </Text>
        </View>
        <View style={styles.scopeRow}>
          <Text style={styles.scopeCheck}>✓</Text>
          <Text style={styles.scopeText}>
            Session credentials are protected by device secure storage.
          </Text>
        </View>
        <View style={styles.scopeRow}>
          <Text style={styles.scopeCheck}>✓</Text>
          <Text style={styles.scopeText}>
            Exact farm location visibility follows consent and workspace access.
          </Text>
        </View>
      </View>
      <Pressable onPress={onSignOut} style={styles.signOutButton}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
      <Text style={styles.versionText}>
        RSSI Staff · Sugarcane field monitoring
      </Text>
    </View>
  );
}

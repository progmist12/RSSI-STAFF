import React, { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import type { Asset } from 'react-native-image-picker';
import { photoUrl, uploadStaffProfilePhoto } from '../api';
import { ThemeMode } from '../theme';
import {
  InfoLine,
  SectionIntro,
  SectionTitle,
} from '../components/ui';
import { initials, roleName } from '../utils';
export function SettingsScreen({
  session,
  mode,
  setMode,
  styles,
  onSignOut,
  onProfilePhotoUpdated,
}: any) {
  const [editingPhoto, setEditingPhoto] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Asset | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const photoUri = selectedPhoto?.uri || (session.user.profile_photo_url ? photoUrl(session.user.profile_photo_url) : null);

  const choosePhoto = async () => {
    setPhotoError('');
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.8,
        assetRepresentationMode: 'compatible',
      });
      if (result.didCancel) return;
      if (result.errorCode) {
        setPhotoError('Could not open your photo library. Try again.');
        return;
      }
      const photo = result.assets?.[0];
      if (!photo?.uri) {
        setPhotoError('Choose a profile photo and try again.');
        return;
      }
      if (typeof photo.fileSize === 'number' && photo.fileSize > 5 * 1024 * 1024) {
        setPhotoError('Choose an image that is 5 MB or smaller.');
        return;
      }
      setSelectedPhoto(photo);
    } catch {
      setPhotoError('Could not open your photo library. Try again.');
    }
  };

  const savePhoto = async () => {
    if (!selectedPhoto) return;
    setPhotoBusy(true);
    setPhotoError('');
    try {
      const uploaded = await uploadStaffProfilePhoto(session.token, selectedPhoto);
      await onProfilePhotoUpdated(uploaded.profile_photo_url);
      setSelectedPhoto(null);
      setEditingPhoto(false);
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'Could not save your profile picture.');
    } finally {
      setPhotoBusy(false);
    }
  };

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
          <View style={[styles.avatar, styles.avatarLarge, styles.profileAvatarPhoto]}>
            {photoUri ? (
              <Image
                source={{
                  uri: photoUri,
                  ...(selectedPhoto ? {} : { headers: { Authorization: `Bearer ${session.token}` } }),
                }}
                resizeMode="cover"
                style={styles.profilePhotoImage}
              />
            ) : (
              <Text style={styles.avatarTextLarge}>{initials(session.user.name)}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{session.user.name}</Text>
            <Text style={styles.profileSub}>{session.user.email}</Text>
          </View>
        </View>
        {editingPhoto ? (
          <View style={styles.profilePhotoEditor}>
            <Text style={styles.profilePhotoHint}>Choose a staff profile picture. Images must be 5 MB or smaller.</Text>
            <Pressable
              accessibilityRole="button"
              disabled={photoBusy}
              onPress={choosePhoto}
              style={[styles.profilePhotoSecondaryButton, photoBusy && styles.buttonDisabled]}
            >
              <Text style={styles.profilePhotoSecondaryText}>{selectedPhoto ? 'Choose a different photo' : 'Choose photo'}</Text>
            </Pressable>
            <View style={styles.profilePhotoActions}>
              {selectedPhoto ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={photoBusy}
                  onPress={savePhoto}
                  style={[styles.profilePhotoPrimaryButton, photoBusy && styles.buttonDisabled]}
                >
                  <Text style={styles.profilePhotoPrimaryText}>{photoBusy ? 'Saving…' : 'Save picture'}</Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                disabled={photoBusy}
                onPress={() => { setEditingPhoto(false); setSelectedPhoto(null); setPhotoError(''); }}
                style={styles.profilePhotoSecondaryButton}
              >
                <Text style={styles.profilePhotoSecondaryText}>Cancel</Text>
              </Pressable>
            </View>
            {photoError ? <Text style={styles.profilePhotoError}>{photoError}</Text> : null}
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => { setEditingPhoto(true); setSelectedPhoto(null); setPhotoError(''); }}
            style={styles.profilePhotoSecondaryButton}
          >
            <Text style={styles.profilePhotoSecondaryText}>{session.user.profile_photo_url ? 'Edit profile picture' : 'Add profile picture'}</Text>
          </Pressable>
        )}
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

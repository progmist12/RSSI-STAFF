import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { photoUrl } from '../api';
import { FarmProperty, Farmer, FieldReport, ReviewForm, StaffSession } from '../types';
import { FarmPropertyMap } from '../components/FarmPropertyMap';
import {
  Choice,
  EmptyCard,
  InfoLine,
  PrimaryButton,
  SectionIntro,
  SectionTitle,
  Badge,
} from '../components/ui';
import type { Palette } from '../theme';
import { formatDate, initials, roleName, severityStyle } from '../utils';
export function FarmerDetail({
  farmer,
  onOpenHistory,
  styles,
  colors,
}: {
  farmer: Farmer;
  onOpenHistory: (farmer: Farmer) => void;
  styles: any;
  colors: Palette;
}) {
  return (
    <View>
      <View style={styles.profileCard}>
        <View style={styles.profileHero}>
          <View style={[styles.avatar, styles.avatarLarge]}>
            <Text style={styles.avatarTextLarge}>{initials(farmer.name)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{farmer.name}</Text>
            <Text style={styles.profileSub}>
              {farmer.reference} · {farmer.status}
            </Text>
          </View>
          <Badge
            label={farmer.status}
            tone={farmer.status === 'Active' ? 'green' : 'muted'}
            styles={styles}
          />
        </View>
        <InfoLine
          label="Email"
          value={farmer.email || 'Not provided'}
          styles={styles}
        />
        <InfoLine
          label="Registered farms"
          value={`${farmer.properties?.length || 0}`}
          styles={styles}
        />
        <View style={{ marginTop: 12 }}>
          <PrimaryButton
            label="View farmer history"
            onPress={() => onOpenHistory(farmer)}
            styles={styles}
          />
        </View>
      </View>
      <SectionIntro
        eyebrow="REGISTERED LOCATIONS"
        title="Farm properties"
        detail="Location details reflect the farmer’s saved property records and consent settings."
        styles={styles}
      />
      {farmer.properties?.map((property: FarmProperty) => (
        <View key={property.id} style={styles.propertyCard}>
          <View style={styles.propertyHeader}>
            <View style={styles.propertyPin}>
              <Text style={styles.propertyPinText}>⌖</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.propertyName}>{property.name}</Text>
              <Text style={styles.propertyArea}>
                {property.municipality}, {property.province}
              </Text>
            </View>
          </View>
          <InfoLine
            label="Barangay"
            value={property.barangay || 'Not provided'}
            styles={styles}
          />
          <InfoLine
            label="Farm size"
            value={
              property.size_hectares
                ? `${property.size_hectares} ha`
                : 'Not provided'
            }
            styles={styles}
          />
          {property.address ? (
            <InfoLine
              label="Address"
              value={property.address}
              styles={styles}
            />
          ) : null}
          <FarmPropertyMap property={property} colors={colors} />
          {property.location_consent ? (
            <Text style={styles.consentLine}>
              ✓ Location sharing consent recorded
            </Text>
          ) : (
            <Text style={styles.consentLineMuted}>
              Exact property coordinates are hidden unless consent and staff
              access allow them.
            </Text>
          )}
        </View>
      ))}
      {!farmer.properties?.length ? (
        <EmptyCard
          title="No registered farms"
          detail="This account has no farm properties yet."
          styles={styles}
        />
      ) : null}
    </View>
  );
}

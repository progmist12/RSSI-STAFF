import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Farmer, FieldReport } from '../types';
import { formatDate, initials, severityStyle, shortProvince } from '../utils';
import { reportWorkflowLabel, reportWorkflowTone } from '../app/reportReview';
export function MetricCard({ label, value, hint, tone, styles, onPress }: any) {
  const toneStyle = (
    {
      blue: styles.metricBlue,
      green: styles.metricGreen,
      amber: styles.metricAmber,
      red: styles.metricRed,
    } as any
  )[tone];
  return (
    <Pressable onPress={onPress} style={[styles.metricCard, toneStyle]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricHint}>{hint}</Text>
    </Pressable>
  );
}

export function SectionIntro({ eyebrow, title, detail, styles }: any) {
  return (
    <View style={styles.sectionIntro}>
      <Text style={styles.introEyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionDetail}>{detail}</Text>
    </View>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  styles,
  colors,
}: any) {
  return (
    <View style={styles.searchWrap}>
      <Text style={styles.searchIcon}>⌕</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={styles.searchInput}
        returnKeyType="search"
      />
      <Pressable onPress={() => onChange('')}>
        <Text style={styles.searchClear}>{value ? '×' : ''}</Text>
      </Pressable>
    </View>
  );
}

export function LoadMoreButton({
  label,
  busy,
  disabled,
  onPress,
  styles,
  colors,
}: any) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.loadMoreButton, disabled && styles.buttonDisabled]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={colors.blue} />
      ) : (
        <Text style={styles.loadMoreText}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Choice({ label, selected, onPress, styles, disabled }: any) {
  return (
    <Pressable
      disabled={disabled}
      accessibilityState={{ selected, disabled }}
      onPress={onPress}
      style={[
        styles.choice,
        selected && styles.choiceSelected,
        disabled && { opacity: 0.55 },
      ]}
    >
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function ReportRow({ report, onPress, styles, compact }: any) {
  const severity = severityStyle(report.farmer_severity, styles);
  const workflowLabel = reportWorkflowLabel(report);
  return (
    <Pressable onPress={onPress} style={styles.reportRow}>
      <View style={[styles.reportIcon, severity]}>
        <Text style={styles.reportIconGlyph}>⌁</Text>
      </View>
      <View style={styles.reportBody}>
        <View style={styles.rowBetween}>
          <Text style={styles.reportCode}>{report.code}</Text>
          <Badge
            label={workflowLabel}
            tone={reportWorkflowTone(report)}
            styles={styles}
          />
        </View>
        <Text style={styles.reportFarm} numberOfLines={1}>
          {report.property_name} · {report.farmer?.name || 'Farmer observation'}
        </Text>
        <View style={styles.rowMeta}>
          <Text style={styles.reportMeta}>
            {report.municipality}, {shortProvince(report.province)}
          </Text>
          <Text style={[styles.reportSeverity, severity]}>
            {report.farmer_severity}
            {report.farmer_severity_range
              ? ` · ${report.farmer_severity_range}`
              : ''}
          </Text>
        </View>
        {!compact && (
          <Text style={styles.reportDate}>
            Observed {formatDate(report.observed_at)} ·{' '}
            {report.affected_area_hectares} ha reported
          </Text>
        )}
      </View>
      <Text style={styles.rowArrow}>›</Text>
    </Pressable>
  );
}

export function FarmerRow({ farmer, onPress, styles }: any) {
  const firstProperty = farmer.properties?.[0];
  return (
    <Pressable onPress={onPress} style={styles.farmerRow}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials(farmer.name)}</Text>
      </View>
      <View style={styles.farmerBody}>
        <Text style={styles.farmerName}>{farmer.name}</Text>
        <Text style={styles.farmerReference}>
          {farmer.reference} · {farmer.status}
        </Text>
        <Text style={styles.farmerProperty} numberOfLines={1}>
          {firstProperty
            ? `${firstProperty.name} · ${
                firstProperty.municipality
              }, ${shortProvince(firstProperty.province)}`
            : 'No farm registered'}
        </Text>
      </View>
      <Text style={styles.rowArrow}>›</Text>
    </Pressable>
  );
}

export function InfoLine({ label, value, styles }: any) {
  return (
    <View style={styles.infoLine}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export function SectionTitle({ title, detail, styles }: any) {
  return (
    <View style={styles.cardTitleBlock}>
      <Text style={styles.cardTitle}>{title}</Text>
      {detail ? <Text style={styles.cardDetail}>{detail}</Text> : null}
    </View>
  );
}

export function Badge({ label, tone, styles }: any) {
  const toneStyle =
    (
      {
        amber: styles.badgeAmber,
        green: styles.badgeGreen,
        muted: styles.badgeMuted,
        red: styles.badgeRed,
      } as any
    )[tone] || styles.badgeBlue;
  return (
    <View style={[styles.badge, toneStyle]}>
      <Text style={[styles.badgeText, toneStyle]}>{label}</Text>
    </View>
  );
}

export function EmptyCard({ title, detail, styles }: any) {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <Text style={styles.emptyGlyph}>✓</Text>
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDetail}>{detail}</Text>
    </View>
  );
}

export function PrimaryButton({ label, onPress, disabled, styles }: any) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primaryButton,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

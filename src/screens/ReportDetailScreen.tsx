import React, { useRef, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  Text,
  View,
} from 'react-native';
import { KeyboardAwareTextInput } from '../components/KeyboardAwareTextInput';
import { photoUrl } from '../api';
import { saveReportPhoto } from '../photoDownload';
import { DatePickerField } from '../components/DatePickerField';
import { reportWorkflowLabel, reportWorkflowTone } from '../app/reportReview';
import { NumericStepperInput } from '../components/NumericStepperInput';
import { Farmer, FieldReport, ReportPhoto, ReviewForm, StaffSession } from '../types';
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
const verificationOptions = ['For verification', 'Confirmed', 'No detection'];
const severityOptions = [
  'Not assessed',
  'Mild',
  'Moderate',
  'Severe',
  'Highly severe',
];
function decimalEntry(value: string) {
  const clean = value.replace(/[^0-9.]/g, '');
  const dot = clean.indexOf('.');
  return dot < 0
    ? clean
    : `${clean.slice(0, dot)}.${clean
        .slice(dot + 1)
        .replace(/\./g, '')
        .slice(0, 2)}`;
}
export function ReportDetail({
  report,
  visits = [],
  review,
  setReview,
  styles,
  colors,
  canReview,
  reviewLocked = false,
  busy,
  photoFailed,
  setPhotoFailed,
  token,
  onSave,
  scrollRef,
}: any) {
  const verificationStatusRef = useRef<any>(null);
  const severityRef = useRef<any>(null);
  const farmerMessageRef = useRef<any>(null);
  const [showCompletionWarning, setShowCompletionWarning] = useState(false);
  const [showSeverityWarning, setShowSeverityWarning] = useState(false);
  const [showFarmerMessageWarning, setShowFarmerMessageWarning] =
    useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<ReportPhoto | null>(null);
  const [downloadingPhotoId, setDownloadingPhotoId] = useState<number | null>(
    null,
  );
  const cropVisit = [...visits]
    .filter((visit: any) => visit.crop_characteristics)
    .sort((a: any, b: any) =>
      (b.completed_at || b.updated_at || '').localeCompare(
        a.completed_at || a.updated_at || '',
      ),
    )[0];
  const [followUpDecision, setFollowUpDecision] = useState<
    'needed' | 'complete' | null
  >(
    review.followUpAt
      ? 'needed'
      : report.review_completed_at || report.workflow_stage === 'completed'
      ? 'complete'
      : null,
  );
  const update = (key: keyof ReviewForm, value: string) =>
    setReview((old: ReviewForm) => ({ ...old, [key]: value }));
  const downloadPhoto = async (photo: ReportPhoto) => {
    if (downloadingPhotoId !== null) return;
    setDownloadingPhotoId(photo.id);
    try {
      const outcome = await saveReportPhoto(
        photo.url,
        token,
        `RSSI-${report.id}-${photo.id}-${photo.name}`,
      );
      if (outcome === 'downloaded') {
        Alert.alert(
          'Download started',
          'The photo is being saved in your device’s Downloads folder.',
        );
      }
    } catch (error) {
      Alert.alert(
        'Could not save photo',
        error instanceof Error ? error.message : 'Check your connection and try again.',
      );
    } finally {
      setDownloadingPhotoId(null);
    }
  };
  const visibleVerificationOptions =
    followUpDecision === 'complete'
      ? verificationOptions.filter(value => value !== 'For verification')
      : verificationOptions;
  const saveReview = () => {
    const cropMeasurements = [
      ['Plant height', review.plantHeightCm, false],
      ['Leaves in a stalk', review.leavesPerStalk, true],
      ['Leaf length', review.leafLengthCm, false],
      ['Leaf width', review.leafWidthCm, false],
      ['Tillers', review.tillerCount, true],
    ] as const;
    const invalidCropMeasurement = cropMeasurements.find(
      ([, value, integer]) => {
        if (!value?.trim()) return false;
        const number = Number(value);
        return (
          !Number.isFinite(number) ||
          number < 0 ||
          (integer && !Number.isInteger(number))
        );
      },
    );
    if (invalidCropMeasurement) {
      Alert.alert(
        'Check crop measurements',
        `${invalidCropMeasurement[0]} must be a non-negative ${
          invalidCropMeasurement[2] ? 'whole number' : 'number'
        }.`,
      );
      return;
    }
    if (
      review.measurementDate &&
      !/^\d{4}-\d{2}-\d{2}$/.test(review.measurementDate)
    ) {
      Alert.alert('Check measurement date', 'Enter the date as YYYY-MM-DD.');
      return;
    }
    if (
      review.sampleCount &&
      (!Number.isInteger(Number(review.sampleCount)) ||
        Number(review.sampleCount) < 1 ||
        Number(review.sampleCount) > 1000000)
    ) {
      Alert.alert(
        'Check sample count',
        'Plants sampled must be a whole number from 1 to 1,000,000.',
      );
      return;
    }
    if (
      review.verificationStatus === 'Confirmed' &&
      !['Mild', 'Moderate', 'Severe', 'Highly severe'].includes(
        review.sraSeverity,
      )
    ) {
      setShowSeverityWarning(true);
      requestAnimationFrame(() => {
        severityRef.current?.measureLayout(
          scrollRef?.current as any,
          (_x: number, y: number) =>
            scrollRef?.current?.scrollTo({
              y: Math.max(0, y - 18),
              animated: true,
            }),
          () => undefined,
        );
      });
      return;
    }
    if (
      review.verificationStatus === 'No detection' &&
      !review.farmerMessage?.trim()
    ) {
      setShowFarmerMessageWarning(true);
      requestAnimationFrame(() => {
        farmerMessageRef.current?.measureLayout(
          scrollRef?.current as any,
          (_x: number, y: number) =>
            scrollRef?.current?.scrollTo({
              y: Math.max(0, y - 18),
              animated: true,
            }),
          () => undefined,
        );
      });
      return;
    }
    if (followUpDecision === null) {
      Alert.alert(
        'Choose the next step',
        'Select whether this report needs a follow-up visit or is complete.',
      );
      return;
    }
    if (followUpDecision === 'needed' && !review.followUpAt) {
      Alert.alert(
        'Choose a follow-up date',
        'Select the date for the follow-up visit before saving.',
      );
      return;
    }
    if (
      followUpDecision === 'complete' &&
      review.verificationStatus === 'For verification'
    ) {
      setShowCompletionWarning(true);
      requestAnimationFrame(() => {
        verificationStatusRef.current?.measureLayout(
          scrollRef?.current as any,
          (_x: number, y: number) =>
            scrollRef?.current?.scrollTo({
              y: Math.max(0, y - 18),
              animated: true,
            }),
          () => undefined,
        );
      });
      return;
    }
    onSave(followUpDecision);
  };
  const shade = severityStyle(report.farmer_severity, styles);
  return (
    <View>
      <View style={styles.detailHero}>
        <View style={styles.detailHeroTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.detailCode}>{report.code}</Text>
            <Text style={styles.detailTitle}>{report.property_name}</Text>
            <Text style={styles.detailSub}>
              {report.farmer?.name || 'Farmer'} · {report.municipality},{' '}
              {report.province}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 5 }}>
            <Badge
              label={reportWorkflowLabel(report)}
              tone={reportWorkflowTone(report)}
              styles={styles}
            />
            <Badge
              label={report.verification_status}
              tone={
                report.verification_status === 'For verification'
                  ? 'amber'
                  : report.verification_status === 'Confirmed'
                  ? 'green'
                  : 'muted'
              }
              styles={styles}
            />
          </View>
        </View>
        <View style={styles.detailMetrics}>
          <View style={styles.detailMetric}>
            <Text style={styles.detailMetricLabel}>Farmer severity</Text>
            <Text style={[styles.detailMetricValue, shade]}>
              {report.farmer_severity}
              {report.farmer_severity_range
                ? ` · ${report.farmer_severity_range}`
                : ''}
            </Text>
          </View>
          <View style={styles.detailMetric}>
            <Text style={styles.detailMetricLabel}>Area affected</Text>
            <Text style={styles.detailMetricValue}>
              {report.affected_area_hectares} ha
            </Text>
          </View>
          <View style={styles.detailMetric}>
            <Text style={styles.detailMetricLabel}>SRA severity</Text>
            <Text style={styles.detailMetricValue}>
              {report.sra_severity || 'Not assessed'}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.card}>
        <SectionTitle
          title="Crop characteristics"
          detail={
            cropVisit
              ? `From field visit · ${formatDate(
                  cropVisit.completed_at || cropVisit.scheduled_at,
                )}`
              : 'Recorded during a follow-up visit'
          }
          styles={styles}
        />
        {cropVisit?.crop_characteristics ? (
          <View style={{ gap: 9 }}>
            {[
              [
                'Leaves per stalk',
                cropVisit.crop_characteristics.leavesPerStalk,
                'count',
              ],
              [
                'Plant height',
                cropVisit.crop_characteristics.plantHeight,
                'cm',
              ],
              ['Leaf length', cropVisit.crop_characteristics.leafLength, 'cm'],
              ['Leaf width', cropVisit.crop_characteristics.leafWidth, 'cm'],
              ['Tillers', cropVisit.crop_characteristics.tillers, 'count'],
            ].map(([label, value, unit]: any) => (
              <InfoLine
                key={label}
                label={label}
                value={value == null ? 'Not recorded' : `${value} ${unit}`}
                styles={styles}
              />
            ))}
            <InfoLine
              label="Measurement date"
              value={
                cropVisit.crop_characteristics.measurementDate || 'Not recorded'
              }
              styles={styles}
            />
            <InfoLine
              label="Crop variety"
              value={
                cropVisit.crop_characteristics.cropVariety || 'Not recorded'
              }
              styles={styles}
            />
            <InfoLine
              label="Growth stage"
              value={
                cropVisit.crop_characteristics.growthStage || 'Not recorded'
              }
              styles={styles}
            />
            <InfoLine
              label="Plants sampled"
              value={
                cropVisit.crop_characteristics.sampleCount != null
                  ? String(cropVisit.crop_characteristics.sampleCount)
                  : 'Not recorded'
              }
              styles={styles}
            />
          </View>
        ) : (
          <Text style={styles.bodyText}>
            No crop measurements have been recorded for this report yet. Add
            them from Visits by editing its follow-up visit.
          </Text>
        )}
      </View>
      <View style={styles.card}>
        <SectionTitle
          title="Farmer observation"
          detail={`Observed ${formatDate(
            report.observed_at,
          )} · Submitted ${formatDate(report.submitted_at)}`}
          styles={styles}
        />
        <Text style={styles.fieldLabel}>Suspected RSSI observations</Text>
        <Text style={styles.bodyText}>
          {report.observations || 'No observation provided.'}
        </Text>
        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>
          Damage description
        </Text>
        <Text style={styles.bodyText}>
          {report.damage_description || 'No damage description provided.'}
        </Text>
        {report.location_description ? (
          <>
            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>
              Location notes
            </Text>
            <Text style={styles.bodyText}>{report.location_description}</Text>
          </>
        ) : null}
        <View style={styles.contextStrip}>
          <Text style={styles.contextStripText}>
            Farmer severity records observed damage. SRA assessment is stored
            separately.
          </Text>
        </View>
      </View>
      <View style={styles.card}>
        <SectionTitle
          title="Farmer-reported crop characteristics"
          detail="Original values submitted by the farmer; these are preserved separately."
          styles={styles}
        />
        <InfoLine
          label="Plant height"
          value={
            report.crop_characteristics?.plant_height_cm != null
              ? `${report.crop_characteristics.plant_height_cm} cm`
              : 'Not provided'
          }
          styles={styles}
        />
        <InfoLine
          label="Leaves in a stalk"
          value={
            report.crop_characteristics?.leaves_per_stalk != null
              ? String(report.crop_characteristics.leaves_per_stalk)
              : 'Not provided'
          }
          styles={styles}
        />
        <InfoLine
          label="Leaf length"
          value={
            report.crop_characteristics?.leaf_length_cm != null
              ? `${report.crop_characteristics.leaf_length_cm} cm`
              : 'Not provided'
          }
          styles={styles}
        />
        <InfoLine
          label="Leaf width"
          value={
            report.crop_characteristics?.leaf_width_cm != null
              ? `${report.crop_characteristics.leaf_width_cm} cm`
              : 'Not provided'
          }
          styles={styles}
        />
        <InfoLine
          label="Tillers"
          value={
            report.crop_characteristics?.tiller_count != null
              ? String(report.crop_characteristics.tiller_count)
              : 'Not provided'
          }
          styles={styles}
        />
        <InfoLine
          label="Measurement date"
          value={
            report.crop_characteristics?.measurement_date || 'Not recorded'
          }
          styles={styles}
        />
        <InfoLine
          label="Crop variety"
          value={report.crop_characteristics?.crop_variety || 'Not recorded'}
          styles={styles}
        />
        <InfoLine
          label="Growth stage"
          value={report.crop_characteristics?.growth_stage || 'Not recorded'}
          styles={styles}
        />
        <InfoLine
          label="Plants sampled"
          value={
            report.crop_characteristics?.sample_count != null
              ? String(report.crop_characteristics.sample_count)
              : 'Not recorded'
          }
          styles={styles}
        />
      </View>
      <View style={styles.card}>
        <SectionTitle
          title={`Photo evidence · ${report.photos?.length || 0}`}
          detail="Private attachments · available to authorized staff"
          styles={styles}
        />
        {report.photos?.length ? (
          <View style={styles.photoGrid}>
            {report.photos.map((photo: ReportPhoto) => (
              <Pressable
                key={photo.id}
                accessibilityRole="button"
                accessibilityLabel={`View photo ${photo.name}`}
                disabled={photoFailed.includes(photo.id)}
                onPress={() => setSelectedPhoto(photo)}
                style={styles.photoCard}
              >
                {photoFailed.includes(photo.id) ? (
                  <View style={styles.photoUnavailable}>
                    <Text style={styles.photoUnavailableGlyph}>▧</Text>
                    <Text style={styles.photoUnavailableText}>
                      Photo unavailable
                    </Text>
                  </View>
                ) : (
                  <Image
                    source={{
                      uri: photoUrl(photo.url),
                      headers: {
                        Authorization: `Bearer ${token}`,
                        'ngrok-skip-browser-warning': 'true',
                      },
                    }}
                    style={styles.photo}
                    resizeMode="cover"
                    onError={() =>
                      setPhotoFailed((current: number[]) => [
                        ...current,
                        photo.id,
                      ])
                    }
                  />
                )}
                <Text style={styles.photoName} numberOfLines={1}>
                  {photo.name} · Tap to enlarge
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <EmptyCard
            title="No photos attached"
            detail="The farmer did not attach photo evidence."
            styles={styles}
          />
        )}
      </View>
      <Modal
        visible={selectedPhoto !== null}
        animationType="fade"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={() => setSelectedPhoto(null)}
      >
        {selectedPhoto ? (
          <View
            style={{
              flex: 1,
              backgroundColor: '#05080D',
              paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
              paddingBottom: Platform.OS === 'ios' ? 24 : 10,
            }}
          >
            <View
              style={{
                minHeight: 54,
                paddingHorizontal: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  color: '#FFFFFF',
                  fontSize: 13,
                  fontWeight: '700',
                }}
              >
                {selectedPhoto.name}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close photo viewer"
                onPress={() => setSelectedPhoto(null)}
                hitSlop={10}
                style={{ paddingHorizontal: 8, paddingVertical: 6 }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 26 }}>×</Text>
              </Pressable>
            </View>
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <Image
                source={{
                  uri: photoUrl(selectedPhoto.url),
                  headers: {
                    Authorization: `Bearer ${token}`,
                    'ngrok-skip-browser-warning': 'true',
                  },
                }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="contain"
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Download submitted photo"
              disabled={downloadingPhotoId !== null}
              onPress={() => void downloadPhoto(selectedPhoto)}
              style={{
                minHeight: 48,
                marginHorizontal: 14,
                marginTop: 10,
                borderRadius: 11,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor:
                  downloadingPhotoId === selectedPhoto.id
                    ? '#5374C8'
                    : '#2456D7',
                opacity: downloadingPhotoId !== null && downloadingPhotoId !== selectedPhoto.id ? 0.6 : 1,
              }}
            >
              <Text
                style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '800' }}
              >
                {downloadingPhotoId === selectedPhoto.id
                  ? 'Saving photo…'
                  : Platform.OS === 'ios'
                    ? 'Save or share photo'
                    : 'Download photo'}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </Modal>
      <View style={styles.card}>
        <SectionTitle
          title="SRA review"
          detail={
            reviewLocked
              ? 'This report is complete and locked for editing.'
              : canReview
              ? 'Record an independent assessment and next step.'
              : 'This account has view-only access.'
          }
          styles={styles}
        />
        <View
          ref={verificationStatusRef}
          collapsable={false}
          style={
            showCompletionWarning
              ? {
                  borderWidth: 1,
                  borderColor: colors.red,
                  backgroundColor: colors.redSoft,
                  borderRadius: 10,
                  padding: 9,
                  marginTop: 4,
                }
              : undefined
          }
        >
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              columnGap: 8,
            }}
          >
            <Text style={styles.fieldLabel}>Verification status</Text>
            {showCompletionWarning ? (
              <Text
                style={{
                  color: colors.red,
                  fontSize: 11,
                  fontWeight: '800',
                  flexShrink: 1,
                }}
              >
                Finish the assessment: choose Confirmed or No detection.
              </Text>
            ) : null}
          </View>
          <View style={styles.choiceWrap}>
            {visibleVerificationOptions.map(value => (
              <Choice
                key={value}
                label={value}
                selected={review.verificationStatus === value}
                onPress={() => {
                  if (value === 'No detection') {
                    setFollowUpDecision('complete');
                    setReview((old: ReviewForm) => ({
                      ...old,
                      verificationStatus: value,
                      followUpAt: '',
                    }));
                    setShowCompletionWarning(false);
                    setShowSeverityWarning(false);
                    return;
                  }
                  update('verificationStatus', value);
                  if (value === 'Confirmed') setShowCompletionWarning(false);
                  else setShowSeverityWarning(false);
                  setShowFarmerMessageWarning(false);
                }}
                disabled={!canReview}
                styles={styles}
              />
            ))}
          </View>
        </View>
        <View
          ref={severityRef}
          collapsable={false}
          style={
            showSeverityWarning
              ? {
                  borderWidth: 1,
                  borderColor: colors.red,
                  backgroundColor: colors.redSoft,
                  borderRadius: 10,
                  padding: 9,
                  marginTop: 10,
                }
              : undefined
          }
        >
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              columnGap: 8,
            }}
          >
            <Text style={[styles.fieldLabel, { marginTop: 18 }]}>
              SRA-assessed severity
            </Text>
            {showSeverityWarning ? (
              <Text
                style={{
                  color: colors.red,
                  fontSize: 11,
                  fontWeight: '800',
                  flexShrink: 1,
                }}
              >
                Choose a severity before saving a confirmed report.
              </Text>
            ) : null}
          </View>
          <Text style={styles.inputHint}>
            Choose independently from the farmer’s damage selection.
          </Text>
          <View style={styles.choiceWrap}>
            {severityOptions.map(value => (
              <Choice
                key={value}
                label={value}
                selected={review.sraSeverity === value}
                onPress={() => {
                  update('sraSeverity', value);
                  setShowSeverityWarning(false);
                }}
                disabled={!canReview}
                styles={styles}
              />
            ))}
          </View>
        </View>
        <Text style={[styles.fieldLabel, { marginTop: 18 }]}>
          SRA-assessed crop characteristics
        </Text>
        <Text style={styles.inputHint}>
          Enter measurements observed or verified by SRA. These do not overwrite
          the farmer’s original values.
        </Text>
        {(
          [
            ['Plant height (cm)', 'plantHeightCm', 'decimal-pad'],
            ['Leaves in a stalk', 'leavesPerStalk', 'number-pad'],
            ['Leaf length (cm)', 'leafLengthCm', 'decimal-pad'],
            ['Leaf width (cm)', 'leafWidthCm', 'decimal-pad'],
            ['Tillers', 'tillerCount', 'number-pad'],
          ] as const
        ).map(([label, key, keyboardType]) => (
          <View key={key}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <NumericStepperInput
              editable={canReview}
              value={review[key] || ''}
              onChangeText={value =>
                update(
                  key,
                  keyboardType === 'number-pad'
                    ? value.replace(/\D/g, '')
                    : decimalEntry(value),
                )
              }
              placeholder="Not assessed"
              placeholderTextColor={colors.muted}
              accessibilityLabel={label}
              step={keyboardType === 'number-pad' ? 1 : 0.1}
              integer={keyboardType === 'number-pad'}
              textColor={colors.muted}
              borderColor={colors.line}
              backgroundColor={colors.surfaceAlt}
              style={styles.input}
              keyboardType={keyboardType}
            />
          </View>
        ))}
        <Text style={styles.fieldLabel}>Measurement date</Text>
        <DatePickerField
          value={review.measurementDate}
          onChange={value => update('measurementDate', value)}
          colors={colors}
          disabled={!canReview}
        />
        <Text style={styles.fieldLabel}>Crop variety</Text>
        <KeyboardAwareTextInput
          editable={canReview}
          value={review.cropVariety}
          onChangeText={value => update('cropVariety', value)}
          placeholder="If known"
          placeholderTextColor={colors.muted}
          maxLength={120}
          style={styles.input}
        />
        <Text style={styles.fieldLabel}>Crop growth stage</Text>
        <KeyboardAwareTextInput
          editable={canReview}
          value={review.growthStage}
          onChangeText={value => update('growthStage', value)}
          placeholder="For example, tillering"
          placeholderTextColor={colors.muted}
          maxLength={80}
          style={styles.input}
        />
        <Text style={styles.fieldLabel}>Plants sampled</Text>
        <NumericStepperInput
          editable={canReview}
          value={review.sampleCount}
          onChangeText={value =>
            update('sampleCount', value.replace(/\D/g, ''))
          }
          placeholder="Optional count"
          placeholderTextColor={colors.muted}
          accessibilityLabel="Plants sampled"
          step={1}
          integer
          textColor={colors.muted}
          borderColor={colors.line}
          backgroundColor={colors.surfaceAlt}
          style={styles.input}
          keyboardType="number-pad"
        />
        <Text style={[styles.fieldLabel, { marginTop: 18 }]}>
          Assessment rationale
        </Text>
        <KeyboardAwareTextInput
          editable={canReview}
          value={review.assessmentRationale}
          onChangeText={value => update('assessmentRationale', value)}
          placeholder="Add evidence-based findings"
          placeholderTextColor={colors.muted}
          style={[styles.input, styles.multiline]}
          multiline
          textAlignVertical="top"
        />
        <Text style={[styles.fieldLabel, { marginTop: 15 }]}>
          Reviewer note
        </Text>
        <KeyboardAwareTextInput
          editable={canReview}
          value={review.reviewerNote}
          onChangeText={value => update('reviewerNote', value)}
          placeholder="Internal notes and follow-up context"
          placeholderTextColor={colors.muted}
          style={[styles.input, styles.multiline]}
          multiline
          textAlignVertical="top"
        />
        <View
          ref={farmerMessageRef}
          collapsable={false}
          style={
            showFarmerMessageWarning
              ? {
                  borderWidth: 1,
                  borderColor: colors.red,
                  backgroundColor: colors.redSoft,
                  borderRadius: 10,
                  padding: 9,
                  marginTop: 10,
                }
              : undefined
          }
        >
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              columnGap: 8,
            }}
          >
            <Text style={[styles.fieldLabel, { marginTop: 15 }]}>
              Message to farmer
            </Text>
            {showFarmerMessageWarning ? (
              <Text
                style={{
                  color: colors.red,
                  fontSize: 11,
                  fontWeight: '800',
                  flexShrink: 1,
                }}
              >
                Add a farmer-facing update before completing a no-detection
                report.
              </Text>
            ) : null}
          </View>
          <KeyboardAwareTextInput
            editable={canReview}
            value={review.farmerMessage || ''}
            onFocus={() => setShowFarmerMessageWarning(false)}
            onChangeText={value => {
              update('farmerMessage', value);
              if (value.trim()) setShowFarmerMessageWarning(false);
            }}
            placeholder="Write a clear update the farmer can see"
            placeholderTextColor={colors.muted}
            maxLength={10000}
            style={[styles.input, styles.multiline]}
            multiline
            textAlignVertical="top"
          />
        </View>
        <Text style={[styles.fieldLabel, { marginTop: 15 }]}>Next step</Text>
        <View style={styles.choiceWrap}>
          <Choice
            label="Needs follow-up visit"
            selected={followUpDecision === 'needed'}
            onPress={() => {
              if (followUpDecision === 'needed') {
                setFollowUpDecision(null);
                update('followUpAt', '');
              } else {
                setFollowUpDecision('needed');
                setShowCompletionWarning(false);
              }
            }}
            disabled={
              !canReview || review.verificationStatus === 'No detection'
            }
            styles={styles}
          />
          <Choice
            label="Complete · no visit"
            selected={followUpDecision === 'complete'}
            onPress={() => {
              setFollowUpDecision(
                followUpDecision === 'complete' ? null : 'complete',
              );
              update('followUpAt', '');
            }}
            disabled={!canReview}
            styles={styles}
          />
        </View>
        {followUpDecision === 'needed' ? (
          <>
            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>
              Follow-up date
            </Text>
            <Text style={styles.inputHint}>
              Saving this review schedules a visit for the selected date.
            </Text>
            <DatePickerField
              value={review.followUpAt}
              onChange={value => update('followUpAt', value)}
              colors={colors}
              disabled={!canReview}
            />
          </>
        ) : followUpDecision === 'complete' ? (
          <Text style={styles.inputHint}>
            No follow-up visit will be scheduled for this report.
          </Text>
        ) : (
          <Text style={styles.inputHint}>
            Choose the next step before saving your review.
          </Text>
        )}
        {canReview ? (
          <PrimaryButton
            label={busy ? 'Saving review…' : 'Save review'}
            onPress={saveReview}
            disabled={busy}
            styles={styles}
          />
        ) : (
          <View style={styles.readOnly}>
            <Text style={styles.readOnlyText}>
              {reviewLocked
                ? 'This report is complete and cannot be edited.'
                : 'Review controls are disabled for view-only staff.'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

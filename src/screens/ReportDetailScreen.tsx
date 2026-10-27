import React, { useState } from 'react';
import { Alert, Image, Pressable, Text, TextInput, View } from 'react-native';
import { photoUrl } from '../api';
import { DatePickerField } from '../components/DatePickerField';
import { NumericStepperInput } from '../components/NumericStepperInput';
import { Farmer, FieldReport, ReviewForm, StaffSession } from '../types';
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
    : `${clean.slice(0, dot)}.${clean.slice(dot + 1).replace(/\./g, '').slice(0, 2)}`;
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
}: any) {
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
      : report.verification_status !== 'For verification' ||
        report.sra_severity ||
        report.assessment_rationale ||
        report.reviewer_note
      ? 'complete'
      : null,
  );
  const update = (key: keyof ReviewForm, value: string) =>
    setReview((old: ReviewForm) => ({ ...old, [key]: value }));
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
    const invalidCropMeasurement = cropMeasurements.find(([, value, integer]) => {
      if (!value?.trim()) return false;
      const number = Number(value);
      return !Number.isFinite(number) || number < 0 || (integer && !Number.isInteger(number));
    });
    if (invalidCropMeasurement) {
      Alert.alert(
        'Check crop measurements',
        `${invalidCropMeasurement[0]} must be a non-negative ${invalidCropMeasurement[2] ? 'whole number' : 'number'}.`,
      );
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
      Alert.alert(
        'Finish the assessment',
        'Choose Confirmed or No detection before marking this report complete. Reports that still need verification should have a follow-up visit.',
      );
      return;
    }
    onSave();
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
        <InfoLine label="Plant height" value={report.crop_characteristics?.plant_height_cm != null ? `${report.crop_characteristics.plant_height_cm} cm` : 'Not provided'} styles={styles} />
        <InfoLine label="Leaves in a stalk" value={report.crop_characteristics?.leaves_per_stalk != null ? String(report.crop_characteristics.leaves_per_stalk) : 'Not provided'} styles={styles} />
        <InfoLine label="Leaf length" value={report.crop_characteristics?.leaf_length_cm != null ? `${report.crop_characteristics.leaf_length_cm} cm` : 'Not provided'} styles={styles} />
        <InfoLine label="Leaf width" value={report.crop_characteristics?.leaf_width_cm != null ? `${report.crop_characteristics.leaf_width_cm} cm` : 'Not provided'} styles={styles} />
        <InfoLine label="Tillers" value={report.crop_characteristics?.tiller_count != null ? String(report.crop_characteristics.tiller_count) : 'Not provided'} styles={styles} />
      </View>
      <View style={styles.card}>
        <SectionTitle
          title={`Photo evidence · ${report.photos?.length || 0}`}
          detail="Private attachments · available to authorized staff"
          styles={styles}
        />
        {report.photos?.length ? (
          <View style={styles.photoGrid}>
            {report.photos.map((photo: any) => (
              <View key={photo.id} style={styles.photoCard}>
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
                  {photo.name}
                </Text>
              </View>
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
        <Text style={styles.fieldLabel}>Verification status</Text>
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
                  return;
                }
                update('verificationStatus', value);
              }}
              disabled={!canReview}
              styles={styles}
            />
          ))}
        </View>
        <Text style={[styles.fieldLabel, { marginTop: 18 }]}>
          SRA-assessed severity
        </Text>
        <Text style={styles.inputHint}>
          Choose independently from the farmer’s damage selection.
        </Text>
        <View style={styles.choiceWrap}>
          {severityOptions.map(value => (
            <Choice
              key={value}
              label={value}
              selected={review.sraSeverity === value}
              onPress={() => update('sraSeverity', value)}
              disabled={!canReview}
              styles={styles}
            />
          ))}
        </View>
        <Text style={[styles.fieldLabel, { marginTop: 18 }]}>SRA-assessed crop characteristics</Text>
        <Text style={styles.inputHint}>Enter measurements observed or verified by SRA. These do not overwrite the farmer’s original values.</Text>
        {([
          ['Plant height (cm)', 'plantHeightCm', 'decimal-pad'],
          ['Leaves in a stalk', 'leavesPerStalk', 'number-pad'],
          ['Leaf length (cm)', 'leafLengthCm', 'decimal-pad'],
          ['Leaf width (cm)', 'leafWidthCm', 'decimal-pad'],
          ['Tillers', 'tillerCount', 'number-pad'],
        ] as const).map(([label, key, keyboardType]) => (
          <View key={key}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <NumericStepperInput
              editable={canReview}
              value={review[key] || ''}
              onChangeText={value => update(key, keyboardType === 'number-pad' ? value.replace(/\D/g, '') : decimalEntry(value))}
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
        <Text style={[styles.fieldLabel, { marginTop: 18 }]}>
          Assessment rationale
        </Text>
        <TextInput
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
        <TextInput
          editable={canReview}
          value={review.reviewerNote}
          onChangeText={value => update('reviewerNote', value)}
          placeholder="Internal notes and follow-up context"
          placeholderTextColor={colors.muted}
          style={[styles.input, styles.multiline]}
          multiline
          textAlignVertical="top"
        />
        <Text style={[styles.fieldLabel, { marginTop: 15 }]}>Next step</Text>
        <View style={styles.choiceWrap}>
          <Choice
            label="Needs follow-up visit"
            selected={followUpDecision === 'needed'}
            onPress={() => setFollowUpDecision('needed')}
            disabled={!canReview}
            styles={styles}
          />
          <Choice
            label="Complete · no visit"
            selected={followUpDecision === 'complete'}
            onPress={() => {
              setFollowUpDecision('complete');
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

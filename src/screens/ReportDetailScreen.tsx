import React, { useState } from 'react';
import { Alert, Image, Pressable, Text, TextInput, View } from 'react-native';
import { photoUrl } from '../api';
import { DatePickerField } from '../components/DatePickerField';
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
export function ReportDetail({
  report,
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
              onPress={() => update('verificationStatus', value)}
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

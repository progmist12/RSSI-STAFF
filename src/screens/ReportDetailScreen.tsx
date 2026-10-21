import React from 'react';
import { Image, Pressable, Text, TextInput, View } from 'react-native';
import { photoUrl } from '../api';
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
  busy,
  photoFailed,
  setPhotoFailed,
  token,
  onSave,
}: any) {
  const update = (key: keyof ReviewForm, value: string) =>
    setReview((old: ReviewForm) => ({ ...old, [key]: value }));
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
            canReview
              ? 'Record an independent assessment and next step.'
              : 'This account has view-only access.'
          }
          styles={styles}
        />
        <Text style={styles.fieldLabel}>Verification status</Text>
        <View style={styles.choiceWrap}>
          {verificationOptions.map(value => (
            <Choice
              key={value}
              label={value}
              selected={review.verificationStatus === value}
              onPress={() => update('verificationStatus', value)}
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
        <Text style={[styles.fieldLabel, { marginTop: 15 }]}>
          Follow-up date <Text style={styles.optionalText}>optional</Text>
        </Text>
        <TextInput
          editable={canReview}
          value={review.followUpAt}
          onChangeText={value => update('followUpAt', value)}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.muted}
          style={styles.input}
          autoCapitalize="none"
        />
        {canReview ? (
          <PrimaryButton
            label={busy ? 'Saving review…' : 'Save review'}
            onPress={onSave}
            disabled={busy}
            styles={styles}
          />
        ) : (
          <View style={styles.readOnly}>
            <Text style={styles.readOnlyText}>
              Review controls are disabled for view-only staff.
            </Text>
          </View>
        )}
      </View>
      <View style={styles.privacyCallout}>
        <Text style={styles.privacyGlyph}>ⓘ</Text>
        <Text style={styles.privacyText}>
          Report observations and photos do not confirm RSSI. Verification
          decisions remain with authorized SRA reviewers.
        </Text>
      </View>
    </View>
  );
}

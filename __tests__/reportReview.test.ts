import {
  reportHasReview,
  reportWorkflowStage,
  reviewPayload,
} from '../src/app/reportReview';
import {FieldReport, ReviewForm} from '../src/types';

function makeReport(overrides: Partial<FieldReport> = {}): FieldReport {
  return {
    id: 12,
    code: 'RSSI-26-TEST',
    property_name: 'Sample Farm',
    province: 'Negros Oriental',
    municipality: 'Pamplona',
    observed_at: '2026-10-27',
    submitted_at: '2026-10-27T08:00:00+08:00',
    observations: 'Observed leaf damage',
    damage_description: 'Several leaves affected',
    farmer_severity: 'Moderate',
    affected_area_hectares: '1.00',
    verification_status: 'For verification',
    sra_severity: null,
    photos: [],
    ...overrides,
  };
}

test('review decision moves report through reviewed, upcoming, and completed stages', () => {
  const submitted = makeReport();
  expect(reportWorkflowStage(submitted)).toBe('needs_review');
  expect(reportHasReview(submitted)).toBe(false);

  const reviewed = makeReport({
    assessment_rationale: 'Visited the property and inspected the affected crop.',
  });
  expect(reportWorkflowStage(reviewed)).toBe('reviewed');
  expect(reportHasReview(reviewed)).toBe(true);

  const upcoming = makeReport({
    verification_status: 'Confirmed',
    sra_severity: 'Moderate',
    follow_up_at: '2026-11-04T08:00:00+08:00',
    workflow_stage: 'upcoming',
  });
  expect(reportWorkflowStage(upcoming)).toBe('upcoming');

  const completed = makeReport({
    verification_status: 'No detection',
    review_completed_at: '2026-10-27T10:00:00+08:00',
    workflow_stage: 'completed',
  });
  expect(reportWorkflowStage(completed)).toBe('completed');
});

test('review payload normalizes evidence, scheduling, and crop measurements for the API', () => {
  const review: ReviewForm = {
    verificationStatus: 'Confirmed',
    sraSeverity: 'Severe',
    assessmentRationale: '  inspected in person  ',
    reviewerNote: '  internal note  ',
    farmerMessage: '  follow-up planned  ',
    followUpAt: '2026-11-04',
    plantHeightCm: '84.5',
    leavesPerStalk: '7',
    leafLengthCm: '56',
    leafWidthCm: '2.4',
    tillerCount: '11',
    measurementDate: '2026-10-27',
    cropVariety: '  local variety  ',
    growthStage: '  tillering  ',
    sampleCount: '5',
  };

  expect(reviewPayload(review, 'needed')).toEqual({
    nextStep: 'needed',
    verificationStatus: 'Confirmed',
    sraSeverity: 'Severe',
    assessmentRationale: 'inspected in person',
    reviewerNote: 'internal note',
    farmerMessage: 'follow-up planned',
    followUpAt: '2026-11-04',
    cropCharacteristics: {
      plantHeightCm: 84.5,
      leavesPerStalk: 7,
      leafLengthCm: 56,
      leafWidthCm: 2.4,
      tillerCount: 11,
      measurementDate: '2026-10-27',
      cropVariety: 'local variety',
      growthStage: 'tillering',
      sampleCount: 5,
    },
  });
});

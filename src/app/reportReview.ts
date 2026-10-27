import { FieldReport, ReviewForm } from '../types';

export function reportIsCompleteWithoutVisit(report: FieldReport) {
  if (report.review_completed_at) return true;
  if (report.workflow_stage) return report.workflow_stage === 'completed';
  return (
    ['Confirmed', 'No detection'].includes(report.verification_status) &&
    !report.follow_up_at
  );
}

export function reportHasReview(report: FieldReport) {
  const crop = report.sra_crop_assessment;
  return Boolean(
    report.verification_status !== 'For verification' ||
      report.sra_severity ||
      report.assessment_rationale?.trim() ||
      report.reviewer_note?.trim() ||
      report.farmer_message?.trim() ||
      report.follow_up_at ||
      crop?.plant_height_cm != null ||
      crop?.leaves_per_stalk != null ||
      crop?.leaf_length_cm != null ||
      crop?.leaf_width_cm != null ||
      crop?.tiller_count != null ||
      crop?.measurement_date ||
      crop?.crop_variety ||
      crop?.growth_stage ||
      crop?.sample_count != null,
  );
}

export function reportWorkflowStage(report: FieldReport) {
  if (report.workflow_stage) return report.workflow_stage;
  if (reportIsCompleteWithoutVisit(report)) return 'completed';
  if (report.follow_up_at) return 'upcoming';
  if (!reportHasReview(report)) return 'needs_review';
  if (report.verification_status === 'Confirmed') return 'confirmed';
  return 'reviewed';
}

export function reportWorkflowLabel(report: FieldReport) {
  return (
    {
      needs_review: 'Needs review',
      reviewed: 'Reviewed',
      confirmed: 'Confirmed',
      upcoming: 'Upcoming',
      completed: 'Completed',
    } as const
  )[reportWorkflowStage(report)];
}

export function reportWorkflowTone(report: FieldReport) {
  const stage = reportWorkflowStage(report);
  return stage === 'needs_review'
    ? 'amber'
    : stage === 'confirmed' || stage === 'completed'
    ? 'green'
    : 'blue';
}

export function reviewFromReport(report: FieldReport): ReviewForm {
  return {
    verificationStatus: report.verification_status || 'For verification',
    sraSeverity: report.sra_severity || 'Not assessed',
    assessmentRationale: report.assessment_rationale || '',
    reviewerNote: report.reviewer_note || '',
    farmerMessage: report.farmer_message || '',
    followUpAt: report.follow_up_at || '',
    plantHeightCm: report.sra_crop_assessment?.plant_height_cm?.toString() || '',
    leavesPerStalk: report.sra_crop_assessment?.leaves_per_stalk?.toString() || '',
    leafLengthCm: report.sra_crop_assessment?.leaf_length_cm?.toString() || '',
    leafWidthCm: report.sra_crop_assessment?.leaf_width_cm?.toString() || '',
    tillerCount: report.sra_crop_assessment?.tiller_count?.toString() || '',
    measurementDate: report.sra_crop_assessment?.measurement_date || '',
    cropVariety: report.sra_crop_assessment?.crop_variety || '',
    growthStage: report.sra_crop_assessment?.growth_stage || '',
    sampleCount: report.sra_crop_assessment?.sample_count?.toString() || '',
  };
}

export function reviewPayload(review: ReviewForm, nextStep: 'needed' | 'complete') {
  return {
    nextStep,
    verificationStatus: review.verificationStatus,
    sraSeverity: review.sraSeverity || 'Not assessed',
    assessmentRationale: review.assessmentRationale.trim() || null,
    reviewerNote: review.reviewerNote.trim() || null,
    farmerMessage: review.farmerMessage?.trim() || null,
    followUpAt: review.followUpAt.trim() || null,
    cropCharacteristics: {
      plantHeightCm: review.plantHeightCm?.trim() ? Number(review.plantHeightCm) : null,
      leavesPerStalk: review.leavesPerStalk?.trim() ? Number(review.leavesPerStalk) : null,
      leafLengthCm: review.leafLengthCm?.trim() ? Number(review.leafLengthCm) : null,
      leafWidthCm: review.leafWidthCm?.trim() ? Number(review.leafWidthCm) : null,
      tillerCount: review.tillerCount?.trim() ? Number(review.tillerCount) : null,
      measurementDate: review.measurementDate?.trim() || null,
      cropVariety: review.cropVariety?.trim() || null,
      growthStage: review.growthStage?.trim() || null,
      sampleCount: review.sampleCount?.trim() ? Number(review.sampleCount) : null,
    },
  };
}

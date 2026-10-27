import { FieldReport, ReviewForm } from '../types';

export function reportIsCompleteWithoutVisit(report: FieldReport) {
  if (report.verification_status === 'No detection') return true;
  return report.verification_status === 'Confirmed' && !report.follow_up_at;
}

export function reviewFromReport(report: FieldReport): ReviewForm {
  return {
    verificationStatus: report.verification_status || 'For verification',
    sraSeverity: report.sra_severity || 'Not assessed',
    assessmentRationale: report.assessment_rationale || '',
    reviewerNote: report.reviewer_note || '',
    followUpAt: report.follow_up_at || '',
    plantHeightCm: report.sra_crop_assessment?.plant_height_cm?.toString() || '',
    leavesPerStalk: report.sra_crop_assessment?.leaves_per_stalk?.toString() || '',
    leafLengthCm: report.sra_crop_assessment?.leaf_length_cm?.toString() || '',
    leafWidthCm: report.sra_crop_assessment?.leaf_width_cm?.toString() || '',
    tillerCount: report.sra_crop_assessment?.tiller_count?.toString() || '',
  };
}

export function reviewPayload(review: ReviewForm) {
  return {
    verificationStatus: review.verificationStatus,
    sraSeverity: review.sraSeverity || 'Not assessed',
    assessmentRationale: review.assessmentRationale.trim() || null,
    reviewerNote: review.reviewerNote.trim() || null,
    followUpAt: review.followUpAt.trim() || null,
    cropCharacteristics: {
      plantHeightCm: review.plantHeightCm?.trim() ? Number(review.plantHeightCm) : null,
      leavesPerStalk: review.leavesPerStalk?.trim() ? Number(review.leavesPerStalk) : null,
      leafLengthCm: review.leafLengthCm?.trim() ? Number(review.leafLengthCm) : null,
      leafWidthCm: review.leafWidthCm?.trim() ? Number(review.leafWidthCm) : null,
      tillerCount: review.tillerCount?.trim() ? Number(review.tillerCount) : null,
    },
  };
}

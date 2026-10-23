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
  };
}

export function reviewPayload(review: ReviewForm) {
  return {
    verificationStatus: review.verificationStatus,
    sraSeverity: review.sraSeverity || 'Not assessed',
    assessmentRationale: review.assessmentRationale.trim() || null,
    reviewerNote: review.reviewerNote.trim() || null,
    followUpAt: review.followUpAt.trim() || null,
  };
}

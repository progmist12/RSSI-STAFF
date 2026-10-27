export type StaffProfile = {
  id: number;
  email: string;
  name: string;
  role: string;
  province_access: string;
  profile_photo_url?: string | null;
};

export type StaffSession = {
  token: string;
  user: StaffProfile;
  scopes: string[];
};

export type FarmProperty = {
  id: number;
  name: string;
  province: string;
  municipality: string;
  barangay: string | null;
  address?: string | null;
  size_hectares: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_consent?: boolean;
};

export type Farmer = {
  id: number;
  reference: string;
  name: string;
  email: string | null;
  status: string;
  properties: FarmProperty[];
};

export type ReportPhoto = { id: number; name: string; url: string };

export type FieldReport = {
  id: number;
  code: string;
  property_name: string;
  property_id?: number | null;
  province: string;
  municipality: string;
  barangay?: string | null;
  location_description?: string | null;
  observed_at: string;
  submitted_at: string;
  observations: string;
  damage_description: string;
  crop_characteristics?: {
    plant_height_cm: number | null;
    leaves_per_stalk: number | null;
    leaf_length_cm: number | null;
    leaf_width_cm: number | null;
    tiller_count: number | null;
  };
  sra_crop_assessment?: {
    plant_height_cm: number | null;
    leaves_per_stalk: number | null;
    leaf_length_cm: number | null;
    leaf_width_cm: number | null;
    tiller_count: number | null;
  };
  farmer_severity: string;
  farmer_severity_range?: string | null;
  affected_area_hectares: string;
  verification_status: string;
  sra_severity: string | null;
  photos: ReportPhoto[];
  farmer?: { name: string; reference: string | null };
  assigned_reviewer?: string | null;
  assessment_rationale?: string | null;
  reviewer_note?: string | null;
  follow_up_at?: string | null;
  review_completed_at?: string | null;
  workflow_stage?: 'needs_review' | 'reviewed' | 'confirmed' | 'upcoming' | 'completed';
  /** Local-only marker for review edits queued offline; never synced to the API. */
  review_pending?: boolean;
};

export type VisitCheckingResult =
  | 'observed'
  | 'not_observed'
  | 'checked'
  | 'unable_to_check';

export type VisitCheckingInput = {
  label: string;
  result: VisitCheckingResult;
  finding: string;
};

export type CropCharacteristics = {
  leavesPerStalk: number | null;
  plantHeight: number | null;
  leafLength: number | null;
  leafWidth: number | null;
  tillers: number | null;
};

export type StaffVisit = {
  id: number;
  report_id: number;
  property_id?: number | null;
  report_code: string;
  property_name: string;
  farmer_name: string;
  province: string;
  municipality: string;
  scheduled_at: string;
  completed_at: string | null;
  status: 'scheduled' | 'completed' | 'cancelled';
  visit_findings: string | null;
  crop_characteristics?: CropCharacteristics | null;
  staff_name: string | null;
  completed_by_name: string | null;
  checkings: Array<{
    id: number;
    label: string;
    result: VisitCheckingResult;
    finding: string | null;
  }>;
  created_at: string;
  updated_at: string;
  /** Local-only indicator while an offline visit change waits for resolution or sync. */
  sync_state?: 'pending' | 'conflict';
};

export type StaffMapReport = {
  id: number;
  property_id?: number | null;
  farmer_name?: string | null;
  code: string;
  property_name: string;
  farmer_severity: string;
  farmer_severity_range?: string | null;
  verification_status: string;
  observed_at: string;
  submitted_at: string;
};

export type StaffMapLocation = {
  latitude: number;
  longitude: number;
  title: string;
  detail: string;
  province: string;
  municipality: string | null;
  location_type:
    | 'consented_farm'
    | 'approximate_municipality'
    | 'approximate_province';
  farmer_severity: string | null;
  farmer_severity_range?: string | null;
  report_count: number;
  reports: StaffMapReport[];
};

export type ApiPage<T> = {
  data: T[];
  meta: { page: number; page_size: number; total: number };
};

export type ReviewForm = {
  verificationStatus: string;
  sraSeverity: string;
  assessmentRationale: string;
  reviewerNote: string;
  followUpAt: string;
  plantHeightCm: string;
  leavesPerStalk: string;
  leafLengthCm: string;
  leafWidthCm: string;
  tillerCount: string;
};

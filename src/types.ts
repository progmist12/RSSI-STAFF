export type StaffProfile = {
  id: number;
  email: string;
  name: string;
  role: string;
  province_access: string;
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
};

export type StaffMapReport = {
  id: number;
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
  location_type: 'consented_farm' | 'approximate_municipality' | 'approximate_province';
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
};

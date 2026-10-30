import {StaffProfile} from './types';
import type {Asset} from 'react-native-image-picker';

// Shared test deployment used by the RSSI mobile clients. Keep this out of UI.
const API_BASE_URL = 'https://shelving-thicket-handrail.ngrok-free.dev';
const API_ROOT = `${API_BASE_URL}/api/v1`;

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public payload?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const messages: Record<string, string> = {
  invalid_credentials: 'Username or password is incorrect.',
  account_unavailable: 'Account inactive. Contact your administrator.',
  unauthorized: 'Session expired. Sign in again.',
  forbidden: "You don't have access to this.",
  report_not_found: 'Report no longer available.',
  farmer_not_found: 'Farmer no longer available.',
  photo_not_found: 'Photo no longer available.',
  server_unavailable: "Can't connect. Check your internet and try again.",
  server_error: "Couldn't load this. Try again later.",
  invalid_follow_up_date: 'Enter a valid follow-up date.',
  invalid_visit_date: 'Enter a valid visit date.',
  invalid_visit_checkings: 'Check the visit details and try again.',
  invalid_review_transition: 'Check the review details and try again.',
  active_visit_exists: 'Finish or cancel the scheduled visit first.',
  visit_not_found: 'Visit no longer available.',
  visit_is_locked: 'This visit is already closed.',
  visit_conflict: 'Visit changed. Refresh and try again.',
  report_review_completed: 'This report is already complete.',
  invalid_visit_version: 'Refresh the visit and try again.',
  invalid_profile_photo: 'Choose an image under 5 MB.',
  unsupported_media_type: 'Choose a supported image file.',
};

const statusMessages: Record<number, string> = {
  400: 'Check the details and try again.',
  401: 'Session expired. Sign in again.',
  403: "You don't have access to this.",
  404: 'This item is no longer available.',
  409: 'This item changed. Refresh and try again.',
  413: 'File is too large.',
  415: 'Choose a supported file type.',
  422: 'Check the details and try again.',
  429: 'Too many attempts. Try again later.',
};

async function decode<T>(response: Response, path = ''): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const serverError = response.status >= 500;
    const code = serverError
      ? 'server_error'
      : typeof body.error === 'string'
        ? body.error
        : `http_${response.status}`;
    const loginFailure = path === '/auth/login'
      ? "Can't sign in right now. Try again later."
      : undefined;
    const message = serverError
      ? loginFailure || messages.server_error
      : messages[code] || loginFailure || statusMessages[response.status] || 'Could not complete this. Try again.';
    throw new ApiError(response.status, code, message, body);
  }
  return body as T;
}

export async function apiRequest<T>(path: string, token?: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'ngrok-skip-browser-warning': 'true',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (typeof options.body === 'string') headers['Content-Type'] = 'application/json';
  try {
    const response = await fetch(`${API_ROOT}${path}`, {...options, headers});
    return await decode<T>(response, path);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const message = path === '/auth/login'
      ? "Can't sign in right now. Check your internet and try again."
      : messages.server_unavailable;
    throw new ApiError(0, 'server_unavailable', message);
  }
}

export async function staffLogin(email: string, password: string) {
  return apiRequest<{
    access_token: string;
    account_type: string;
    user: StaffProfile;
    scopes: string[];
  }>('/auth/login', undefined, {
    method: 'POST',
    body: JSON.stringify({accountType: 'staff', email: email.trim(), password}),
  });
}

export function photoUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

export async function uploadStaffProfilePhoto(token: string, photo: Asset): Promise<{profile_photo_url: string | null}> {
  if (!photo.uri) throw new ApiError(422, 'invalid_profile_photo', messages.invalid_profile_photo);
  const form = new FormData();
  form.append('photo', {
    uri: photo.uri,
    name: photo.fileName || `rssi-staff-profile-${Date.now()}.jpg`,
    type: photo.type || 'image/jpeg',
  } as unknown as Blob);
  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
    'ngrok-skip-browser-warning': 'true',
  };
  try {
    const response = await fetch(`${API_ROOT}/me/profile-photo`, {method: 'POST', headers, body: form});
    return await decode<{profile_photo_url: string | null}>(response, '/me/profile-photo');
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, 'server_unavailable', messages.server_unavailable);
  }
}


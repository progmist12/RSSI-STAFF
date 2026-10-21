import {StaffProfile} from './types';

// Shared test deployment used by the RSSI mobile clients. Keep this out of UI.
const API_BASE_URL = 'https://groved-subdialectally-shellie.ngrok-free.dev';
const API_ROOT = `${API_BASE_URL}/api/v1`;

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

const messages: Record<string, string> = {
  invalid_credentials: 'Email or password is incorrect.',
  account_unavailable: 'This staff account is inactive. Contact your workspace administrator.',
  unauthorized: 'Your session expired. Sign in again to continue.',
  forbidden: 'Your staff account does not have permission for this action.',
  report_not_found: 'This report is no longer available.',
  server_unavailable: 'The RSSI service could not be reached. Check your connection and try again.',
  invalid_follow_up_date: 'Enter the follow-up date as YYYY-MM-DD.',
  invalid_visit_date: 'Enter the visit date using YYYY-MM-DD.',
  invalid_visit_checkings: 'One or more visit checks have invalid details.',
  active_visit_exists: 'Complete or cancel the current scheduled visit first.',
  visit_not_found: 'This field visit is no longer available.',
  visit_is_locked: 'Completed and cancelled visits are preserved as history.',
};

async function decode<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const code = typeof body.error === 'string' ? body.error : `http_${response.status}`;
    const message = typeof body.message === 'string' ? body.message : messages[code] || code.replaceAll('_', ' ');
    throw new ApiError(response.status, code, message);
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
    return await decode<T>(response);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, 'server_unavailable', messages.server_unavailable);
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


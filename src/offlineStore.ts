import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Farmer,
  FieldReport,
  CropCharacteristics,
  ReviewForm,
  StaffMapLocation,
  StaffVisit,
  VisitCheckingInput,
} from './types';

export type PendingReview = {
  reportId: number;
  review: ReviewForm;
  nextStep?: 'needed' | 'complete';
  updatedAt: string;
};

export type PendingVisitChange = {
  id: string;
  kind: 'create' | 'update';
  reportId: number;
  visitId: number | null;
  localVisit: StaffVisit;
  baseVisit?: StaffVisit | null;
  expectedUpdatedAt: string | null;
  payload: {
    status: StaffVisit['status'];
    scheduledAt: string;
    visitFindings: string;
    checkings: VisitCheckingInput[];
    cropCharacteristics: CropCharacteristics;
  };
  state: 'pending' | 'conflict';
  conflictMessage?: string;
  remoteVisit?: StaffVisit | null;
  savedAt: string;
};

export type AppNotification = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  reportId?: number;
};

export type WorkspaceSnapshot = {
  reports: FieldReport[];
  farmers: Farmer[];
  mapLocations?: StaffMapLocation[];
  mapReportTotal?: number;
  visits?: StaffVisit[];
  visitTotal?: number;
  visitPage?: number;
  reportTotal: number;
  farmerTotal: number;
  pendingTotal: number;
  reportPage: number;
  farmerPage: number;
};

const key = (userId: number, kind: string) => `rssi_staff_${kind}_${userId}`;

export async function readWorkspace(
  userId: number,
): Promise<WorkspaceSnapshot | null> {
  try {
    const value = await AsyncStorage.getItem(key(userId, 'workspace'));
    return value ? (JSON.parse(value) as WorkspaceSnapshot) : null;
  } catch {
    return null;
  }
}

export async function saveWorkspace(
  userId: number,
  snapshot: WorkspaceSnapshot,
) {
  try {
    await AsyncStorage.setItem(
      key(userId, 'workspace'),
      JSON.stringify(snapshot),
    );
  } catch {
    // Keep the app usable if device storage is temporarily unavailable.
  }
}

export async function readPendingReviews(
  userId: number,
): Promise<PendingReview[]> {
  try {
    const value = await AsyncStorage.getItem(key(userId, 'pending_reviews'));
    return value ? (JSON.parse(value) as PendingReview[]) : [];
  } catch {
    return [];
  }
}

export async function savePendingReviews(
  userId: number,
  items: PendingReview[],
) {
  try {
    await AsyncStorage.setItem(
      key(userId, 'pending_reviews'),
      JSON.stringify(items),
    );
  } catch {
    // The caller still updates the visible report for this app session.
  }
}

export async function readPendingVisitChanges(
  userId: number,
): Promise<PendingVisitChange[]> {
  try {
    const value = await AsyncStorage.getItem(key(userId, 'pending_visits'));
    return value ? (JSON.parse(value) as PendingVisitChange[]) : [];
  } catch {
    return [];
  }
}

export async function savePendingVisitChanges(
  userId: number,
  items: PendingVisitChange[],
) {
  try {
    await AsyncStorage.setItem(
      key(userId, 'pending_visits'),
      JSON.stringify(items),
    );
  } catch {
    // The visible session can still continue if device storage is unavailable.
  }
}

export async function readNotifications(
  userId: number,
): Promise<AppNotification[]> {
  try {
    const value = await AsyncStorage.getItem(key(userId, 'notifications'));
    return value ? (JSON.parse(value) as AppNotification[]) : [];
  } catch {
    return [];
  }
}

export async function saveNotifications(
  userId: number,
  items: AppNotification[],
) {
  try {
    await AsyncStorage.setItem(
      key(userId, 'notifications'),
      JSON.stringify(items.slice(0, 50)),
    );
  } catch {
    // Notifications are helpful but should never block core app actions.
  }
}

export async function readNotificationEventCursor(
  userId: number,
): Promise<number | null> {
  try {
    const value = await AsyncStorage.getItem(key(userId, 'notification_event_cursor'));
    if (value === null || !/^\d+$/.test(value)) return null;
    return Number(value);
  } catch {
    return null;
  }
}

export async function saveNotificationEventCursor(userId: number, cursor: number) {
  try {
    await AsyncStorage.setItem(key(userId, 'notification_event_cursor'), String(cursor));
  } catch {
    // Notification cursors must not block report or visit workflows.
  }
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Farmer, FieldReport, ReviewForm, StaffMapLocation } from './types';

export type PendingReview = {
  reportId: number;
  review: ReviewForm;
  updatedAt: string;
};

export type AppNotification = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
};

export type WorkspaceSnapshot = {
  reports: FieldReport[];
  farmers: Farmer[];
  mapLocations?: StaffMapLocation[];
  mapReportTotal?: number;
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

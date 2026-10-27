import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useStaffRecordActions,
  type LoadMoreKind,
} from './useStaffRecordActions';
import { reviewFromReport, reviewPayload } from './reportReview';
import { visitPayloadForApi } from './visitPayload';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import {
  clearReportPhoneNotifications,
  listenForReportNotificationPress,
  notifyStaffUpdate,
  preparePhoneNotifications,
  syncVisitReminders,
} from './phoneNotifications';
import { ApiError, apiRequest, staffLogin } from '../api';
import { clearSession, readSession, saveSession } from '../session';
import {
  ApiPage,
  Farmer,
  FieldReport,
  ReviewForm,
  StaffMapLocation,
  StaffProfile,
  StaffSession,
  StaffVisit,
} from '../types';
import {
  AppNotification,
  PendingVisitChange,
  readNotifications,
  readPendingReviews,
  readPendingVisitChanges,
  readWorkspace,
  saveNotifications,
  savePendingReviews,
  savePendingVisitChanges,
  saveWorkspace,
  readNotificationEventCursor,
  saveNotificationEventCursor,
} from '../offlineStore';

export type Tab =
  | 'home'
  | 'map'
  | 'reports'
  | 'visits'
  | 'farmers'
  | 'settings';

function withPendingVisits(
  serverVisits: StaffVisit[],
  changes: PendingVisitChange[],
): StaffVisit[] {
  const pending = [...changes]
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
    .map(change => ({ ...change.localVisit, sync_state: change.state }));
  const pendingIds = new Set(pending.map(visit => visit.id));
  return [...pending, ...serverVisits.filter(visit => !pendingIds.has(visit.id))];
}

export function useStaffAppController() {
  const [session, setSession] = useState<StaffSession | null>(null);
  const [booting, setBooting] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [tab, setTab] = useState<Tab>('home');
  const [reports, setReports] = useState<FieldReport[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [mapLocations, setMapLocations] = useState<StaffMapLocation[]>([]);
  const [mapReportTotal, setMapReportTotal] = useState(0);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [reportTotal, setReportTotal] = useState(0);
  const [farmerTotal, setFarmerTotal] = useState(0);
  const [reportPage, setReportPage] = useState(1);
  const [farmerPage, setFarmerPage] = useState(1);
  const [visits, setVisits] = useState<StaffVisit[]>([]);
  const [pendingVisitChanges, setPendingVisitChanges] = useState<PendingVisitChange[]>([]);
  const [visitTotal, setVisitTotal] = useState(0);
  const [visitPage, setVisitPage] = useState(1);
  const [visitBusy, setVisitBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState<LoadMoreKind | null>(null);
  const [selectedReport, setSelectedReport] = useState<FieldReport | null>(
    null,
  );
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
  const [review, setReview] = useState<ReviewForm | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [listFilter, setListFilter] = useState('Needs review');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [online, setOnline] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeKind, setNoticeKind] = useState<'error' | 'success' | 'info'>(
    'info',
  );
  const [photoFailed, setPhotoFailed] = useState<number[]>([]);
  const [cacheReady, setCacheReady] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);
  const refreshRef = useRef<(showSpinner?: boolean) => Promise<void>>(
    async () => undefined,
  );
  const refreshInFlightRef = useRef(false);
  const visitOutboxSyncInFlightRef = useRef(false);
  const lastAutomaticRefreshAtRef = useRef(0);
  const notificationEventCursorRef = useRef<number | null>(null);
  const notificationCursorUserRef = useRef<number | null>(null);
  const processedNotificationKeysRef = useRef(new Set<string>());
  const selectedReportRef = useRef<FieldReport | null>(null);
  const reviewRef = useRef<ReviewForm | null>(null);
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  selectedReportRef.current = selectedReport;
  reviewRef.current = review;
  const baseOpenReportRef = useRef<(report: FieldReport | number) => Promise<boolean>>(
    async () => false,
  );
  const handledNotificationReportsRef = useRef(new Set<number>());
  const pendingNotificationKey = 'rssi_staff_pending_report_open';

  const hydrateLocalData = useCallback(async (active: StaffSession) => {
    const [snapshot, queue, visitQueue, savedNotifications] = await Promise.all([
      readWorkspace(active.user.id),
      readPendingReviews(active.user.id),
      readPendingVisitChanges(active.user.id),
      readNotifications(active.user.id),
    ]);
    setPendingVisitChanges(visitQueue);
    if (snapshot) {
      const pendingIds = new Set(queue.map(item => item.reportId));
      setReports(
        (snapshot.reports || []).map(report =>
          pendingIds.has(report.id)
            ? { ...report, review_pending: true }
            : report,
        ),
      );
      setFarmers(snapshot.farmers || []);
      setMapLocations(snapshot.mapLocations || []);
      setMapReportTotal(
        snapshot.mapReportTotal ??
          snapshot.mapLocations?.reduce(
            (total, location) => total + location.report_count,
            0,
          ) ??
          0,
      );
      setVisits(withPendingVisits(snapshot.visits || [], visitQueue));
      setVisitTotal((snapshot.visitTotal || 0) + visitQueue.filter(item => item.kind === 'create').length);
      setVisitPage(snapshot.visitPage || 1);
      setReportTotal(snapshot.reportTotal || 0);
      setFarmerTotal(snapshot.farmerTotal || 0);
      setPendingTotal(snapshot.pendingTotal || 0);
      setReportPage(snapshot.reportPage || 1);
      setFarmerPage(snapshot.farmerPage || 1);
    }
    setPendingReviewCount(queue.length);
    const reportNotifications = savedNotifications
      .filter(
        item =>
          item.title !== 'Connection restored' &&
          item.title !== 'You are offline',
      )
      .map(item => {
        if (item.reportId) return item;
        const report = snapshot?.reports?.find(candidate =>
          item.message.includes(candidate.code),
        );
        return report ? { ...item, reportId: report.id } : item;
      });
    setNotifications(reportNotifications);
    processedNotificationKeysRef.current = new Set(reportNotifications.map(item => item.id));
    if (reportNotifications.length !== savedNotifications.length) {
      void saveNotifications(active.user.id, reportNotifications);
    } else if (
      reportNotifications.some(
        (item, index) => item.reportId !== savedNotifications[index]?.reportId,
      )
    ) {
      void saveNotifications(active.user.id, reportNotifications);
    }
    setCacheReady(true);
  }, []);

  const addNotification = useCallback(
    (title: string, message: string, reportId?: number, stableKey?: string) => {
      if (!session) return false;
      if (stableKey && processedNotificationKeysRef.current.has(stableKey)) return false;
      if (stableKey) processedNotificationKeysRef.current.add(stableKey);
      const item: AppNotification = {
        id: stableKey || `${Date.now()}-${Math.random()}`,
        title,
        message,
        createdAt: new Date().toISOString(),
        read: false,
        reportId,
      };
      setNotifications(current => {
        const next = [item, ...current].slice(0, 50);
        void saveNotifications(session.user.id, next);
        return next;
      });
      return true;
    },
    [session],
  );

  const markNotificationsRead = useCallback(() => {
    setNotifications(current => {
      const next = current.map(item => ({ ...item, read: true }));
      if (session) void saveNotifications(session.user.id, next);
      return next;
    });
  }, [session]);

  const showNotice = useCallback(
    (message: string, kind: 'error' | 'success' | 'info' = 'info') => {
      if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
      setNotice(message);
      setNoticeKind(kind);
      noticeTimeoutRef.current = setTimeout(() => {
        setNotice(current => (current === message ? '' : current));
        noticeTimeoutRef.current = null;
      }, 2000);
    },
    [],
  );

  useEffect(
    () => () => {
      if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    },
    [],
  );

  const signOut = useCallback(
    async (remote = true) => {
      const active = session;
      if (remote && active?.token) {
        try {
          await apiRequest('/auth/logout', active.token, { method: 'POST' });
        } catch {
          /* local sign out still completes */
        }
      }
      await clearSession().catch(() => undefined);
      setSession(null);
      notificationEventCursorRef.current = null;
      notificationCursorUserRef.current = null;
      processedNotificationKeysRef.current.clear();
      setReports([]);
      setFarmers([]);
      setMapLocations([]);
      setMapReportTotal(0);
      setVisits([]);
      setVisitTotal(0);
      setVisitPage(1);
      setSelectedReport(null);
      setSelectedFarmer(null);
      setPassword('');
      setTab('home');
      setCacheReady(false);
    },
    [session],
  );

  const updateStaffProfilePhoto = useCallback(
    async (profilePhotoUrl: string | null) => {
      if (!session) return;
      const updated = {
        ...session,
        user: { ...session.user, profile_photo_url: profilePhotoUrl },
      };
      await saveSession(updated);
      setSession(updated);
      showNotice('Profile picture saved.', 'success');
    },
    [session, showNotice],
  );

  const flushPendingReviews = useCallback(async () => {
    if (!session?.token || !online) return;
    const queue = await readPendingReviews(session.user.id);
    if (!queue.length) {
      setPendingReviewCount(0);
      return;
    }
    let remaining = [...queue];
    let synced = 0;
    for (const item of queue) {
      try {
        const result = await apiRequest<{ data: FieldReport; visit?: StaffVisit | null }>(
          `/staff/reports/${item.reportId}/review`,
          session.token,
          {
            method: 'PUT',
            body: JSON.stringify(
              reviewPayload(
                item.review,
                item.nextStep || (item.review.followUpAt ? 'needed' : 'complete'),
              ),
            ),
          },
        );
        setReports(current =>
          current.map(report =>
            report.id === item.reportId ? result.data : report,
          ),
        );
        setSelectedReport(current =>
          current?.id === item.reportId ? result.data : current,
        );
        if (result.visit) {
          const visitWasLoaded = visits.some(visit => visit.id === result.visit?.id);
          setVisits(current =>
            visitWasLoaded
              ? current.map(visit => visit.id === result.visit?.id ? result.visit as StaffVisit : visit)
              : result.visit?.status === 'scheduled'
              ? [result.visit as StaffVisit, ...current]
              : current,
          );
          if (!visitWasLoaded && result.visit.status === 'scheduled') {
            setVisitTotal(total => total + 1);
          }
        }
        remaining = remaining.filter(
          review => review.reportId !== item.reportId,
        );
        synced += 1;
        await savePendingReviews(session.user.id, remaining);
      } catch (error) {
        if (error instanceof ApiError && error.status !== 0) {
          // Keep rejected work visible for the staff member to resolve.
          break;
        }
        break;
      }
    }
    setPendingReviewCount(remaining.length);
    if (synced) {
      addNotification(
        'Offline reviews synced',
        `${synced} saved review${
          synced === 1 ? '' : 's'
        } sent to the RSSI workspace.`,
      );
    }
  }, [addNotification, online, session, visits]);

  const flushPendingVisitChanges = useCallback(async () => {
    if (!session?.token || !online) return;
    if (visitOutboxSyncInFlightRef.current) return;
    visitOutboxSyncInFlightRef.current = true;
    try {
    const queue = await readPendingVisitChanges(session.user.id);
    if (!queue.length) {
      setPendingVisitChanges([]);
      return;
    }
    const remaining = [...queue];
    const syncedLocalIds: number[] = [];
    const syncedVisits: StaffVisit[] = [];
    let synced = 0;
    for (const change of queue) {
      if (change.state === 'conflict') continue;
      let currentChange = change;
      try {
        let response: { data: StaffVisit };
        if (currentChange.kind === 'create') {
          const payload = visitPayloadForApi(currentChange.payload);
          const created = await apiRequest<{ data: StaffVisit }>(
              `/staff/reports/${change.reportId}/visits`,
              session.token,
              {
                method: 'POST',
                body: JSON.stringify({
                  scheduledAt: payload.scheduledAt,
                  visitFindings: payload.visitFindings,
                  checkings: payload.checkings,
                  cropCharacteristics: payload.cropCharacteristics,
                }),
              },
            );
          response = created;
          if (currentChange.payload.status !== 'scheduled') {
            currentChange = {
              ...currentChange,
              kind: 'update',
              visitId: created.data.id,
              expectedUpdatedAt: created.data.updated_at,
              baseVisit: created.data,
              localVisit: {
                ...currentChange.localVisit,
                id: created.data.id,
                sync_state: 'pending',
              },
            };
            const index = remaining.findIndex(item => item.id === change.id);
            if (index >= 0) remaining[index] = currentChange;
            await savePendingVisitChanges(session.user.id, remaining);
            setPendingVisitChanges(remaining);
            response = await apiRequest<{ data: StaffVisit }>(
              `/staff/visits/${created.data.id}`,
              session.token,
              {
                method: 'PUT',
                body: JSON.stringify({
                  ...visitPayloadForApi(currentChange.payload),
                  expectedUpdatedAt: currentChange.expectedUpdatedAt,
                }),
              },
            );
          }
        } else {
          response = await apiRequest<{ data: StaffVisit }>(
            `/staff/visits/${currentChange.visitId}`,
            session.token,
            {
              method: 'PUT',
              body: JSON.stringify({
                ...visitPayloadForApi(currentChange.payload),
                expectedUpdatedAt: currentChange.expectedUpdatedAt,
              }),
            },
          );
        }
        remaining.splice(remaining.findIndex(item => item.id === change.id), 1);
        syncedLocalIds.push(change.localVisit.id);
        syncedVisits.push(response.data);
        synced += 1;
      } catch (error) {
        if (!(error instanceof ApiError)) break;
        if (error.status === 0 || error.status >= 500) break;

        let remoteVisit = error.payload?.data as StaffVisit | undefined;
        if (error.code === 'active_visit_exists' && !remoteVisit) {
          try {
            const current = await apiRequest<ApiPage<StaffVisit>>(
              '/staff/visits?status=scheduled&page=1&pageSize=50',
              session.token,
            );
            remoteVisit = current.data.find(item => item.report_id === change.reportId);
          } catch {
            // Keep the conflict visible even if the current server version cannot be loaded.
          }
        }
        const index = remaining.findIndex(item => item.id === change.id);
        if (index >= 0) {
          remaining[index] = {
            ...currentChange,
            state: 'conflict',
            conflictMessage: error.message,
            remoteVisit: remoteVisit || null,
            localVisit: { ...currentChange.localVisit, sync_state: 'conflict' },
          };
        }
      }
    }
    await savePendingVisitChanges(session.user.id, remaining);
    setPendingVisitChanges(remaining);
    setVisits(current =>
      withPendingVisits(
        [
          ...current.filter(visit =>
            !syncedLocalIds.includes(visit.id) &&
            !syncedVisits.some(saved => saved.id === visit.id),
          ),
          ...syncedVisits,
        ],
        remaining,
      ),
    );
    if (synced) {
      addNotification(
        'Offline visits synced',
        `${synced} visit change${synced === 1 ? '' : 's'} saved to the RSSI workspace.`,
      );
      showNotice(
        `${synced} offline visit change${synced === 1 ? '' : 's'} synced.`,
        'success',
      );
    }
    } finally {
      visitOutboxSyncInFlightRef.current = false;
    }
  }, [addNotification, online, session, showNotice]);

  const refreshData = useCallback(
    async (showSpinner = true) => {
      if (!session?.token || refreshInFlightRef.current) return;
      refreshInFlightRef.current = true;
      if (showSpinner) setRefreshing(true);
      try {
        const failedRequests: string[] = [];
        const describeFailure = (label: string, reason: unknown) => {
          if (reason instanceof ApiError) {
            if (reason.status >= 500) {
              return `${label}: ${reason.message}`;
            }
            return reason.status
              ? `${label} (HTTP ${reason.status}): ${reason.message}`
              : `${label}: ${reason.message}`;
          }
          return `${label}: ${
            reason instanceof Error ? reason.message : 'request failed'
          }`;
        };
        const token = session.token;
        await flushPendingReviews();
        await flushPendingVisitChanges();
        const tasks = await Promise.allSettled([
          apiRequest<ApiPage<FieldReport>>(
            '/staff/reports?page=1&pageSize=50',
            token,
          ),
          apiRequest<ApiPage<FieldReport>>(
            '/staff/reports?status=For%20verification&page=1&pageSize=1',
            token,
          ),
          apiRequest<ApiPage<Farmer>>(
            '/staff/farmers?page=1&pageSize=50',
            token,
          ),
          apiRequest<{
            data: StaffMapLocation[];
            meta: { total_reports: number; location_count: number };
          }>('/staff/map-locations', token),
          apiRequest<ApiPage<StaffVisit>>(
            '/staff/visits?page=1&pageSize=50',
            token,
          ),
        ]);
        let unauthorized = false;
        const reportResult = tasks[0];
        if (reportResult.status === 'fulfilled') {
          const freshReports = reportResult.value.data || [];
          setNotifications(current => {
            let changed = false;
            const linked = current.map(item => {
              if (item.reportId) return item;
              const report = freshReports.find(candidate =>
                item.message.includes(candidate.code),
              );
              if (!report) return item;
              changed = true;
              return { ...item, reportId: report.id };
            });
            if (changed && session)
              void saveNotifications(session.user.id, linked);
            return linked;
          });
          setReports(freshReports);
          setReportTotal(
            reportResult.value.meta?.total ?? reportResult.value.data.length,
          );
          setReportPage(reportResult.value.meta?.page ?? 1);
          const activeReport = selectedReportRef.current;
          let refreshedReport = activeReport
            ? freshReports.find(item => item.id === activeReport.id)
            : undefined;
          if (activeReport && !refreshedReport) {
            try {
              refreshedReport = (
                await apiRequest<{ data: FieldReport }>(
                  `/staff/reports/${activeReport.id}`,
                  token,
                )
              ).data;
            } catch {
              // Keep the list refresh usable if the selected detail is unavailable.
            }
          }
          if (activeReport && refreshedReport) {
            const currentReview = reviewRef.current;
            const previousReview = reviewFromReport(activeReport);
            const reviewIsUnedited =
              currentReview !== null &&
              currentReview.verificationStatus ===
                previousReview.verificationStatus &&
              currentReview.sraSeverity === previousReview.sraSeverity &&
              currentReview.assessmentRationale ===
                previousReview.assessmentRationale &&
              currentReview.reviewerNote === previousReview.reviewerNote &&
              currentReview.followUpAt === previousReview.followUpAt &&
              currentReview.plantHeightCm === previousReview.plantHeightCm &&
              currentReview.leavesPerStalk === previousReview.leavesPerStalk &&
              currentReview.leafLengthCm === previousReview.leafLengthCm &&
              currentReview.leafWidthCm === previousReview.leafWidthCm &&
              currentReview.tillerCount === previousReview.tillerCount;
            if (reviewIsUnedited) setReview(reviewFromReport(refreshedReport));
            setSelectedReport(refreshedReport);
          }
        } else {
          failedRequests.push(
            describeFailure(
              'GET /staff/reports?page=1&pageSize=20',
              reportResult.reason,
            ),
          );
          unauthorized ||=
            reportResult.reason instanceof ApiError &&
            reportResult.reason.status === 401;
        }
        const pendingResult = tasks[1];
        if (pendingResult.status === 'fulfilled')
          setPendingTotal(pendingResult.value.meta?.total ?? 0);
        else {
          failedRequests.push(
            describeFailure(
              'GET /staff/reports?status=For%20verification&page=1&pageSize=1',
              pendingResult.reason,
            ),
          );
          unauthorized ||=
            pendingResult.reason instanceof ApiError &&
            pendingResult.reason.status === 401;
        }
        const farmerResult = tasks[2];
        if (farmerResult.status === 'fulfilled') {
          setFarmers(farmerResult.value.data || []);
          setFarmerTotal(
            farmerResult.value.meta?.total ?? farmerResult.value.data.length,
          );
          setFarmerPage(farmerResult.value.meta?.page ?? 1);
          if (selectedFarmer) {
            const refreshed = farmerResult.value.data.find(
              item => item.id === selectedFarmer.id,
            );
            if (refreshed) setSelectedFarmer(refreshed);
          }
        } else {
          failedRequests.push(
            describeFailure(
              'GET /staff/farmers?page=1&pageSize=20',
              farmerResult.reason,
            ),
          );
          unauthorized ||=
            farmerResult.reason instanceof ApiError &&
            farmerResult.reason.status === 401;
        }
        const mapResult = tasks[3];
        if (mapResult.status === 'fulfilled') {
          setMapLocations(mapResult.value.data || []);
          setMapReportTotal(
            mapResult.value.meta?.total_reports ??
              (mapResult.value.data || []).reduce(
                (total, location) => total + location.report_count,
                0,
              ),
          );
        } else {
          failedRequests.push(
            describeFailure('GET /staff/map-locations', mapResult.reason),
          );
          unauthorized ||=
            mapResult.reason instanceof ApiError &&
            mapResult.reason.status === 401;
        }
        const visitResult = tasks[4];
        if (visitResult.status === 'fulfilled') {
          const latestVisits = visitResult.value.data || [];
          const queuedVisits = await readPendingVisitChanges(session.user.id);
          setPendingVisitChanges(queuedVisits);
          setVisits(withPendingVisits(latestVisits, queuedVisits));
          setVisitTotal(
            (visitResult.value.meta?.total ?? visitResult.value.data.length) +
              queuedVisits.filter(item => item.kind === 'create').length,
          );
          setVisitPage(visitResult.value.meta?.page ?? 1);
        } else {
          failedRequests.push(
            describeFailure(
              'GET /staff/visits?page=1&pageSize=20',
              visitResult.reason,
            ),
          );
          unauthorized ||=
            visitResult.reason instanceof ApiError &&
            visitResult.reason.status === 401;
        }
        if (unauthorized) {
          showNotice('Your session expired. Please sign in again.', 'error');
          await signOut(false);
        } else if (failedRequests.length && online) {
          showNotice(`Refresh failed: ${failedRequests.join(' · ')}`, 'error');
        } else if (!failedRequests.length) {
          setNotice('');
        }
      } finally {
        refreshInFlightRef.current = false;
        if (showSpinner) setRefreshing(false);
      }
    },
    [
      flushPendingReviews,
      flushPendingVisitChanges,
      online,
      addNotification,
      selectedFarmer,
      selectedReport,
      session,
      showNotice,
      signOut,
    ],
  );
  refreshRef.current = refreshData;

  const resolvePendingVisitChange = useCallback(
    async (changeId: string, choice: 'keep_local' | 'use_server') => {
      if (!session) return;
      const queue = await readPendingVisitChanges(session.user.id);
      const change = queue.find(item => item.id === changeId);
      if (!change) return;
      if (choice === 'keep_local' && !change.remoteVisit) {
        showNotice('Load the current server visit before keeping these changes.', 'error');
        return;
      }

      let next = queue.filter(item => item.id !== changeId);
      let replacement: StaffVisit | null = null;
      if (choice === 'keep_local') {
        const remote = change.remoteVisit as StaffVisit;
        const rebased: PendingVisitChange = {
          ...change,
          kind: 'update',
          visitId: remote.id,
          expectedUpdatedAt: remote.updated_at,
          baseVisit: remote,
          localVisit: {
            ...change.localVisit,
            id: remote.id,
            sync_state: 'pending',
          },
          state: 'pending',
          conflictMessage: undefined,
          remoteVisit: null,
          savedAt: new Date().toISOString(),
        };
        next = [...next, rebased];
        replacement = rebased.localVisit;
      } else {
        replacement = change.remoteVisit || change.baseVisit || null;
      }

      await savePendingVisitChanges(session.user.id, next);
      setPendingVisitChanges(next);
      setVisits(current => {
        const cleaned = current.filter(
          visit => visit.id !== change.localVisit.id &&
            (change.visitId === null || visit.id !== change.visitId),
        );
        return withPendingVisits(
          replacement ? [replacement, ...cleaned] : cleaned,
          next,
        );
      });
      if (choice === 'keep_local') {
        showNotice('Your version is queued to sync against the current server visit.', 'info');
        if (online) await refreshData(false);
      } else {
        showNotice('The server version is now shown on this device.', 'success');
        if (online) await refreshData(false);
      }
    },
    [online, refreshData, session, showNotice],
  );

  const requestAutomaticRefresh = useCallback(() => {
    if (!session?.token) return;
    const now = Date.now();
    // Network and foreground events often arrive together. Avoid repeating the
    // same full workspace refresh when the data was just fetched.
    if (now - lastAutomaticRefreshAtRef.current < 15_000) return;
    lastAutomaticRefreshAtRef.current = now;
    void refreshRef.current(false);
  }, [session?.token]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const stored = await readSession().catch(() => null);
      if (!alive) return;
      if (!stored) {
        setBooting(false);
        return;
      }
      setSession(stored);
      await hydrateLocalData(stored);
      if (!alive) return;
      // Show the cached workspace immediately; validate the saved session
      // without holding the initial screen behind a network round trip.
      setBooting(false);
      try {
        const me = await apiRequest<{
          account_type: string;
          user: StaffProfile;
          scopes: string[];
        }>('/me', stored.token);
        if (me.account_type !== 'staff')
          throw new ApiError(403, 'forbidden', 'This is not a staff account.');
        const valid = { ...stored, user: me.user, scopes: me.scopes };
        await saveSession(valid);
        if (alive) setSession(valid);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await clearSession();
          if (alive) setSession(null);
        } else if (error instanceof ApiError && error.status === 403) {
          await clearSession();
          if (alive) {
            setSession(null);
            setAuthError(error.message);
          }
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [hydrateLocalData]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const connected = Boolean(
        state.isConnected && state.isInternetReachable !== false,
      );
      setOnline(connected);
      if (connected) requestAutomaticRefresh();
    });
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') requestAutomaticRefresh();
    });
    return () => {
      unsubscribe();
      appState.remove();
    };
  }, [requestAutomaticRefresh]);

  useEffect(() => {
    if (session?.token && online) requestAutomaticRefresh();
  }, [session?.token, online, requestAutomaticRefresh]);

  useEffect(() => {
    if (!session || !cacheReady) return;
    void preparePhoneNotifications().catch(() => undefined);
  }, [cacheReady, session?.user.id]);

  useEffect(() => {
    if (!session || !cacheReady) return;
    void syncVisitReminders(visits).catch(() => undefined);
  }, [cacheReady, session?.user.id, visits]);

  useEffect(() => {
    if (!session?.token) return;
    let pollInFlight = false;
    const pollReports = async () => {
      if (
        !online ||
        refreshInFlightRef.current ||
        AppState.currentState !== 'active' ||
        pollInFlight
      )
        return;
      pollInFlight = true;
      try {
        await flushPendingVisitChanges();
        const [
          reportsResponse,
          pendingResponse,
          mapResponse,
          visitsResponse,
        ] = await Promise.all([
          apiRequest<ApiPage<FieldReport>>(
            '/staff/reports?page=1&pageSize=50',
            session.token,
          ),
          apiRequest<ApiPage<FieldReport>>(
            '/staff/reports?status=For%20verification&page=1&pageSize=1',
            session.token,
          ),
          apiRequest<{
            data: StaffMapLocation[];
            meta: {total_reports: number; location_count: number};
          }>('/staff/map-locations', session.token),
          apiRequest<ApiPage<StaffVisit>>(
            '/staff/visits?page=1&pageSize=50',
            session.token,
          ),
        ]);
        const latest = reportsResponse.data || [];
        const activeReport = selectedReportRef.current;
        let updatedActiveReport = activeReport
          ? latest.find(report => report.id === activeReport.id)
          : undefined;
        if (activeReport && !updatedActiveReport) {
          try {
            updatedActiveReport = (await apiRequest<{data: FieldReport}>(
              `/staff/reports/${activeReport.id}`,
              session.token,
            )).data;
          } catch {
            // The report list remains usable if a selected detail cannot refresh.
          }
        }
        try {
          if (notificationCursorUserRef.current !== session.user.id) {
            notificationEventCursorRef.current = await readNotificationEventCursor(session.user.id);
            notificationCursorUserRef.current = session.user.id;
          }
          const currentCursor = notificationEventCursorRef.current;
          const path = currentCursor === null
            ? '/staff/notifications'
            : `/staff/notifications?afterId=${encodeURIComponent(String(currentCursor))}`;
          const feed = await apiRequest<{
            cursor: number;
            events: Array<{ id: number; title: string; message: string; reportId: number }>;
            overdueVisits: Array<{ id: number; reportId: number; title: string; message: string; scheduledAt: string }>;
          }>(path, session.token);
          if (currentCursor !== null) {
            for (const event of feed.events || []) {
              const key = `event-${event.id}`;
              if (addNotification(event.title, event.message, event.reportId, key)) {
                void notifyStaffUpdate(key, event.title, event.message, event.reportId).catch(() => undefined);
              }
            }
          }
          for (const visit of feed.overdueVisits || []) {
            const key = `overdue-visit-${visit.id}-${visit.scheduledAt.slice(0, 10)}`;
            if (addNotification(visit.title, visit.message, visit.reportId, key)) {
              void notifyStaffUpdate(key, visit.title, visit.message, visit.reportId).catch(() => undefined);
            }
          }
          const nextCursor = Number(feed.cursor);
          if (Number.isSafeInteger(nextCursor) && nextCursor >= 0) {
            notificationEventCursorRef.current = nextCursor;
            await saveNotificationEventCursor(session.user.id, nextCursor);
          }
        } catch {
          // Update notifications are best-effort and never block report refresh.
        }
        setReports(latest);
        setReportTotal(reportsResponse.meta?.total ?? latest.length);
        setPendingTotal(pendingResponse.meta?.total ?? 0);
        if (activeReport && updatedActiveReport) {
          const currentReview = reviewRef.current;
          const previousReview = reviewFromReport(activeReport);
          const reviewIsUnedited = currentReview !== null &&
            currentReview.verificationStatus === previousReview.verificationStatus &&
            currentReview.sraSeverity === previousReview.sraSeverity &&
            currentReview.assessmentRationale === previousReview.assessmentRationale &&
            currentReview.reviewerNote === previousReview.reviewerNote &&
            currentReview.followUpAt === previousReview.followUpAt &&
            currentReview.plantHeightCm === previousReview.plantHeightCm &&
            currentReview.leavesPerStalk === previousReview.leavesPerStalk &&
            currentReview.leafLengthCm === previousReview.leafLengthCm &&
            currentReview.leafWidthCm === previousReview.leafWidthCm &&
            currentReview.tillerCount === previousReview.tillerCount;
          if (reviewIsUnedited) setReview(reviewFromReport(updatedActiveReport));
          setSelectedReport(updatedActiveReport);
        }
        setMapLocations(mapResponse.data || []);
        setMapReportTotal(
          mapResponse.meta?.total_reports ??
            (mapResponse.data || []).reduce(
              (total, location) => total + location.report_count,
              0,
            ),
        );
        const queuedVisits = await readPendingVisitChanges(session.user.id);
        setPendingVisitChanges(queuedVisits);
        setVisits(withPendingVisits(visitsResponse.data || [], queuedVisits));
        setVisitTotal(
          (visitsResponse.meta?.total ?? visitsResponse.data.length) +
            queuedVisits.filter(item => item.kind === 'create').length,
        );
        setVisitPage(visitsResponse.meta?.page ?? 1);
      } catch {
        // Normal refresh handles visible errors; polling stays quiet.
      } finally {
        pollInFlight = false;
      }
    };
    const timer = setInterval(() => void pollReports(), 30_000);
    return () => clearInterval(timer);
  }, [addNotification, flushPendingVisitChanges, online, session?.token, session?.user.id]);

  useEffect(() => {
    if (!session || !cacheReady) return;
    void saveWorkspace(session.user.id, {
      reports,
      farmers,
      mapLocations,
      mapReportTotal,
      visits,
      visitTotal,
      visitPage,
      reportTotal,
      farmerTotal,
      pendingTotal,
      reportPage,
      farmerPage,
    });
  }, [
    cacheReady,
    farmers,
    mapLocations,
    mapReportTotal,
    visits,
    visitTotal,
    visitPage,
    farmerPage,
    farmerTotal,
    pendingTotal,
    reportPage,
    reportTotal,
    reports,
    session,
  ]);

  const login = async () => {
    if (!email.trim() || !password) {
      setAuthError('Enter your work email and password.');
      return;
    }
    setAuthBusy(true);
    setAuthError('');
    try {
      const result = await staffLogin(email, password);
      if (result.account_type !== 'staff')
        throw new ApiError(
          403,
          'forbidden',
          'Only SRA staff can use this app.',
        );
      const next: StaffSession = {
        token: result.access_token,
        user: result.user,
        scopes: result.scopes || [],
      };
      await hydrateLocalData(next);
      await saveSession(next);
      setSession(next);
      setPassword('');
      setAuthError('');
      setTab('home');
      showNotice(`Welcome, ${result.user.name}.`, 'success');
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : 'Could not sign in. Try again.',
      );
    } finally {
      setAuthBusy(false);
    }
  };

  const {
    openReport,
    openFarmer,
    submitReview,
    loadMore,
    createVisit,
    updateVisit,
    filteredReports,
    filteredFarmers,
    canReview,
    severeTotal,
  } = useStaffRecordActions({
    session,
    online,
    setOnline,
    reports,
    setReports,
    farmers,
    setFarmers,
    visits,
    setVisits,
    pendingVisitChanges,
    setPendingVisitChanges,
    selectedReport,
    setSelectedReport,
    selectedFarmer,
    setSelectedFarmer,
    setBusy,
    review,
    setReview,
    reviewBusy,
    setReviewBusy,
    photoFailed,
    setPhotoFailed,
    setPendingReviewCount,
    loadingMore,
    setLoadingMore,
    refreshing,
    reportTotal,
    setReportTotal,
    reportPage,
    setReportPage,
    farmerTotal,
    setFarmerTotal,
    farmerPage,
    setFarmerPage,
    visitTotal,
    setVisitTotal,
    visitPage,
    setVisitPage,
    setVisitBusy,
    listFilter,
    search,
    showNotice,
    addNotification,
    refreshData,
  });

  baseOpenReportRef.current = openReport;
  const openReportAndClearNotification = useCallback(
    async (reportOrId: FieldReport | number) => {
      const reportId =
        typeof reportOrId === 'number' ? reportOrId : reportOrId.id;
      const opened = await baseOpenReportRef.current(reportOrId);
      if (!opened) return false;
      await clearReportPhoneNotifications(reportId).catch(() => undefined);
      setNotifications(current => {
        const next = current.filter(item => item.reportId !== reportId);
        if (session) void saveNotifications(session.user.id, next);
        return next;
      });
      return true;
    },
    [session],
  );

  useEffect(() => {
    if (!session || !cacheReady) return;
    const openFromPhoneNotification = async (reportId: number) => {
      if (handledNotificationReportsRef.current.has(reportId)) return false;
      handledNotificationReportsRef.current.add(reportId);
      const opened = await openReportAndClearNotification(reportId);
      if (opened) {
        await AsyncStorage.removeItem(pendingNotificationKey).catch(
          () => undefined,
        );
      } else {
        handledNotificationReportsRef.current.delete(reportId);
      }
      if (opened) {
        setTimeout(
          () => handledNotificationReportsRef.current.delete(reportId),
          2000,
        );
      }
      return opened;
    };
    const unsubscribe = listenForReportNotificationPress(reportId => {
      void openFromPhoneNotification(reportId);
    });
    const readPendingOpen = async () => {
      const value = await AsyncStorage.getItem(pendingNotificationKey).catch(
        () => null,
      );
      const reportId = Number(value);
      if (Number.isInteger(reportId) && reportId > 0) {
        await openFromPhoneNotification(reportId);
      }
    };
    void readPendingOpen();
    const appStateSubscription = AppState.addEventListener('change', state => {
      if (state === 'active') void readPendingOpen();
    });
    return () => {
      unsubscribe();
      appStateSubscription.remove();
    };
  }, [cacheReady, openReportAndClearNotification, session?.user.id]);

  return {
    session,
    booting,
    email,
    setEmail,
    password,
    setPassword,
    authBusy,
    authError,
    login,
    tab,
    setTab,
    reports,
    farmers,
    mapLocations,
    mapReportTotal,
    pendingTotal,
    reportTotal,
    farmerTotal,
    visits,
    visitTotal,
    visitBusy,
    loadingMore,
    selectedReport,
    setSelectedReport,
    selectedFarmer,
    setSelectedFarmer,
    review,
    setReview,
    reviewBusy,
    listFilter,
    setListFilter,
    search,
    setSearch,
    busy,
    refreshing,
    online,
    notice,
    noticeKind,
    setNotice,
    photoFailed,
    setPhotoFailed,
    notificationOpen,
    setNotificationOpen,
    notifications,
    pendingReviewCount,
    markNotificationsRead,
    refreshData,
    signOut,
    updateStaffProfilePhoto,
    openReport: openReportAndClearNotification,
    openFarmer,
    submitReview,
    loadMore,
    createVisit,
    updateVisit,
    pendingVisitChanges,
    resolvePendingVisitChange,
    filteredReports,
    filteredFarmers,
    canReview,
    severeTotal,
  };
}

export type StaffAppController = ReturnType<typeof useStaffAppController>;

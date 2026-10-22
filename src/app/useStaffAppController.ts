import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useStaffRecordActions,
  type LoadMoreKind,
} from './useStaffRecordActions';
import { syncFollowUpVisit } from './followUpVisits';
import { reviewPayload } from './reportReview';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import {
  clearReportPhoneNotifications,
  listenForReportNotificationPress,
  notifyNewReport,
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
  readNotifications,
  readPendingReviews,
  readWorkspace,
  saveNotifications,
  savePendingReviews,
  saveWorkspace,
} from '../offlineStore';

export type Tab =
  | 'home'
  | 'map'
  | 'reports'
  | 'visits'
  | 'farmers'
  | 'settings';

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
  const refreshRef = useRef<() => Promise<void>>(async () => undefined);
  const seenReportIdsRef = useRef<Set<number> | null>(null);
  const baseOpenReportRef = useRef<(report: FieldReport | number) => Promise<boolean>>(
    async () => false,
  );
  const handledNotificationReportsRef = useRef(new Set<number>());
  const pendingNotificationKey = 'rssi_staff_pending_report_open';

  const hydrateLocalData = useCallback(async (active: StaffSession) => {
    const [snapshot, queue, savedNotifications] = await Promise.all([
      readWorkspace(active.user.id),
      readPendingReviews(active.user.id),
      readNotifications(active.user.id),
    ]);
    if (snapshot) {
      setReports(snapshot.reports || []);
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
      setVisits(snapshot.visits || []);
      setVisitTotal(snapshot.visitTotal || 0);
      setVisitPage(snapshot.visitPage || 1);
      setReportTotal(snapshot.reportTotal || 0);
      setFarmerTotal(snapshot.farmerTotal || 0);
      setPendingTotal(snapshot.pendingTotal || 0);
      setReportPage(snapshot.reportPage || 1);
      setFarmerPage(snapshot.farmerPage || 1);
    }
    setPendingReviewCount(queue.length);
    const reportNotifications = savedNotifications.filter(
      item =>
        item.title !== 'Connection restored' &&
        item.title !== 'You are offline',
    ).map(item => {
      if (item.reportId) return item;
      const report = snapshot?.reports?.find(candidate =>
        item.message.includes(candidate.code),
      );
      return report ? { ...item, reportId: report.id } : item;
    });
    setNotifications(reportNotifications);
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
    (title: string, message: string, reportId?: number) => {
      if (!session) return;
      const item: AppNotification = {
        id: `${Date.now()}-${Math.random()}`,
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
      setNotice(message);
      setNoticeKind(kind);
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
        const result = await apiRequest<{ data: FieldReport }>(
          `/staff/reports/${item.reportId}/review`,
          session.token,
          { method: 'PUT', body: JSON.stringify(reviewPayload(item.review)) },
        );
        setReports(current =>
          current.map(report =>
            report.id === item.reportId ? result.data : report,
          ),
        );
        setSelectedReport(current =>
          current?.id === item.reportId ? result.data : current,
        );
        if (item.review.followUpAt || item.previousFollowUpAt) {
          const followUp = await syncFollowUpVisit(
            item.reportId,
            item.review.followUpAt,
            session.token,
            visits,
          );
          if (followUp.visit) {
            setVisits(current =>
              followUp.created
                ? [followUp.visit as StaffVisit, ...current]
                : current.map(visit =>
                    visit.id === followUp.visit?.id ? followUp.visit : visit,
                  ),
            );
            if (followUp.created) setVisitTotal(total => total + 1);
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

  const refreshData = useCallback(async () => {
    if (!session?.token) return;
    setRefreshing(true);
    const failedRequests: string[] = [];
    const describeFailure = (label: string, reason: unknown) => {
      if (reason instanceof ApiError) {
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
    const tasks = await Promise.allSettled([
      apiRequest<ApiPage<FieldReport>>(
        '/staff/reports?page=1&pageSize=50',
        token,
      ),
      apiRequest<ApiPage<FieldReport>>(
        '/staff/reports?status=For%20verification&page=1&pageSize=1',
        token,
      ),
      apiRequest<ApiPage<Farmer>>('/staff/farmers?page=1&pageSize=50', token),
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
      const currentIds = new Set(freshReports.map(item => item.id));
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
        if (changed && session) void saveNotifications(session.user.id, linked);
        return linked;
      });
      const previouslySeen = seenReportIdsRef.current;
      if (previouslySeen) {
        freshReports
          .filter(item => !previouslySeen.has(item.id))
          .forEach(item => {
            void notifyNewReport(item.code, item.id).catch(() => undefined);
            addNotification(
              'New field report',
              `${item.code} has been submitted and is ready to review.`,
              item.id,
            );
          });
      }
      seenReportIdsRef.current = currentIds;
      setReports(freshReports);
      setReportTotal(
        reportResult.value.meta?.total ?? reportResult.value.data.length,
      );
      setReportPage(reportResult.value.meta?.page ?? 1);
      if (selectedReport) {
        const refreshed = reportResult.value.data.find(
          item => item.id === selectedReport.id,
        );
        if (refreshed) setSelectedReport(refreshed);
      }
    } else {
      failedRequests.push(describeFailure('Reports', reportResult.reason));
      unauthorized ||=
        reportResult.reason instanceof ApiError &&
        reportResult.reason.status === 401;
    }
    const pendingResult = tasks[1];
    if (pendingResult.status === 'fulfilled')
      setPendingTotal(pendingResult.value.meta?.total ?? 0);
    else {
      failedRequests.push(
        describeFailure('Pending report count', pendingResult.reason),
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
      failedRequests.push(describeFailure('Farmers', farmerResult.reason));
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
      failedRequests.push(describeFailure('Map locations', mapResult.reason));
      unauthorized ||=
        mapResult.reason instanceof ApiError && mapResult.reason.status === 401;
    }
    const visitResult = tasks[4];
    if (visitResult.status === 'fulfilled') {
      const latestVisits = visitResult.value.data || [];
      setVisits(latestVisits);
      setVisitTotal(
        visitResult.value.meta?.total ?? visitResult.value.data.length,
      );
      setVisitPage(visitResult.value.meta?.page ?? 1);
    } else {
      failedRequests.push(describeFailure('Visits', visitResult.reason));
      unauthorized ||=
        visitResult.reason instanceof ApiError &&
        visitResult.reason.status === 401;
    }
    if (unauthorized) {
      showNotice('Your session expired. Please sign in again.', 'error');
      await signOut(false);
    } else if (failedRequests.length && online) {
      const details = failedRequests.slice(0, 2).join(' · ');
      const remaining = failedRequests.length - 2;
      showNotice(
        `Refresh failed: ${details}${
          remaining > 0 ? ` · and ${remaining} more request(s)` : ''
        }`,
        'error',
      );
    } else if (!failedRequests.length) {
      setNotice('');
    }
    setRefreshing(false);
  }, [
    flushPendingReviews,
    online,
    addNotification,
    selectedFarmer,
    selectedReport,
    session,
    showNotice,
    signOut,
  ]);
  refreshRef.current = refreshData;

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
      } finally {
        if (alive) setBooting(false);
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
      if (connected) void refreshRef.current();
    });
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') void refreshRef.current();
    });
    return () => {
      unsubscribe();
      appState.remove();
    };
  }, []);

  useEffect(() => {
    if (session?.token && online) void refreshRef.current();
  }, [session?.token, online]);

  useEffect(() => {
    if (!session || !cacheReady) return;
    void preparePhoneNotifications().catch(() => undefined);
  }, [cacheReady, session?.user.id]);

  useEffect(() => {
    if (!session || !cacheReady) return;
    void syncVisitReminders(visits).catch(() => undefined);
  }, [cacheReady, session?.user.id, visits]);

  useEffect(() => {
    if (!session?.token) {
      seenReportIdsRef.current = null;
      return;
    }
    const pollReports = async () => {
      if (!online || AppState.currentState !== 'active') return;
      try {
        const response = await apiRequest<ApiPage<FieldReport>>(
          '/staff/reports?page=1&pageSize=50',
          session.token,
        );
        const latest = response.data || [];
        const previous = seenReportIdsRef.current;
        if (previous) {
          latest
            .filter(report => !previous.has(report.id))
            .forEach(report => {
              void notifyNewReport(report.code, report.id).catch(() => undefined);
              addNotification(
                'New field report',
                `${report.code} has been submitted and is ready to review.`,
                report.id,
              );
            });
        }
        seenReportIdsRef.current = new Set(latest.map(report => report.id));
        setReports(latest);
        setReportTotal(response.meta?.total ?? latest.length);
      } catch {
        // Normal refresh handles visible errors; polling stays quiet.
      }
    };
    const timer = setInterval(() => void pollReports(), 120_000);
    return () => clearInterval(timer);
  }, [addNotification, online, session?.token]);

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
      const reportId = typeof reportOrId === 'number' ? reportOrId : reportOrId.id;
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
        await AsyncStorage.removeItem(pendingNotificationKey).catch(() => undefined);
      } else {
        handledNotificationReportsRef.current.delete(reportId);
      }
      if (opened) {
        setTimeout(() => handledNotificationReportsRef.current.delete(reportId), 2000);
      }
      return opened;
    };
    const unsubscribe = listenForReportNotificationPress(reportId => {
      void openFromPhoneNotification(reportId);
    });
    const readPendingOpen = async () => {
      const value = await AsyncStorage.getItem(pendingNotificationKey).catch(() => null);
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
    filteredReports,
    filteredFarmers,
    canReview,
    severeTotal,
  };
}

export type StaffAppController = ReturnType<typeof useStaffAppController>;

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  View,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { ApiError, apiRequest, staffLogin } from './api';
import { clearSession, readSession, saveSession } from './session';
import { useTheme } from './theme';
import {
  ApiPage,
  Farmer,
  FieldReport,
  StaffMapLocation,
  StaffProfile,
  StaffSession,
  ReviewForm,
} from './types';
import makeStyles from './styles';
import { LoginScreen } from './screens/LoginScreen';
import { Dashboard } from './screens/DashboardScreen';
import { ReportDetail } from './screens/ReportDetailScreen';
import { FarmerDetail } from './screens/FarmersScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { ReportsScreen, FarmersScreen } from './screens/ReportsScreen';
import { NotificationsPanel } from './components/NotificationsPanel';
import { MapScreen } from './screens/MapScreen';
import { VisitsScreen } from './screens/VisitsScreen';
import {
  AppNotification,
  PendingReview,
  readNotifications,
  readPendingReviews,
  readWorkspace,
  saveNotifications,
  savePendingReviews,
  saveWorkspace,
} from './offlineStore';

type Tab = 'home' | 'map' | 'reports' | 'visits' | 'farmers' | 'settings';

function reviewFromReport(report: FieldReport): ReviewForm {
  return {
    verificationStatus: report.verification_status || 'For verification',
    sraSeverity: report.sra_severity || 'Not assessed',
    assessmentRationale: report.assessment_rationale || '',
    reviewerNote: report.reviewer_note || '',
    followUpAt: report.follow_up_at || '',
  };
}

function reviewPayload(review: ReviewForm) {
  return {
    verificationStatus: review.verificationStatus,
    sraSeverity: review.sraSeverity || 'Not assessed',
    assessmentRationale: review.assessmentRationale.trim() || null,
    reviewerNote: review.reviewerNote.trim() || null,
    followUpAt: review.followUpAt.trim() || null,
  };
}

export default function StaffApp() {
  const { colors, mode, resolved, setMode } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
  const [loadingMore, setLoadingMore] = useState<'reports' | 'farmers' | null>(
    null,
  );
  const [selectedReport, setSelectedReport] = useState<FieldReport | null>(
    null,
  );
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
  const [review, setReview] = useState<ReviewForm | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [listFilter, setListFilter] = useState('All');
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
  const requestErrorRef = useRef(false);

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
    );
    setNotifications(reportNotifications);
    if (reportNotifications.length !== savedNotifications.length) {
      void saveNotifications(active.user.id, reportNotifications);
    }
    setCacheReady(true);
  }, []);

  const addNotification = useCallback(
    (title: string, message: string) => {
      if (!session) return;
      const item: AppNotification = {
        id: `${Date.now()}-${Math.random()}`,
        title,
        message,
        createdAt: new Date().toISOString(),
        read: false,
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
      setSelectedReport(null);
      setSelectedFarmer(null);
      setPassword('');
      setTab('home');
      setCacheReady(false);
    },
    [session],
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
  }, [addNotification, online, session]);

  const refreshData = useCallback(async () => {
    if (!session?.token) return;
    setRefreshing(true);
    requestErrorRef.current = false;
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
    ]);
    let unauthorized = false;
    const reportResult = tasks[0];
    if (reportResult.status === 'fulfilled') {
      setReports(reportResult.value.data || []);
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
      requestErrorRef.current = true;
      unauthorized ||=
        reportResult.reason instanceof ApiError &&
        reportResult.reason.status === 401;
    }
    const pendingResult = tasks[1];
    if (pendingResult.status === 'fulfilled')
      setPendingTotal(pendingResult.value.meta?.total ?? 0);
    else {
      requestErrorRef.current = true;
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
      requestErrorRef.current = true;
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
      requestErrorRef.current = true;
      unauthorized ||=
        mapResult.reason instanceof ApiError && mapResult.reason.status === 401;
    }
    if (unauthorized) {
      showNotice('Your session expired. Please sign in again.', 'error');
      await signOut(false);
    } else if (requestErrorRef.current && online) {
      showNotice(
        'Some workspace data could not be refreshed. Pull down to retry.',
        'error',
      );
    } else if (!requestErrorRef.current) {
      setNotice('');
    }
    setRefreshing(false);
  }, [
    flushPendingReviews,
    online,
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
    void saveWorkspace(session.user.id, {
      reports,
      farmers,
      mapLocations,
      mapReportTotal,
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

  const openReport = async (reportOrId: FieldReport | number) => {
    if (!session) return;
    const reportId =
      typeof reportOrId === 'number' ? reportOrId : reportOrId.id;
    const cachedReport =
      typeof reportOrId === 'number'
        ? reports.find(item => item.id === reportId)
        : reportOrId;
    setBusy(true);
    setSelectedFarmer(null);
    try {
      if (!online) {
        if (!cachedReport) {
          showNotice('Connect to load this report’s full details.', 'info');
          return;
        }
        setSelectedReport(cachedReport);
        setReview(reviewFromReport(cachedReport));
        setPhotoFailed([]);
        return;
      }
      const response = await apiRequest<{ data: FieldReport }>(
        `/staff/reports/${reportId}`,
        session.token,
      );
      setSelectedReport(response.data);
      setReports(items =>
        items.map(item =>
          item.id === response.data.id ? response.data : item,
        ),
      );
      setReview(reviewFromReport(response.data));
      setPhotoFailed([]);
    } catch (error) {
      if (error instanceof ApiError && error.status === 0) {
        setOnline(false);
        if (cachedReport) {
          setSelectedReport(cachedReport);
          setReview(reviewFromReport(cachedReport));
          setPhotoFailed([]);
        } else {
          showNotice('Connect to load this report’s full details.', 'info');
        }
        return;
      }
      showNotice(
        error instanceof Error ? error.message : 'Could not load this report.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  const openFarmer = async (farmer: Farmer) => {
    if (!session) return;
    setBusy(true);
    setSelectedReport(null);
    try {
      if (!online) {
        setSelectedFarmer(farmer);
        return;
      }
      const response = await apiRequest<{ data: Farmer }>(
        `/staff/farmers/${farmer.id}`,
        session.token,
      );
      setSelectedFarmer(response.data);
      setFarmers(items =>
        items.map(item =>
          item.id === response.data.id ? response.data : item,
        ),
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 0) {
        setOnline(false);
        setSelectedFarmer(farmer);
        return;
      }
      showNotice(
        error instanceof Error ? error.message : 'Could not load this farmer.',
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  const queueReviewLocally = async () => {
    if (!session || !selectedReport || !review) return;
    const optimistic: FieldReport = {
      ...selectedReport,
      verification_status: review.verificationStatus,
      sra_severity:
        review.sraSeverity === 'Not assessed' ? null : review.sraSeverity,
      assessment_rationale: review.assessmentRationale,
      reviewer_note: review.reviewerNote,
      follow_up_at: review.followUpAt || null,
    };
    const current = await readPendingReviews(session.user.id);
    const next: PendingReview[] = [
      ...current.filter(item => item.reportId !== selectedReport.id),
      {
        reportId: selectedReport.id,
        review,
        updatedAt: new Date().toISOString(),
      },
    ];
    await savePendingReviews(session.user.id, next);
    setPendingReviewCount(next.length);
    setSelectedReport(optimistic);
    setReports(items =>
      items.map(item => (item.id === optimistic.id ? optimistic : item)),
    );
    addNotification(
      'Review saved on this device',
      `${selectedReport.code} is queued and will sync when you are back online.`,
    );
    showNotice(
      'Review saved on this device. It will sync when you reconnect.',
      'success',
    );
  };

  const submitReview = async () => {
    if (!session || !selectedReport || !review) return;
    if (!session.scopes.includes('reports:review')) {
      showNotice(
        'This staff account can view reports but cannot submit reviews.',
        'error',
      );
      return;
    }
    const followUpAt = review.followUpAt.trim();
    if (followUpAt && !/^\d{4}-\d{2}-\d{2}$/.test(followUpAt)) {
      showNotice('Enter the follow-up date as YYYY-MM-DD.', 'error');
      return;
    }
    if (!online) {
      await queueReviewLocally();
      return;
    }
    setReviewBusy(true);
    try {
      const response = await apiRequest<{ data: FieldReport }>(
        `/staff/reports/${selectedReport.id}/review`,
        session.token,
        {
          method: 'PUT',
          body: JSON.stringify({
            verificationStatus: review.verificationStatus,
            sraSeverity:
              review.sraSeverity === 'Not assessed'
                ? 'Not assessed'
                : review.sraSeverity || null,
            assessmentRationale: review.assessmentRationale.trim() || null,
            reviewerNote: review.reviewerNote.trim() || null,
            followUpAt: followUpAt || null,
          }),
        },
      );
      setSelectedReport(response.data);
      setReports(items =>
        items.map(item =>
          item.id === response.data.id ? response.data : item,
        ),
      );
      setReview({
        verificationStatus: response.data.verification_status,
        sraSeverity: response.data.sra_severity || 'Not assessed',
        assessmentRationale: response.data.assessment_rationale || '',
        reviewerNote: response.data.reviewer_note || '',
        followUpAt: response.data.follow_up_at || '',
      });
      showNotice('Review saved to the RSSI workspace.', 'success');
      void refreshData();
    } catch (error) {
      if (error instanceof ApiError && error.status === 0) {
        setOnline(false);
        await queueReviewLocally();
        return;
      }
      showNotice(
        error instanceof Error ? error.message : 'Review could not be saved.',
        'error',
      );
    } finally {
      setReviewBusy(false);
    }
  };

  const loadMore = async (kind: 'reports' | 'farmers') => {
    if (!session?.token || loadingMore || refreshing) return;
    setLoadingMore(kind);
    const nextPage = kind === 'reports' ? reportPage + 1 : farmerPage + 1;
    try {
      if (kind === 'reports') {
        const response = await apiRequest<ApiPage<FieldReport>>(
          `/staff/reports?page=${nextPage}&pageSize=50`,
          session.token,
        );
        setReports(items => {
          const knownIds = new Set(items.map(item => item.id));
          return [
            ...items,
            ...response.data.filter(item => !knownIds.has(item.id)),
          ];
        });
        setReportTotal(response.meta?.total ?? reportTotal);
        setReportPage(response.meta?.page ?? nextPage);
      } else {
        const response = await apiRequest<ApiPage<Farmer>>(
          `/staff/farmers?page=${nextPage}&pageSize=50`,
          session.token,
        );
        setFarmers(items => {
          const knownIds = new Set(items.map(item => item.id));
          return [
            ...items,
            ...response.data.filter(item => !knownIds.has(item.id)),
          ];
        });
        setFarmerTotal(response.meta?.total ?? farmerTotal);
        setFarmerPage(response.meta?.page ?? nextPage);
      }
    } catch (error) {
      showNotice(
        error instanceof Error ? error.message : 'Could not load more records.',
        'error',
      );
    } finally {
      setLoadingMore(null);
    }
  };

  const filteredReports = useMemo(
    () =>
      reports.filter(report => {
        const matchesFilter =
          listFilter === 'All' || report.verification_status === listFilter;
        const query = search.trim().toLocaleLowerCase();
        const matchesSearch =
          !query ||
          [
            report.code,
            report.property_name,
            report.province,
            report.municipality,
            report.farmer?.name,
          ].some(value => value?.toLocaleLowerCase().includes(query));
        return matchesFilter && matchesSearch;
      }),
    [listFilter, reports, search],
  );
  const filteredFarmers = useMemo(
    () =>
      farmers.filter(farmer => {
        const query = search.trim().toLocaleLowerCase();
        return (
          !query ||
          [
            farmer.name,
            farmer.email,
            farmer.reference,
            ...farmer.properties.map(
              property =>
                `${property.name} ${property.municipality} ${property.province}`,
            ),
          ].some(value => value?.toLocaleLowerCase().includes(query))
        );
      }),
    [farmers, search],
  );

  const canReview = Boolean(session?.scopes.includes('reports:review'));
  const severeTotal = reports.filter(item =>
    ['Severe', 'Highly severe'].includes(item.farmer_severity),
  ).length;

  if (booting)
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <StatusBar
          barStyle={resolved === 'dark' ? 'light-content' : 'dark-content'}
        />
        <ActivityIndicator size="large" color={colors.blue} />
        <Text style={[styles.muted, { marginTop: 14 }]}>
          Opening your staff workspace…
        </Text>
      </SafeAreaView>
    );
  if (!session)
    return (
      <LoginScreen
        styles={styles}
        colors={colors}
        resolved={resolved}
        insets={insets.bottom}
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        busy={authBusy}
        error={authError}
        onLogin={login}
      />
    );

  const pageTitle = selectedReport
    ? selectedReport.code
    : selectedFarmer
    ? selectedFarmer.name
    : (
        {
          home: 'Overview',
          map: 'Map',
          reports: 'Field reports',
          visits: 'Visits',
          farmers: 'Farmers',
          settings: 'Settings',
        } as Record<Tab, string>
      )[tab];
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar
        barStyle={resolved === 'dark' ? 'light-content' : 'dark-content'}
      />
      <View style={styles.topbar}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>R</Text>
            <View style={styles.brandLeaf} />
          </View>
          <View>
            <Text style={styles.brandName}>RSSI</Text>
            <Text style={styles.brandSub}>SRA STAFF WORKSPACE</Text>
          </View>
        </View>
        <View style={styles.topbarRight}>
          <View
            style={[
              styles.onlineDot,
              { backgroundColor: online ? colors.green : colors.amber },
            ]}
          />
          <Text style={styles.connectionLabel}>
            {online ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>
      <View style={styles.pageHeader}>
        {(selectedReport || selectedFarmer || tab === 'settings') && (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setSelectedReport(null);
              setSelectedFarmer(null);
              if (tab === 'settings') setTab('home');
            }}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>‹</Text>
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.pageTitle}>{pageTitle}</Text>
          <Text style={styles.pageSubtitle}>
            {selectedReport
              ? 'Farmer observation · SRA review'
              : selectedFarmer
              ? 'Farmer account and registered farms'
              : tab === 'settings'
              ? 'Personal preferences and account controls'
              : `Hello ${session.user.name.split(' ')[0]} · ${
                  session.user.province_access
                }`}
          </Text>
        </View>
        {!selectedReport && !selectedFarmer && tab !== 'settings' ? (
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open notifications"
              onPress={() => {
                markNotificationsRead();
                setNotificationOpen(true);
              }}
              style={styles.refreshButton}
            >
              <Text style={styles.refreshGlyph}>🔔</Text>
              {notifications.some(item => !item.read) ? (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>
                    {notifications.filter(item => !item.read).length > 9
                      ? '9+'
                      : notifications.filter(item => !item.read).length}
                  </Text>
                </View>
              ) : null}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open profile and settings"
              onPress={() => {
                setSelectedReport(null);
                setSelectedFarmer(null);
                setSearch('');
                setTab('settings');
              }}
              style={styles.profileButton}
            >
              <Text style={styles.profileGlyph}>👤</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      {!online && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            Offline mode · cached workspace available
            {pendingReviewCount
              ? ` · ${pendingReviewCount} review${
                  pendingReviewCount === 1 ? '' : 's'
                } waiting to sync`
              : ''}
          </Text>
        </View>
      )}
      {notice ? (
        <Pressable
          onPress={() => setNotice('')}
          style={[
            styles.notice,
            noticeKind === 'error'
              ? styles.noticeError
              : noticeKind === 'success'
              ? styles.noticeSuccess
              : styles.noticeInfo,
          ]}
        >
          <Text style={styles.noticeText}>{notice}</Text>
          <Text style={styles.noticeClose}>×</Text>
        </Pressable>
      ) : null}
      {busy && (
        <View style={styles.loadingStrip}>
          <ActivityIndicator size="small" color={colors.blue} />
          <Text style={styles.loadingStripText}>Loading record…</Text>
        </View>
      )}

      <ScrollView
        key={
          selectedReport
            ? `report-${selectedReport.id}`
            : selectedFarmer
            ? `farmer-${selectedFarmer.id}`
            : tab
        }
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refreshData()}
            tintColor={colors.blue}
            colors={[colors.blue]}
          />
        }
      >
        {selectedReport && review ? (
          <ReportDetail
            report={selectedReport}
            review={review}
            setReview={setReview}
            styles={styles}
            colors={colors}
            canReview={canReview}
            busy={reviewBusy}
            photoFailed={photoFailed}
            setPhotoFailed={setPhotoFailed}
            token={session.token}
            onSave={() => void submitReview()}
          />
        ) : null}
        {selectedFarmer ? (
          <FarmerDetail
            farmer={selectedFarmer}
            styles={styles}
            colors={colors}
          />
        ) : null}
        {!selectedReport && !selectedFarmer && tab === 'home' ? (
          <Dashboard
            reports={reports}
            pendingTotal={pendingTotal}
            reportTotal={reportTotal}
            farmerTotal={farmerTotal}
            severeTotal={severeTotal}
            styles={styles}
            colors={colors}
            onOpenReports={() => {
              setTab('reports');
              setListFilter('All');
            }}
            onOpenPending={() => {
              setTab('reports');
              setListFilter('For verification');
            }}
            onOpenFarmers={() => setTab('farmers')}
            onSelectReport={openReport}
            refreshing={refreshing}
          />
        ) : null}
        {!selectedReport && !selectedFarmer && tab === 'reports' ? (
          <ReportsScreen
            reports={filteredReports}
            reportTotal={reportTotal}
            listFilter={listFilter}
            setListFilter={setListFilter}
            search={search}
            setSearch={setSearch}
            online={online}
            loadingMore={loadingMore}
            refreshing={refreshing}
            onLoadMore={loadMore}
            onOpenReport={openReport}
            styles={styles}
            colors={colors}
          />
        ) : null}
        {!selectedReport && !selectedFarmer && tab === 'map' ? (
          <MapScreen
            locations={mapLocations}
            totalReports={mapReportTotal}
            colors={colors}
            online={online}
            onOpenReport={openReport}
          />
        ) : null}
        {!selectedReport && !selectedFarmer && tab === 'visits' ? (
          <VisitsScreen
            reports={reports}
            reportTotal={reportTotal}
            online={online}
            loadingMore={loadingMore}
            refreshing={refreshing}
            onLoadMore={loadMore}
            onOpenReport={openReport}
            styles={styles}
            colors={colors}
          />
        ) : null}
        {!selectedReport && !selectedFarmer && tab === 'farmers' ? (
          <FarmersScreen
            farmers={filteredFarmers}
            farmerTotal={farmerTotal}
            search={search}
            setSearch={setSearch}
            online={online}
            loadingMore={loadingMore}
            refreshing={refreshing}
            onLoadMore={loadMore}
            onOpenFarmer={openFarmer}
            styles={styles}
            colors={colors}
          />
        ) : null}
        {!selectedReport && !selectedFarmer && tab === 'settings' ? (
          <SettingsScreen
            session={session}
            mode={mode}
            setMode={setMode}
            styles={styles}
            colors={colors}
            onSignOut={() => void signOut()}
          />
        ) : null}
      </ScrollView>
      {!selectedReport && !selectedFarmer && tab !== 'settings' && (
        <View
          style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}
        >
          {(
            [
              ['home', '⌂', 'Overview'],
              ['map', '⌖', 'Map'],
              ['reports', '▤', 'Reports'],
              ['visits', '◷', 'Visits'],
              ['farmers', '♧', 'Farmers'],
            ] as [Tab, string, string][]
          ).map(([key, glyph, label]) => (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === key }}
              onPress={() => {
                setTab(key);
                setSearch('');
                setSelectedFarmer(null);
                setSelectedReport(null);
              }}
              style={styles.tabItem}
            >
              <View
                style={[styles.tabIcon, tab === key && styles.tabIconSelected]}
              >
                <Text
                  style={[
                    styles.tabGlyph,
                    tab === key && styles.tabGlyphSelected,
                  ]}
                >
                  {glyph}
                </Text>
                {key === 'reports' && pendingTotal > 0 ? (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>
                      {pendingTotal > 9 ? '9+' : pendingTotal}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  tab === key && styles.tabLabelSelected,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      <NotificationsPanel
        visible={notificationOpen}
        notifications={notifications}
        colors={colors}
        onClose={() => setNotificationOpen(false)}
      />
    </SafeAreaView>
  );
}

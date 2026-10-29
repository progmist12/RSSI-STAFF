import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Keyboard,
  Image,
  KeyboardAvoidingView,
  Pressable,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  View,
} from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { photoUrl } from '../api';
import { useTheme } from '../theme';
import makeStyles from '../styles';
import { LoginScreen } from '../screens/LoginScreen';
import { Dashboard } from '../screens/DashboardScreen';
import { ReportDetail } from '../screens/ReportDetailScreen';
import { FarmerDetail } from '../screens/FarmersScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ReportsScreen, FarmersScreen } from '../screens/ReportsScreen';
import { NotificationsPanel } from '../components/NotificationsPanel';
import { HelpModal, MAP_SEVERITY_LEGEND } from '../components/HelpModal';
import { AppIcon, type AppIconName } from '../components/AppIcon';
import { MapScreen } from '../screens/MapScreen';
import { VisitsScreen, type FarmHistoryRequest } from '../screens/VisitsScreen';
import { VisitsCalendarModal } from '../components/VisitsCalendarModal';
import { KeyboardInputScrollProvider } from '../components/KeyboardAwareTextInput';
import type { StaffAppController, Tab } from './useStaffAppController';
import { reportIsCompleteWithoutVisit } from './reportReview';
import type { StaffMapLocation, StaffMapReport } from '../types';

function HideTabBarWhileKeyboardOpen({
  children,
}: {
  children: React.ReactNode;
}) {
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  React.useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () =>
      setKeyboardVisible(true),
    );
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () =>
      setKeyboardVisible(false),
    );
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return keyboardVisible ? null : <>{children}</>;
}

const helpSections: Partial<
  Record<
    Tab,
    { title: string; description: string; legend?: typeof MAP_SEVERITY_LEGEND }
  >
> = {
  home: {
    title: 'Farmer damage observations',
    description:
      'Farmer damage levels are observations. Record SRA verification and severity independently. Overview totals summarize reports and farmer records available in your assigned area.',
  },
  map: {
    title: 'Latest farmer-reported damage severity',
    description:
      'Farm pins appear only when location consent and staff permissions allow. Other reports are grouped at municipality centers. Tap a pin to open its reports. Green dashed markers mean no farmer report has been submitted and crop health is not assessed. Solid green markers mean a report was submitted without a severity estimate. Other colors reflect the newest visible farmer-reported severity. Basemap tiles need internet; saved report locations remain available offline.',
    legend: MAP_SEVERITY_LEGEND,
  },
  reports: {
    title: 'About field reports',
    description:
      'Review farmer observations in your province scope. Search or filter by verification status, then open a report to record the SRA assessment, rationale, reviewer note, and any follow-up date.',
  },
  visits: {
    title: 'Visit history',
    description:
      'Each visit belongs to a farmer report. Record checks and findings offline; queued changes sync when the connection returns. Resolve any server conflicts before the visit is finalized.',
  },
  farmers: {
    title: 'Farmer directory',
    description:
      'Browse farmer accounts and registered farms available within your province access. Search by name, reference, or farm, then open a farmer to view their account and farm details. Private location details follow staff permissions and farmer consent.',
  },
};

export function StaffAppView({ app }: { app: StaffAppController }) {
  const {
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
    pendingVisitChanges,
    markNotificationsRead,
    refreshData,
    signOut,
    updateStaffProfilePhoto,
    openReport,
    openFarmer,
    submitReview,
    loadMore,
    createVisit,
    updateVisit,
    resolvePendingVisitChange,
    filteredReports,
    filteredFarmers,
    canReview,
    severeTotal,
  } = app;
  const { colors, mode, resolved, setMode } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [mapGestureActive, setMapGestureActive] = useState(false);
  const [mapVisited, setMapVisited] = useState(tab === 'map');
  const workspaceScrollRef = useRef<ScrollViewInstance>(null);
  const workspaceScrollYRef = useRef(0);
  const detailReturnScrollYRef = useRef(0);
  const detailOpenRef = useRef(false);
  const previousTabForScrollRef = useRef(tab);
  const tabHistoryRef = useRef<Tab[]>([]);
  const farmHistoryBackHandlerRef = useRef<(() => boolean) | null>(null);
  const openReportRef = useRef(openReport);
  openReportRef.current = openReport;
  const reportOriginTabRef = useRef<Tab>(tab);
  const openReportFromCurrentTab = useCallback(
    (reportOrId: Parameters<typeof openReport>[0]) => {
      reportOriginTabRef.current = tab;
      return openReportRef.current(reportOrId);
    },
    [tab],
  );
  const [helpOpen, setHelpOpen] = useState(false);
  const [visitCalendarOpen, setVisitCalendarOpen] = useState(false);
  const [farmHistoryRequest, setFarmHistoryRequest] =
    useState<FarmHistoryRequest | null>(null);
  const farmHistoryRequestIdRef = useRef(0);
  const reportReviewLocked = selectedReport
    ? reportIsCompleteWithoutVisit(selectedReport)
    : false;
  const navigateToTab = useCallback(
    (nextTab: Tab) => {
      if (nextTab !== tab) {
        tabHistoryRef.current = [...tabHistoryRef.current, tab].slice(-10);
      }
      setTab(nextTab);
    },
    [setTab, tab],
  );
  const saveReviewAndNavigate = useCallback(
    async (nextStep: 'needed' | 'complete' | null) => {
      const destination = await submitReview(nextStep);
      if (!destination) return;

      setSelectedReport(null);
      setSelectedFarmer(null);
      setSearch('');
      if (destination === 'visits') {
        navigateToTab('visits');
        return;
      }

      if (destination === 'completed') {
        setListFilter('Completed');
        navigateToTab('reports');
        return;
      }

      if (destination === 'upcoming') {
        setListFilter('Upcoming');
        navigateToTab('reports');
        return;
      }

      setListFilter(
        review?.verificationStatus === 'Confirmed'
          ? 'Confirmed'
          : review?.verificationStatus === 'No detection'
          ? 'All'
          : review &&
            (review.verificationStatus !== 'For verification' ||
              review.sraSeverity !== 'Not assessed' ||
              review.assessmentRationale.trim() ||
              review.reviewerNote.trim() ||
              review.farmerMessage?.trim() ||
              review.followUpAt.trim() ||
              review.plantHeightCm.trim() ||
              review.leavesPerStalk.trim() ||
              review.leafLengthCm.trim() ||
              review.leafWidthCm.trim() ||
              review.tillerCount.trim() ||
              review.measurementDate.trim() ||
              review.cropVariety.trim() ||
              review.growthStage.trim() ||
              review.sampleCount.trim())
          ? 'Reviewed'
          : 'Needs review',
      );
      navigateToTab('reports');
    },
    [
      navigateToTab,
      review,
      setListFilter,
      setSearch,
      setSelectedFarmer,
      setSelectedReport,
      submitReview,
    ],
  );
  const openMapFarmHistory = useCallback(
    (mapReport: StaffMapReport, location: StaffMapLocation) => {
      const report = reports.find(item => item.id === mapReport.id);
      farmHistoryRequestIdRef.current += 1;
      setFarmHistoryRequest({
        requestId: farmHistoryRequestIdRef.current,
        reportId: mapReport.id,
        propertyId: report?.property_id ?? mapReport.property_id,
        farmerName: report?.farmer?.name ?? mapReport.farmer_name,
        propertyName: report?.property_name ?? mapReport.property_name,
        municipality: report?.municipality ?? location.municipality,
        province: report?.province ?? location.province,
      });
      navigateToTab('visits');
    },
    [navigateToTab, reports],
  );
  const markFarmHistoryRequestHandled = useCallback((requestId: number) => {
    setFarmHistoryRequest(current =>
      current?.requestId === requestId ? null : current,
    );
  }, []);
  const goBackToPreviousTab = useCallback(() => {
    const previousTab = tabHistoryRef.current.pop() || 'home';
    setSelectedReport(null);
    setSelectedFarmer(null);
    setSearch('');
    setTab(previousTab);
  }, [setSearch, setSelectedFarmer, setSelectedReport, setTab]);
  const closeSelectedDetail = useCallback(() => {
    const reportWasOpen = Boolean(selectedReport);
    setSelectedReport(null);
    setSelectedFarmer(null);
    if (reportWasOpen) setTab(reportOriginTabRef.current);
  }, [selectedReport, setSelectedFarmer, setSelectedReport, setTab]);
  const registerFarmHistoryBackHandler = useCallback(
    (handler: (() => boolean) | null) => {
      farmHistoryBackHandlerRef.current = handler;
    },
    [],
  );
  useEffect(() => {
    if (previousTabForScrollRef.current !== tab) {
      previousTabForScrollRef.current = tab;
      workspaceScrollYRef.current = 0;
      detailReturnScrollYRef.current = 0;
      detailOpenRef.current = false;
      workspaceScrollRef.current?.scrollTo({ y: 0, animated: false });
      return;
    }
    if (selectedReport || selectedFarmer) {
      if (!detailOpenRef.current) {
        detailReturnScrollYRef.current = workspaceScrollYRef.current;
        detailOpenRef.current = true;
      }
      workspaceScrollRef.current?.scrollTo({ y: 0, animated: false });
    } else if (detailOpenRef.current) {
      detailOpenRef.current = false;
      const returnY = detailReturnScrollYRef.current;
      requestAnimationFrame(() => {
        workspaceScrollRef.current?.scrollTo({ y: returnY, animated: false });
      });
    }
  }, [tab, selectedReport?.id, selectedFarmer?.id]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (helpOpen) {
          setHelpOpen(false);
          return true;
        }
        if (visitCalendarOpen) {
          setVisitCalendarOpen(false);
          return true;
        }
        if (notificationOpen) {
          setNotificationOpen(false);
          return true;
        }
        if (selectedReport || selectedFarmer) {
          closeSelectedDetail();
          return true;
        }
        if (farmHistoryBackHandlerRef.current?.()) return true;
        if (tab !== 'home') {
          goBackToPreviousTab();
          return true;
        }
        return false;
      },
    );
    return () => subscription.remove();
  }, [
    goBackToPreviousTab,
    closeSelectedDetail,
    helpOpen,
    notificationOpen,
    selectedFarmer,
    selectedReport,
    setNotificationOpen,
    setSelectedFarmer,
    setSelectedReport,
    tab,
    visitCalendarOpen,
  ]);
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
  const showHeaderActions =
    !selectedReport && !selectedFarmer && tab !== 'settings';
  const helpSection = showHeaderActions ? helpSections[tab] : undefined;
  const headerActions = (
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
        <AppIcon name="notification" color={colors.blue} size={21} />
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
          navigateToTab('settings');
        }}
        style={styles.profileButton}
      >
        {session.user.profile_photo_url ? (
          <Image
            source={{
              uri: photoUrl(session.user.profile_photo_url),
              headers: { Authorization: `Bearer ${session.token}` },
            }}
            resizeMode="cover"
            style={styles.profileGlyphImage}
          />
        ) : (
          <Text style={styles.profileGlyph}>👤</Text>
        )}
      </Pressable>
    </View>
  );
  const connectionIndicator = (
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
  );
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar
        barStyle={resolved === 'dark' ? 'light-content' : 'dark-content'}
      />
      <View style={styles.topbar}>
        <View style={styles.brandRow}>
          <Image
            source={require('../assets/rssi-logo.png')}
            resizeMode="contain"
            style={{ width: 40, height: 40 }}
            accessibilityLabel="RSSI logo"
          />
          <View>
            <Text style={styles.brandName}>RSSI</Text>
            <Text style={styles.brandSub}>SRA STAFF WORKSPACE</Text>
          </View>
        </View>
        {showHeaderActions ? headerActions : null}
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.pageHeader}>
          {(selectedReport || selectedFarmer || tab === 'settings') && (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (tab === 'settings') goBackToPreviousTab();
                else closeSelectedDetail();
              }}
              style={styles.backButton}
            >
              <Text style={styles.backButtonText}>‹</Text>
            </Pressable>
          )}
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.pageTitle,
                selectedReport && {
                  fontSize: 20,
                  lineHeight: 24,
                  flexShrink: 1,
                },
              ]}
              numberOfLines={selectedReport ? 1 : undefined}
              adjustsFontSizeToFit={Boolean(selectedReport)}
              minimumFontScale={0.65}
            >
              {pageTitle}
            </Text>
            {tab !== 'settings' ? (
              <Text style={styles.pageSubtitle}>
                {selectedReport
                  ? 'Farmer observation · SRA review'
                  : selectedFarmer
                  ? 'Farmer account and registered farms'
                  : `Hello ${session.user.name.split(' ')[0]} · ${
                      session.user.province_access
                    }`}
              </Text>
            ) : null}
          </View>
          {selectedReport ? null : tab === 'visits' && !selectedFarmer ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open visit calendar"
              accessibilityState={{ expanded: visitCalendarOpen }}
              onPress={() => setVisitCalendarOpen(true)}
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.line,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surface,
              }}
            >
              <AppIcon name="calendar" color={colors.blue} size={20} />
            </Pressable>
          ) : helpSection ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${helpSection.title} help`}
              accessibilityState={{ expanded: helpOpen }}
              onPress={() => setHelpOpen(true)}
              style={{
                width: 24,
                height: 24,
                borderRadius: 20,
                borderWidth: 1.5,
                borderColor: colors.ink,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  color: colors.ink,
                  fontSize: 20,
                  lineHeight: 23,
                  fontWeight: '800',
                  marginTop: -1,
                }}
              >
                ?
              </Text>
            </Pressable>
          ) : (
            connectionIndicator
          )}
        </View>
        {!online && !selectedReport && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineBannerText}>
              Offline mode · cached workspace available
              {pendingReviewCount
                ? ` · ${pendingReviewCount} review${
                    pendingReviewCount === 1 ? '' : 's'
                  } waiting to sync`
                : ''}
              {pendingVisitChanges.length
                ? ` · ${pendingVisitChanges.length} visit change${
                    pendingVisitChanges.length === 1 ? '' : 's'
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

        <KeyboardInputScrollProvider scrollRef={workspaceScrollRef}>
        <ScrollView
          ref={workspaceScrollRef}
          onScroll={event => {
            if (!detailOpenRef.current && !selectedReport && !selectedFarmer) {
              workspaceScrollYRef.current = event.nativeEvent.contentOffset.y;
            }
          }}
          scrollEventThrottle={16}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          scrollEnabled={tab !== 'map' || !mapGestureActive}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
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
              visits={visits.filter(
                visit => visit.report_id === selectedReport.id,
              )}
              review={review}
              setReview={setReview}
              styles={styles}
              colors={colors}
              canReview={canReview && !reportReviewLocked}
              reviewLocked={reportReviewLocked}
              busy={reviewBusy}
              photoFailed={photoFailed}
              setPhotoFailed={setPhotoFailed}
              token={session.token}
              scrollRef={workspaceScrollRef}
              onSave={(nextStep: 'needed' | 'complete' | null) =>
                void saveReviewAndNavigate(nextStep)
              }
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
                navigateToTab('reports');
                setListFilter('All');
              }}
              onOpenPending={() => {
                navigateToTab('reports');
                setListFilter('Needs review');
              }}
              onOpenFarmers={() => navigateToTab('farmers')}
              onSelectReport={openReportFromCurrentTab}
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
              onOpenReport={openReportFromCurrentTab}
              styles={styles}
              colors={colors}
            />
          ) : null}
          {mapVisited || tab === 'map' ? (
            <View
              style={{
                display:
                  tab === 'map' && !selectedReport && !selectedFarmer
                    ? 'flex'
                    : 'none',
              }}
            >
              <MapScreen
                locations={mapLocations}
                colors={colors}
                online={online}
                onOpenReport={openReportFromCurrentTab}
                onViewFarmerHistory={openMapFarmHistory}
                onMapGestureChange={setMapGestureActive}
              />
            </View>
          ) : null}
          {tab === 'visits' ? (
            <View
              style={{
                display: selectedReport || selectedFarmer ? 'none' : 'flex',
              }}
            >
              <VisitsScreen
                visits={visits}
                visitTotal={visitTotal}
                reports={reports}
                reportTotal={reportTotal}
                online={online}
                loadingMore={loadingMore}
                refreshing={refreshing}
                visitBusy={visitBusy}
                canManage={Boolean(session.scopes.includes('reports:review'))}
                onLoadMore={loadMore}
                onCreateVisit={createVisit}
                onUpdateVisit={updateVisit}
                pendingVisitChanges={pendingVisitChanges}
                onResolveVisitChange={resolvePendingVisitChange}
                onOpenReport={openReportFromCurrentTab}
                onHistoryBackHandlerChange={registerFarmHistoryBackHandler}
                historyRequest={farmHistoryRequest}
                onHistoryRequestHandled={markFarmHistoryRequestHandled}
                styles={styles}
                colors={colors}
              />
            </View>
          ) : null}
          {tab === 'farmers' ? (
            <View
              style={{
                display: selectedReport || selectedFarmer ? 'none' : 'flex',
              }}
            >
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
            </View>
          ) : null}
          {!selectedReport && !selectedFarmer && tab === 'settings' ? (
            <SettingsScreen
              session={session}
              mode={mode}
              setMode={setMode}
              styles={styles}
              colors={colors}
              onSignOut={() => void signOut()}
              onProfilePhotoUpdated={updateStaffProfilePhoto}
            />
          ) : null}
        </ScrollView>
        </KeyboardInputScrollProvider>
        <HideTabBarWhileKeyboardOpen>
          {!selectedReport && !selectedFarmer && tab !== 'settings' && (
            <View
              style={[
                styles.tabBar,
                { paddingBottom: Math.max(insets.bottom, 8) },
              ]}
            >
              {(
                [
                  ['home', 'overview', 'Overview'],
                  ['map', 'map', 'Map'],
                  ['reports', 'reports', 'Reports'],
                  ['visits', 'visits', 'Visits'],
                  ['farmers', 'farmers', 'Farmers'],
                ] as [Tab, AppIconName, string][]
              ).map(([key, icon, label]) => (
                <Pressable
                  key={key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === key }}
                  onPress={() => {
                    if (key === 'map') setMapVisited(true);
                    navigateToTab(key);
                    setSearch('');
                    setSelectedFarmer(null);
                    setSelectedReport(null);
                  }}
                  style={styles.tabItem}
                >
                  <View
                    style={[
                      styles.tabIcon,
                      tab === key && styles.tabIconSelected,
                    ]}
                  >
                    <AppIcon
                      name={icon}
                      color={tab === key ? colors.blue : colors.muted}
                      size={21}
                    />
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
        </HideTabBarWhileKeyboardOpen>
      </KeyboardAvoidingView>
      <NotificationsPanel
        visible={notificationOpen}
        notifications={notifications}
        colors={colors}
        onClose={() => setNotificationOpen(false)}
        onOpenReport={reportId => {
          setNotificationOpen(false);
          void openReportFromCurrentTab(reportId);
        }}
      />
      <HelpModal
        visible={helpOpen && Boolean(helpSection)}
        title={helpSection?.title || ''}
        description={helpSection?.description || ''}
        legend={helpSection?.legend}
        colors={colors}
        onClose={() => setHelpOpen(false)}
      />
      <VisitsCalendarModal
        visible={visitCalendarOpen}
        visits={visits}
        colors={colors}
        onClose={() => setVisitCalendarOpen(false)}
        onOpenReport={visit => {
          setVisitCalendarOpen(false);
          openReportFromCurrentTab(visit.report_id);
        }}
      />
    </SafeAreaView>
  );
}

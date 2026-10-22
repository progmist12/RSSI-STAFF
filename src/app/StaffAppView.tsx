import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  View,
} from 'react-native';
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
import { VisitsScreen } from '../screens/VisitsScreen';
import { VisitsCalendarModal } from '../components/VisitsCalendarModal';
import type { StaffAppController, Tab } from './useStaffAppController';
import { reportIsCompleteWithoutVisit } from './reportReview';

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
      'Farm pins appear only when location consent and staff permissions allow. Other reports are grouped at municipality centers. Tap a pin to open its reports. Marker color reflects the newest visible farmer-reported severity. Basemap tiles need internet; saved report locations remain available offline.',
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
      'Each visit belongs to a farmer report. Record what staff checked and found during the visit. Farmer observations and SRA assessments remain separate. Scheduled visits can be updated, completed, or cancelled while online.',
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
  } = app;
  const { colors, mode, resolved, setMode } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [mapGestureActive, setMapGestureActive] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [visitCalendarOpen, setVisitCalendarOpen] = useState(false);
  const reportReviewLocked = selectedReport
    ? reportIsCompleteWithoutVisit(selectedReport)
    : false;
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
          setTab('settings');
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
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>R</Text>
            <View style={styles.brandLeaf} />
          </View>
          <View>
            <Text style={styles.brandName}>RSSI</Text>
            <Text style={styles.brandSub}>SRA STAFF WORKSPACE</Text>
          </View>
        </View>
        {showHeaderActions ? headerActions : null}
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
          <Text
            style={[
              styles.pageTitle,
              selectedReport && { fontSize: 20, lineHeight: 24, flexShrink: 1 },
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
            style={{ width: 38, height: 38, borderRadius: 12, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}
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
        scrollEnabled={tab !== 'map' || !mapGestureActive}
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
            canReview={canReview && !reportReviewLocked}
            reviewLocked={reportReviewLocked}
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
              setListFilter('Needs review');
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
            onMapGestureChange={setMapGestureActive}
          />
        ) : null}
        {!selectedReport && !selectedFarmer && tab === 'visits' ? (
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
            onProfilePhotoUpdated={updateStaffProfilePhoto}
          />
        ) : null}
      </ScrollView>
      {!selectedReport && !selectedFarmer && tab !== 'settings' && (
        <View
          style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}
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
      <NotificationsPanel
        visible={notificationOpen}
        notifications={notifications}
        colors={colors}
        onClose={() => setNotificationOpen(false)}
        onOpenReport={reportId => {
          setNotificationOpen(false);
          void openReport(reportId);
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
          openReport(visit.report_id);
        }}
      />
    </SafeAreaView>
  );
}

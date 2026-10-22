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
import { MapScreen } from '../screens/MapScreen';
import { VisitsScreen } from '../screens/VisitsScreen';
import type { StaffAppController, Tab } from './useStaffAppController';

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
          <Text style={styles.pageTitle}>{pageTitle}</Text>
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
        {connectionIndicator}
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

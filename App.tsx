import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator, AppState, KeyboardAvoidingView, Platform, Pressable, RefreshControl,
  ScrollView, StatusBar, StyleSheet, Text, TextInput, View, Image,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import {SafeAreaProvider, SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {ApiError, apiRequest, photoUrl, staffLogin} from './src/api';
import {clearSession, readSession, saveSession} from './src/session';
import {Palette, ThemeMode, ThemeProvider, useTheme} from './src/theme';
import {ApiPage, Farmer, FieldReport, StaffProfile, StaffSession} from './src/types';

type Tab = 'home' | 'reports' | 'farmers' | 'settings';
type ReviewForm = {verificationStatus: string; sraSeverity: string; assessmentRationale: string; reviewerNote: string; followUpAt: string};

const verificationOptions = ['For verification', 'Confirmed', 'No detection'];
const severityOptions = ['Not assessed', 'Mild', 'Moderate', 'Severe', 'Highly severe'];

export default function App() {
  return <SafeAreaProvider><ThemeProvider><StaffApp /></ThemeProvider></SafeAreaProvider>;
}

function StaffApp() {
  const {colors, mode, resolved, setMode} = useTheme();
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
  const [pendingTotal, setPendingTotal] = useState(0);
  const [reportTotal, setReportTotal] = useState(0);
  const [farmerTotal, setFarmerTotal] = useState(0);
  const [selectedReport, setSelectedReport] = useState<FieldReport | null>(null);
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
  const [review, setReview] = useState<ReviewForm | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [listFilter, setListFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [online, setOnline] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeKind, setNoticeKind] = useState<'error' | 'success' | 'info'>('info');
  const [photoFailed, setPhotoFailed] = useState<number[]>([]);
  const refreshRef = useRef<() => Promise<void>>(async () => undefined);
  const requestErrorRef = useRef(false);

  const showNotice = useCallback((message: string, kind: 'error' | 'success' | 'info' = 'info') => {
    setNotice(message);
    setNoticeKind(kind);
  }, []);

  const signOut = useCallback(async (remote = true) => {
    const active = session;
    if (remote && active?.token) {
      try { await apiRequest('/auth/logout', active.token, {method: 'POST'}); } catch { /* local sign out still completes */ }
    }
    await clearSession().catch(() => undefined);
    setSession(null);
    setReports([]);
    setFarmers([]);
    setSelectedReport(null);
    setSelectedFarmer(null);
    setPassword('');
    setTab('home');
  }, [session]);

  const refreshData = useCallback(async () => {
    if (!session?.token) return;
    setRefreshing(true);
    requestErrorRef.current = false;
    const token = session.token;
    const tasks = await Promise.allSettled([
      apiRequest<ApiPage<FieldReport>>('/staff/reports?page=1&pageSize=50', token),
      apiRequest<ApiPage<FieldReport>>('/staff/reports?status=For%20verification&page=1&pageSize=1', token),
      apiRequest<ApiPage<Farmer>>('/staff/farmers?page=1&pageSize=50', token),
    ]);
    let unauthorized = false;
    const reportResult = tasks[0];
    if (reportResult.status === 'fulfilled') {
      setReports(reportResult.value.data || []);
      setReportTotal(reportResult.value.meta?.total ?? reportResult.value.data.length);
      if (selectedReport) {
        const refreshed = reportResult.value.data.find(item => item.id === selectedReport.id);
        if (refreshed) setSelectedReport(refreshed);
      }
    } else {
      requestErrorRef.current = true;
      unauthorized ||= reportResult.reason instanceof ApiError && reportResult.reason.status === 401;
    }
    const pendingResult = tasks[1];
    if (pendingResult.status === 'fulfilled') setPendingTotal(pendingResult.value.meta?.total ?? 0);
    else {
      requestErrorRef.current = true;
      unauthorized ||= pendingResult.reason instanceof ApiError && pendingResult.reason.status === 401;
    }
    const farmerResult = tasks[2];
    if (farmerResult.status === 'fulfilled') {
      setFarmers(farmerResult.value.data || []);
      setFarmerTotal(farmerResult.value.meta?.total ?? farmerResult.value.data.length);
      if (selectedFarmer) {
        const refreshed = farmerResult.value.data.find(item => item.id === selectedFarmer.id);
        if (refreshed) setSelectedFarmer(refreshed);
      }
    } else {
      requestErrorRef.current = true;
      unauthorized ||= farmerResult.reason instanceof ApiError && farmerResult.reason.status === 401;
    }
    if (unauthorized) {
      showNotice('Your session expired. Please sign in again.', 'error');
      await signOut(false);
    } else if (requestErrorRef.current && online) {
      showNotice('Some workspace data could not be refreshed. Pull down to retry.', 'error');
    } else if (!requestErrorRef.current) {
      setNotice('');
    }
    setRefreshing(false);
  }, [online, selectedFarmer, selectedReport, session, showNotice, signOut]);
  refreshRef.current = refreshData;

  useEffect(() => {
    let alive = true;
    void (async () => {
      const stored = await readSession().catch(() => null);
      if (!alive) return;
      if (!stored) { setBooting(false); return; }
      setSession(stored);
      try {
        const me = await apiRequest<{account_type: string; user: StaffProfile; scopes: string[]}>('/me', stored.token);
        if (me.account_type !== 'staff') throw new ApiError(403, 'forbidden', 'This is not a staff account.');
        const valid = {...stored, user: me.user, scopes: me.scopes};
        await saveSession(valid);
        if (alive) setSession(valid);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await clearSession();
          if (alive) setSession(null);
        } else if (error instanceof ApiError && error.status === 403) {
          await clearSession();
          if (alive) { setSession(null); setAuthError(error.message); }
        }
      } finally {
        if (alive) setBooting(false);
      }
    })();
    return () => {alive = false;};
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const connected = Boolean(state.isConnected && state.isInternetReachable !== false);
      setOnline(connected);
      if (connected) void refreshRef.current();
    });
    const appState = AppState.addEventListener('change', state => {
      if (state === 'active') void refreshRef.current();
    });
    return () => {unsubscribe(); appState.remove();};
  }, []);

  useEffect(() => {
    if (session?.token && online) void refreshRef.current();
  }, [session?.token, online]);

  const login = async () => {
    if (!email.trim() || !password) {setAuthError('Enter your work email and password.'); return;}
    setAuthBusy(true);
    setAuthError('');
    try {
      const result = await staffLogin(email, password);
      if (result.account_type !== 'staff') throw new ApiError(403, 'forbidden', 'Only SRA staff can use this app.');
      const next: StaffSession = {token: result.access_token, user: result.user, scopes: result.scopes || []};
      await saveSession(next);
      setSession(next);
      setPassword('');
      setAuthError('');
      setTab('home');
      showNotice(`Welcome, ${result.user.name}.`, 'success');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Could not sign in. Try again.');
    } finally {setAuthBusy(false);}
  };

  const openReport = async (report: FieldReport) => {
    if (!session) return;
    setBusy(true);
    setSelectedFarmer(null);
    try {
      const response = await apiRequest<{data: FieldReport}>(`/staff/reports/${report.id}`, session.token);
      setSelectedReport(response.data);
      setReview({
        verificationStatus: response.data.verification_status || 'For verification',
        sraSeverity: response.data.sra_severity || 'Not assessed',
        assessmentRationale: response.data.assessment_rationale || '',
        reviewerNote: response.data.reviewer_note || '',
        followUpAt: response.data.follow_up_at || '',
      });
      setPhotoFailed([]);
    } catch (error) {showNotice(error instanceof Error ? error.message : 'Could not load this report.', 'error');}
    finally {setBusy(false);}
  };

  const openFarmer = async (farmer: Farmer) => {
    if (!session) return;
    setBusy(true);
    setSelectedReport(null);
    try {
      const response = await apiRequest<{data: Farmer}>(`/staff/farmers/${farmer.id}`, session.token);
      setSelectedFarmer(response.data);
    } catch (error) {showNotice(error instanceof Error ? error.message : 'Could not load this farmer.', 'error');}
    finally {setBusy(false);}
  };

  const submitReview = async () => {
    if (!session || !selectedReport || !review) return;
    if (!session.scopes.includes('reports:review')) {showNotice('This staff account can view reports but cannot submit reviews.', 'error'); return;}
    const followUpAt = review.followUpAt.trim();
    if (followUpAt && !/^\d{4}-\d{2}-\d{2}$/.test(followUpAt)) {
      showNotice('Enter the follow-up date as YYYY-MM-DD.', 'error'); return;
    }
    setReviewBusy(true);
    try {
      const response = await apiRequest<{data: FieldReport}>(`/staff/reports/${selectedReport.id}/review`, session.token, {
        method: 'PUT',
        body: JSON.stringify({
          verificationStatus: review.verificationStatus,
          sraSeverity: review.sraSeverity === 'Not assessed' ? 'Not assessed' : review.sraSeverity || null,
          assessmentRationale: review.assessmentRationale.trim() || null,
          reviewerNote: review.reviewerNote.trim() || null,
          followUpAt: followUpAt || null,
        }),
      });
      setSelectedReport(response.data);
      setReports(items => items.map(item => item.id === response.data.id ? response.data : item));
      setReview({
        verificationStatus: response.data.verification_status,
        sraSeverity: response.data.sra_severity || 'Not assessed',
        assessmentRationale: response.data.assessment_rationale || '',
        reviewerNote: response.data.reviewer_note || '',
        followUpAt: response.data.follow_up_at || '',
      });
      showNotice('Review saved to the RSSI workspace.', 'success');
      void refreshData();
    } catch (error) {showNotice(error instanceof Error ? error.message : 'Review could not be saved.', 'error');}
    finally {setReviewBusy(false);}
  };

  const filteredReports = useMemo(() => reports.filter(report => {
    const matchesFilter = listFilter === 'All' || report.verification_status === listFilter;
    const query = search.trim().toLocaleLowerCase();
    const matchesSearch = !query || [report.code, report.property_name, report.province, report.municipality, report.farmer?.name]
      .some(value => value?.toLocaleLowerCase().includes(query));
    return matchesFilter && matchesSearch;
  }), [listFilter, reports, search]);
  const filteredFarmers = useMemo(() => farmers.filter(farmer => {
    const query = search.trim().toLocaleLowerCase();
    return !query || [farmer.name, farmer.email, farmer.reference, ...farmer.properties.map(property => `${property.name} ${property.municipality} ${property.province}`)]
      .some(value => value?.toLocaleLowerCase().includes(query));
  }), [farmers, search]);

  const canReview = Boolean(session?.scopes.includes('reports:review'));
  const severeTotal = reports.filter(item => ['Severe', 'Highly severe'].includes(item.farmer_severity)).length;

  if (booting) return <SafeAreaView style={[styles.safe, styles.center]}><StatusBar barStyle={resolved === 'dark' ? 'light-content' : 'dark-content'} /><ActivityIndicator size="large" color={colors.blue} /><Text style={[styles.muted, {marginTop: 14}]}>Opening your staff workspace…</Text></SafeAreaView>;
  if (!session) return <LoginScreen styles={styles} colors={colors} resolved={resolved} insets={insets.bottom} email={email} setEmail={setEmail} password={password} setPassword={setPassword} busy={authBusy} error={authError} onLogin={login} />;

  const pageTitle = selectedReport ? selectedReport.code : selectedFarmer ? selectedFarmer.name : ({home: 'Overview', reports: 'Field reports', farmers: 'Farmers', settings: 'Settings'} as Record<Tab, string>)[tab];
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={resolved === 'dark' ? 'light-content' : 'dark-content'} />
      <View style={styles.topbar}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}><Text style={styles.brandMarkText}>R</Text><View style={styles.brandLeaf} /></View>
          <View><Text style={styles.brandName}>RSSI</Text><Text style={styles.brandSub}>SRA STAFF WORKSPACE</Text></View>
        </View>
        <View style={styles.topbarRight}><View style={[styles.onlineDot, {backgroundColor: online ? colors.green : colors.amber}]} /><Text style={styles.connectionLabel}>{online ? 'Online' : 'Offline'}</Text></View>
      </View>
      <View style={styles.pageHeader}>
        {(selectedReport || selectedFarmer) && <Pressable accessibilityRole="button" onPress={() => {setSelectedReport(null); setSelectedFarmer(null);}} style={styles.backButton}><Text style={styles.backButtonText}>‹</Text></Pressable>}
        <View style={{flex: 1}}><Text style={styles.pageTitle}>{pageTitle}</Text><Text style={styles.pageSubtitle}>{selectedReport ? 'Farmer observation · SRA review' : selectedFarmer ? 'Farmer account and registered farms' : `Hello ${session.user.name.split(' ')[0]} · ${session.user.province_access}`}</Text></View>
        <Pressable accessibilityRole="button" onPress={() => void refreshData()} style={styles.refreshButton}><Text style={styles.refreshGlyph}>↻</Text></Pressable>
      </View>
      {!online && <View style={styles.offlineBanner}><Text style={styles.offlineBannerText}>Offline mode · workspace data will refresh when the connection returns</Text></View>}
      {notice ? <Pressable onPress={() => setNotice('')} style={[styles.notice, noticeKind === 'error' ? styles.noticeError : noticeKind === 'success' ? styles.noticeSuccess : styles.noticeInfo]}><Text style={styles.noticeText}>{notice}</Text><Text style={styles.noticeClose}>×</Text></Pressable> : null}
      {busy && <View style={styles.loadingStrip}><ActivityIndicator size="small" color={colors.blue} /><Text style={styles.loadingStripText}>Loading record…</Text></View>}

      <ScrollView
        key={selectedReport ? `report-${selectedReport.id}` : selectedFarmer ? `farmer-${selectedFarmer.id}` : tab}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refreshData()} tintColor={colors.blue} colors={[colors.blue]} />}
      >
        {selectedReport && review ? <ReportDetail report={selectedReport} review={review} setReview={setReview} styles={styles} colors={colors} canReview={canReview} busy={reviewBusy} photoFailed={photoFailed} setPhotoFailed={setPhotoFailed} token={session.token} onSave={() => void submitReview()} /> : null}
        {selectedFarmer ? <FarmerDetail farmer={selectedFarmer} styles={styles} colors={colors} /> : null}
        {!selectedReport && !selectedFarmer && tab === 'home' ? <Dashboard reports={reports} pendingTotal={pendingTotal} reportTotal={reportTotal} farmerTotal={farmerTotal} severeTotal={severeTotal} styles={styles} colors={colors} onOpenReports={() => {setTab('reports'); setListFilter('All');}} onOpenPending={() => {setTab('reports'); setListFilter('For verification');}} onOpenFarmers={() => setTab('farmers')} onSelectReport={openReport} refreshing={refreshing} /> : null}
        {!selectedReport && !selectedFarmer && tab === 'reports' ? <View>
          <SectionIntro eyebrow="TRIAGE QUEUE" title="Reports from the field" detail={`${reportTotal} reports in your province scope`} styles={styles} />
          <SearchInput value={search} onChange={setSearch} placeholder="Search report, farmer or town" styles={styles} colors={colors} />
          <View style={styles.filterRow}>{['All', ...verificationOptions].map(value => <Choice key={value} label={value === 'For verification' ? 'Pending' : value} selected={listFilter === value} onPress={() => setListFilter(value)} styles={styles} colors={colors} />)}</View>
          {filteredReports.map(report => <ReportRow key={report.id} report={report} onPress={() => void openReport(report)} styles={styles} colors={colors} />)}
          {filteredReports.length === 0 && <EmptyCard title="No reports found" detail={online ? 'Try another search or filter.' : 'Connect to the internet to load your report queue.'} styles={styles} />}
          {reportTotal > reports.length ? <Text style={styles.listFootnote}>Showing the latest {reports.length} of {reportTotal} reports.</Text> : null}
        </View> : null}
        {!selectedReport && !selectedFarmer && tab === 'farmers' ? <View>
          <SectionIntro eyebrow="FARMER DIRECTORY" title="Farmers in your scope" detail={`${farmerTotal} accounts · private details are access controlled`} styles={styles} />
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, reference or farm" styles={styles} colors={colors} />
          {filteredFarmers.map(farmer => <FarmerRow key={farmer.id} farmer={farmer} onPress={() => void openFarmer(farmer)} styles={styles} colors={colors} />)}
          {filteredFarmers.length === 0 && <EmptyCard title="No farmers found" detail={online ? 'Try a different name or farm.' : 'Farmer records load when the app is online.'} styles={styles} />}
          {farmerTotal > farmers.length ? <Text style={styles.listFootnote}>Showing the first {farmers.length} of {farmerTotal} farmers.</Text> : null}
        </View> : null}
        {!selectedReport && !selectedFarmer && tab === 'settings' ? <SettingsScreen session={session} mode={mode} setMode={setMode} styles={styles} colors={colors} onSignOut={() => void signOut()} /> : null}
      </ScrollView>
      {!selectedReport && !selectedFarmer && <View style={[styles.tabBar, {paddingBottom: Math.max(insets.bottom, 8)}]}>
        {([
          ['home', '⌂', 'Home'], ['reports', '▤', 'Reports'], ['farmers', '♧', 'Farmers'], ['settings', '⚙', 'Settings'],
        ] as [Tab, string, string][]).map(([key, glyph, label]) => <Pressable key={key} accessibilityRole="tab" accessibilityState={{selected: tab === key}} onPress={() => {setTab(key); setSearch(''); setSelectedFarmer(null); setSelectedReport(null);}} style={styles.tabItem}>
          <View style={[styles.tabIcon, tab === key && styles.tabIconSelected]}><Text style={[styles.tabGlyph, tab === key && styles.tabGlyphSelected]}>{glyph}</Text>{key === 'reports' && pendingTotal > 0 ? <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{pendingTotal > 9 ? '9+' : pendingTotal}</Text></View> : null}</View>
          <Text style={[styles.tabLabel, tab === key && styles.tabLabelSelected]}>{label}</Text>
        </Pressable>)}
      </View>}
    </SafeAreaView>
  );
}

function LoginScreen({styles, colors, resolved, insets, email, setEmail, password, setPassword, busy, error, onLogin}: any) {
  return <SafeAreaView style={styles.safe}>
    <StatusBar barStyle={resolved === 'dark' ? 'light-content' : 'dark-content'} />
    <KeyboardAvoidingView style={styles.loginKeyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.loginScroll, {paddingBottom: Math.max(insets, 26)}]} keyboardShouldPersistTaps="handled">
        <View style={styles.loginBrand}><View style={styles.brandMarkLarge}><Text style={styles.brandMarkLargeText}>R</Text><View style={styles.brandLeafLarge} /></View><Text style={styles.loginBrandName}>RSSI</Text><Text style={styles.loginBrandSub}>SUGAR CANE FIELD MONITORING</Text></View>
        <View style={styles.loginCard}>
          <View style={styles.loginEyebrow}><Text style={styles.loginEyebrowText}>SRA STAFF ACCESS</Text></View>
          <Text style={styles.loginTitle}>Welcome back</Text>
          <Text style={styles.loginDetail}>Sign in to review farmer observations and monitor reports across your assigned province.</Text>
          {error ? <View style={styles.loginError}><Text style={styles.loginErrorText}>{error}</Text></View> : null}
          <Text style={styles.fieldLabel}>Work email</Text>
          <TextInput value={email} onChangeText={setEmail} placeholder="name@sra.gov.ph" placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="username" style={styles.input} returnKeyType="next" />
          <Text style={[styles.fieldLabel, {marginTop: 15}]}>Password</Text>
          <TextInput value={password} onChangeText={setPassword} placeholder="Enter your password" placeholderTextColor={colors.muted} secureTextEntry autoComplete="password" textContentType="password" style={styles.input} onSubmitEditing={onLogin} returnKeyType="done" />
          <PrimaryButton label={busy ? 'Signing in…' : 'Sign in to workspace'} onPress={onLogin} disabled={busy} styles={styles} />
          {busy ? <ActivityIndicator color={colors.blue} style={{marginTop: 14}} /> : null}
          <View style={styles.loginSecurity}><Text style={styles.securityGlyph}>◈</Text><Text style={styles.loginSecurityText}>Your session is stored securely on this device.</Text></View>
        </View>
        <Text style={styles.loginFoot}>Sugarcane field observation · Negros Oriental & Negros Occidental</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

function Dashboard({reports, pendingTotal, reportTotal, farmerTotal, severeTotal, styles, colors, onOpenReports, onOpenPending, onOpenFarmers, onSelectReport, refreshing}: any) {
  const recent = reports.slice(0, 5);
  return <View>
    <View style={styles.welcomePanel}>
      <View style={{flex: 1}}><Text style={styles.welcomeEyebrow}>FIELD MONITORING</Text><Text style={styles.welcomeTitle}>Good day, team</Text><Text style={styles.welcomeDetail}>Review incoming observations and keep the regional picture up to date.</Text></View>
      <View style={styles.welcomeGraphic}><Text style={styles.welcomeGraphicText}>RSSI</Text><Text style={styles.welcomeGraphicSub}>SRA</Text></View>
    </View>
    <View style={styles.metricGrid}>
      <MetricCard label="Needs review" value={pendingTotal} hint="Pending verification" tone="blue" styles={styles} onPress={onOpenPending} />
      <MetricCard label="Total reports" value={reportTotal} hint="Province scoped" tone="green" styles={styles} onPress={onOpenReports} />
      <MetricCard label="Farmers" value={farmerTotal} hint="Active directory" tone="amber" styles={styles} onPress={onOpenFarmers} />
      <MetricCard label="Severe reports" value={severeTotal} hint="Latest 50 reports" tone="red" styles={styles} onPress={onOpenReports} />
    </View>
    <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Recent reports</Text><Text style={styles.sectionDetail}>Latest farmer observations in your assigned area</Text></View><Pressable onPress={onOpenReports}><Text style={styles.textLink}>View all ›</Text></Pressable></View>
    {recent.map((report: FieldReport) => <ReportRow key={report.id} report={report} onPress={() => onSelectReport(report)} styles={styles} colors={colors} compact />)}
    {!recent.length && <EmptyCard title={refreshing ? 'Loading reports…' : 'Your queue is clear'} detail="New farmer observations will appear here." styles={styles} />}
    <View style={styles.privacyCallout}><Text style={styles.privacyGlyph}>ⓘ</Text><Text style={styles.privacyText}>Farmer damage levels are observations. Record SRA verification and severity independently.</Text></View>
  </View>;
}

function MetricCard({label, value, hint, tone, styles, onPress}: any) {
  const toneStyle = ({blue: styles.metricBlue, green: styles.metricGreen, amber: styles.metricAmber, red: styles.metricRed} as any)[tone];
  return <Pressable onPress={onPress} style={[styles.metricCard, toneStyle]}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricHint}>{hint}</Text></Pressable>;
}

function SectionIntro({eyebrow, title, detail, styles}: any) {
  return <View style={styles.sectionIntro}><Text style={styles.introEyebrow}>{eyebrow}</Text><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.sectionDetail}>{detail}</Text></View>;
}

function SearchInput({value, onChange, placeholder, styles, colors}: any) {
  return <View style={styles.searchWrap}><Text style={styles.searchIcon}>⌕</Text><TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.muted} style={styles.searchInput} returnKeyType="search" /><Pressable onPress={() => onChange('')}><Text style={styles.searchClear}>{value ? '×' : ''}</Text></Pressable></View>;
}

function Choice({label, selected, onPress, styles}: any) {
  return <Pressable onPress={onPress} style={[styles.choice, selected && styles.choiceSelected]}><Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text></Pressable>;
}

function ReportRow({report, onPress, styles, compact}: any) {
  const severity = severityStyle(report.farmer_severity, styles);
  const status = report.verification_status === 'For verification' ? 'Pending review' : report.verification_status;
  return <Pressable onPress={onPress} style={styles.reportRow}>
    <View style={[styles.reportIcon, severity]}><Text style={styles.reportIconGlyph}>⌁</Text></View>
    <View style={styles.reportBody}>
      <View style={styles.rowBetween}><Text style={styles.reportCode}>{report.code}</Text><Badge label={status} tone={report.verification_status === 'For verification' ? 'amber' : report.verification_status === 'Confirmed' ? 'green' : 'muted'} styles={styles} /></View>
      <Text style={styles.reportFarm} numberOfLines={1}>{report.property_name} · {report.farmer?.name || 'Farmer observation'}</Text>
      <View style={styles.rowMeta}><Text style={styles.reportMeta}>{report.municipality}, {shortProvince(report.province)}</Text><Text style={[styles.reportSeverity, severity]}>{report.farmer_severity}{report.farmer_severity_range ? ` · ${report.farmer_severity_range}` : ''}</Text></View>
      {!compact && <Text style={styles.reportDate}>Observed {formatDate(report.observed_at)} · {report.affected_area_hectares} ha reported</Text>}
    </View>
    <Text style={styles.rowArrow}>›</Text>
  </Pressable>;
}

function FarmerRow({farmer, onPress, styles}: any) {
  const firstProperty = farmer.properties?.[0];
  return <Pressable onPress={onPress} style={styles.farmerRow}>
    <View style={styles.avatar}><Text style={styles.avatarText}>{initials(farmer.name)}</Text></View>
    <View style={styles.farmerBody}><Text style={styles.farmerName}>{farmer.name}</Text><Text style={styles.farmerReference}>{farmer.reference} · {farmer.status}</Text><Text style={styles.farmerProperty} numberOfLines={1}>{firstProperty ? `${firstProperty.name} · ${firstProperty.municipality}, ${shortProvince(firstProperty.province)}` : 'No farm registered'}</Text></View>
    <Text style={styles.rowArrow}>›</Text>
  </Pressable>;
}

function FarmerDetail({farmer, styles}: any) {
  return <View>
    <View style={styles.profileCard}><View style={styles.profileHero}><View style={[styles.avatar, styles.avatarLarge]}><Text style={styles.avatarTextLarge}>{initials(farmer.name)}</Text></View><View style={{flex: 1}}><Text style={styles.profileName}>{farmer.name}</Text><Text style={styles.profileSub}>{farmer.reference} · {farmer.status}</Text></View><Badge label={farmer.status} tone={farmer.status === 'Active' ? 'green' : 'muted'} styles={styles} /></View>
      <InfoLine label="Email" value={farmer.email || 'Not provided'} styles={styles} /><InfoLine label="Registered farms" value={`${farmer.properties?.length || 0}`} styles={styles} />
    </View>
    <SectionIntro eyebrow="REGISTERED LOCATIONS" title="Farm properties" detail="Location details reflect the farmer’s saved property records and consent settings." styles={styles} />
    {farmer.properties?.map((property: any) => <View key={property.id} style={styles.propertyCard}>
      <View style={styles.propertyHeader}><View style={styles.propertyPin}><Text style={styles.propertyPinText}>⌖</Text></View><View style={{flex: 1}}><Text style={styles.propertyName}>{property.name}</Text><Text style={styles.propertyArea}>{property.municipality}, {property.province}</Text></View></View>
      <InfoLine label="Barangay" value={property.barangay || 'Not provided'} styles={styles} /><InfoLine label="Farm size" value={property.size_hectares ? `${property.size_hectares} ha` : 'Not provided'} styles={styles} />
      {property.address ? <InfoLine label="Address" value={property.address} styles={styles} /> : null}
      {property.location_consent ? <Text style={styles.consentLine}>✓ Location sharing consent recorded</Text> : <Text style={styles.consentLineMuted}>Exact property coordinates are hidden unless consent and staff access allow them.</Text>}
    </View>)}
    {!farmer.properties?.length ? <EmptyCard title="No registered farms" detail="This account has no farm properties yet." styles={styles} /> : null}
  </View>;
}

function ReportDetail({report, review, setReview, styles, colors, canReview, busy, photoFailed, setPhotoFailed, token, onSave}: any) {
  const update = (key: keyof ReviewForm, value: string) => setReview((old: ReviewForm) => ({...old, [key]: value}));
  const shade = severityStyle(report.farmer_severity, styles);
  return <View>
    <View style={styles.detailHero}><View style={styles.detailHeroTop}><View style={{flex: 1}}><Text style={styles.detailCode}>{report.code}</Text><Text style={styles.detailTitle}>{report.property_name}</Text><Text style={styles.detailSub}>{report.farmer?.name || 'Farmer'} · {report.municipality}, {report.province}</Text></View><Badge label={report.verification_status} tone={report.verification_status === 'For verification' ? 'amber' : report.verification_status === 'Confirmed' ? 'green' : 'muted'} styles={styles} /></View>
      <View style={styles.detailMetrics}><View style={styles.detailMetric}><Text style={styles.detailMetricLabel}>Farmer severity</Text><Text style={[styles.detailMetricValue, shade]}>{report.farmer_severity}{report.farmer_severity_range ? ` · ${report.farmer_severity_range}` : ''}</Text></View><View style={styles.detailMetric}><Text style={styles.detailMetricLabel}>Area affected</Text><Text style={styles.detailMetricValue}>{report.affected_area_hectares} ha</Text></View><View style={styles.detailMetric}><Text style={styles.detailMetricLabel}>SRA severity</Text><Text style={styles.detailMetricValue}>{report.sra_severity || 'Not assessed'}</Text></View></View>
    </View>
    <View style={styles.card}><SectionTitle title="Farmer observation" detail={`Observed ${formatDate(report.observed_at)} · Submitted ${formatDate(report.submitted_at)}`} styles={styles} /><Text style={styles.fieldLabel}>Suspected RSSI observations</Text><Text style={styles.bodyText}>{report.observations || 'No observation provided.'}</Text><Text style={[styles.fieldLabel, {marginTop: 16}]}>Damage description</Text><Text style={styles.bodyText}>{report.damage_description || 'No damage description provided.'}</Text>{report.location_description ? <><Text style={[styles.fieldLabel, {marginTop: 16}]}>Location notes</Text><Text style={styles.bodyText}>{report.location_description}</Text></> : null}<View style={styles.contextStrip}><Text style={styles.contextStripText}>Farmer severity records observed damage. SRA assessment is stored separately.</Text></View></View>
    <View style={styles.card}><SectionTitle title={`Photo evidence · ${report.photos?.length || 0}`} detail="Private attachments · available to authorized staff" styles={styles} />
      {report.photos?.length ? <View style={styles.photoGrid}>{report.photos.map((photo: any) => <View key={photo.id} style={styles.photoCard}>{photoFailed.includes(photo.id) ? <View style={styles.photoUnavailable}><Text style={styles.photoUnavailableGlyph}>▧</Text><Text style={styles.photoUnavailableText}>Photo unavailable</Text></View> : <Image source={{uri: photoUrl(photo.url), headers: {Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true'}}} style={styles.photo} resizeMode="cover" onError={() => setPhotoFailed((current: number[]) => [...current, photo.id])} />}<Text style={styles.photoName} numberOfLines={1}>{photo.name}</Text></View>)}</View> : <EmptyCard title="No photos attached" detail="The farmer did not attach photo evidence." styles={styles} />}
    </View>
    <View style={styles.card}><SectionTitle title="SRA review" detail={canReview ? 'Record an independent assessment and next step.' : 'This account has view-only access.'} styles={styles} />
      <Text style={styles.fieldLabel}>Verification status</Text><View style={styles.choiceWrap}>{verificationOptions.map(value => <Choice key={value} label={value} selected={review.verificationStatus === value} onPress={() => update('verificationStatus', value)} styles={styles} />)}</View>
      <Text style={[styles.fieldLabel, {marginTop: 18}]}>SRA-assessed severity</Text><Text style={styles.inputHint}>Choose independently from the farmer’s damage selection.</Text><View style={styles.choiceWrap}>{severityOptions.map(value => <Choice key={value} label={value} selected={review.sraSeverity === value} onPress={() => update('sraSeverity', value)} styles={styles} />)}</View>
      <Text style={[styles.fieldLabel, {marginTop: 18}]}>Assessment rationale</Text><TextInput editable={canReview} value={review.assessmentRationale} onChangeText={value => update('assessmentRationale', value)} placeholder="Add evidence-based findings" placeholderTextColor={colors.muted} style={[styles.input, styles.multiline]} multiline textAlignVertical="top" />
      <Text style={[styles.fieldLabel, {marginTop: 15}]}>Reviewer note</Text><TextInput editable={canReview} value={review.reviewerNote} onChangeText={value => update('reviewerNote', value)} placeholder="Internal notes and follow-up context" placeholderTextColor={colors.muted} style={[styles.input, styles.multiline]} multiline textAlignVertical="top" />
      <Text style={[styles.fieldLabel, {marginTop: 15}]}>Follow-up date <Text style={styles.optionalText}>optional</Text></Text><TextInput editable={canReview} value={review.followUpAt} onChangeText={value => update('followUpAt', value)} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} style={styles.input} autoCapitalize="none" />
      {canReview ? <PrimaryButton label={busy ? 'Saving review…' : 'Save review'} onPress={onSave} disabled={busy} styles={styles} /> : <View style={styles.readOnly}><Text style={styles.readOnlyText}>Review controls are disabled for view-only staff.</Text></View>}
    </View>
    <View style={styles.privacyCallout}><Text style={styles.privacyGlyph}>ⓘ</Text><Text style={styles.privacyText}>Report observations and photos do not confirm RSSI. Verification decisions remain with authorized SRA reviewers.</Text></View>
  </View>;
}

function SettingsScreen({session, mode, setMode, styles, onSignOut}: any) {
  return <View>
    <SectionIntro eyebrow="PREFERENCES" title="Your workspace" detail="Personal app preferences and secure account controls." styles={styles} />
    <View style={styles.profileCard}><View style={styles.profileHero}><View style={styles.avatar}><Text style={styles.avatarText}>{initials(session.user.name)}</Text></View><View style={{flex: 1}}><Text style={styles.profileName}>{session.user.name}</Text><Text style={styles.profileSub}>{session.user.email}</Text></View></View><InfoLine label="Staff role" value={roleName(session.user.role)} styles={styles} /><InfoLine label="Province access" value={session.user.province_access} styles={styles} /></View>
    <View style={styles.card}><SectionTitle title="Appearance" detail="Choose how RSSI looks on this device." styles={styles} />
      {([['system', 'System', 'Follow your phone appearance'], ['light', 'Light', 'Bright surfaces and dark text'], ['dark', 'Dark', 'Dim surfaces for low-light use']] as [ThemeMode, string, string][]).map(([value, label, help]) => <Pressable key={value} onPress={() => void setMode(value)} style={styles.themeOption}>
        <View style={[styles.radio, mode === value && styles.radioSelected]}>{mode === value ? <View style={styles.radioDot} /> : null}</View><View style={{flex: 1}}><Text style={styles.themeLabel}>{label}</Text><Text style={styles.themeHelp}>{help}</Text></View><Text style={styles.themePreview}>{value === 'system' ? '◐' : value === 'light' ? '☀' : '☾'}</Text>
      </Pressable>)}
    </View>
    <View style={styles.card}><SectionTitle title="Access and privacy" detail="Your account is limited to the staff data and actions allowed by SRA." styles={styles} /><View style={styles.scopeRow}><Text style={styles.scopeCheck}>✓</Text><Text style={styles.scopeText}>Report and farmer access is limited by assigned province.</Text></View><View style={styles.scopeRow}><Text style={styles.scopeCheck}>✓</Text><Text style={styles.scopeText}>Session credentials are protected by device secure storage.</Text></View><View style={styles.scopeRow}><Text style={styles.scopeCheck}>✓</Text><Text style={styles.scopeText}>Exact farm location visibility follows consent and workspace access.</Text></View></View>
    <Pressable onPress={onSignOut} style={styles.signOutButton}><Text style={styles.signOutText}>Sign out</Text></Pressable>
    <Text style={styles.versionText}>RSSI Staff · Sugarcane field monitoring</Text>
  </View>;
}

function InfoLine({label, value, styles}: any) {
  return <View style={styles.infoLine}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>;
}

function SectionTitle({title, detail, styles}: any) {
  return <View style={styles.cardTitleBlock}><Text style={styles.cardTitle}>{title}</Text>{detail ? <Text style={styles.cardDetail}>{detail}</Text> : null}</View>;
}

function Badge({label, tone, styles}: any) {
  const toneStyle = ({amber: styles.badgeAmber, green: styles.badgeGreen, muted: styles.badgeMuted, red: styles.badgeRed} as any)[tone] || styles.badgeBlue;
  return <View style={[styles.badge, toneStyle]}><Text style={[styles.badgeText, toneStyle]}>{label}</Text></View>;
}

function EmptyCard({title, detail, styles}: any) {
  return <View style={styles.emptyCard}><View style={styles.emptyIcon}><Text style={styles.emptyGlyph}>✓</Text></View><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyDetail}>{detail}</Text></View>;
}

function PrimaryButton({label, onPress, disabled, styles}: any) {
  return <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={({pressed}) => [styles.primaryButton, disabled && styles.buttonDisabled, pressed && !disabled && styles.buttonPressed]}><Text style={styles.primaryButtonText}>{label}</Text></Pressable>;
}

function severityStyle(value: string, styles: any) {
  if (value === 'Mild') return styles.severityBlue;
  if (value === 'Moderate') return styles.severityAmber;
  if (value === 'Severe') return styles.severityOrange;
  if (value === 'Highly severe') return styles.severityRed;
  return styles.severityMuted;
}

function shortProvince(province: string) {return province === 'Negros Oriental' ? 'Oriental' : province === 'Negros Occidental' ? 'Occidental' : province;}
function initials(name: string) {return name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]?.toUpperCase()).join('') || 'S';}
function formatDate(value: string) {
  if (!value) return '—';
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('en-PH', {day: '2-digit', month: 'short', year: 'numeric'}).format(parsed);
}
function roleName(role: string) {return role.replace(/^ROLE_/, '').toLowerCase().replace(/(^|_)\w/g, value => value.replace('_', ' ').toUpperCase());}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    safe: {flex: 1, backgroundColor: c.background}, center: {alignItems: 'center', justifyContent: 'center'},
    muted: {color: c.muted, fontSize: 14},
    topbar: {height: 62, paddingHorizontal: 19, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomColor: c.line, borderBottomWidth: StyleSheet.hairlineWidth, backgroundColor: c.surface},
    brandRow: {flexDirection: 'row', alignItems: 'center', gap: 10}, brandMark: {width: 37, height: 37, borderRadius: 13, backgroundColor: c.greenSoft, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center'},
    brandMarkText: {fontSize: 19, fontWeight: '900', color: c.green}, brandLeaf: {position: 'absolute', width: 8, height: 5, borderRadius: 6, backgroundColor: c.green, top: 7, right: 6, transform: [{rotate: '-35deg'}]},
    brandName: {fontSize: 16, fontWeight: '900', color: c.ink, letterSpacing: 0.4}, brandSub: {fontSize: 8, fontWeight: '800', color: c.muted, letterSpacing: 1.05, marginTop: 2},
    topbarRight: {flexDirection: 'row', alignItems: 'center', gap: 7}, onlineDot: {height: 8, width: 8, borderRadius: 5}, connectionLabel: {fontSize: 11, fontWeight: '700', color: c.muted},
    pageHeader: {paddingHorizontal: 18, paddingTop: 18, paddingBottom: 15, flexDirection: 'row', gap: 10, alignItems: 'center'}, pageTitle: {fontSize: 25, lineHeight: 30, color: c.ink, fontWeight: '800', letterSpacing: -0.45}, pageSubtitle: {fontSize: 12, color: c.muted, marginTop: 4},
    backButton: {width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface, borderColor: c.line, borderWidth: 1}, backButtonText: {fontSize: 30, lineHeight: 32, color: c.ink, marginTop: -3}, refreshButton: {width: 40, height: 40, borderRadius: 13, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center'}, refreshGlyph: {fontSize: 24, color: c.blue, lineHeight: 27},
    offlineBanner: {paddingVertical: 8, paddingHorizontal: 18, backgroundColor: c.amberSoft}, offlineBannerText: {fontSize: 11, color: c.amber, fontWeight: '700', textAlign: 'center'}, loadingStrip: {flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 7}, loadingStripText: {fontSize: 10, color: c.muted},
    notice: {marginHorizontal: 16, marginBottom: 6, borderRadius: 11, paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8}, noticeError: {backgroundColor: c.redSoft}, noticeSuccess: {backgroundColor: c.greenSoft}, noticeInfo: {backgroundColor: c.blueSoft}, noticeText: {fontSize: 12, flex: 1, color: c.ink, lineHeight: 17}, noticeClose: {fontSize: 19, color: c.muted},
    scroll: {flex: 1}, scrollContent: {paddingHorizontal: 16, paddingBottom: 22}, tabBar: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', borderTopColor: c.line, borderTopWidth: 1, backgroundColor: c.surface, paddingTop: 7}, tabItem: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 51}, tabIcon: {width: 42, height: 27, borderRadius: 10, alignItems: 'center', justifyContent: 'center'}, tabIconSelected: {backgroundColor: c.blueSoft}, tabGlyph: {fontSize: 21, color: c.muted, lineHeight: 25}, tabGlyphSelected: {color: c.blue, fontWeight: '800'}, tabLabel: {fontSize: 10, color: c.muted, fontWeight: '600'}, tabLabelSelected: {color: c.blue, fontWeight: '800'}, tabBadge: {position: 'absolute', top: -3, right: -1, minWidth: 15, height: 15, borderRadius: 8, paddingHorizontal: 3, backgroundColor: c.red, justifyContent: 'center', alignItems: 'center'}, tabBadgeText: {fontSize: 8, color: '#FFF', fontWeight: '900'},
    welcomePanel: {marginTop: 3, marginBottom: 15, padding: 20, borderRadius: 20, backgroundColor: c.blue, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', minHeight: 155}, welcomeEyebrow: {fontSize: 9, color: '#DCE7FF', fontWeight: '900', letterSpacing: 1.5}, welcomeTitle: {fontSize: 23, color: '#FFF', fontWeight: '800', marginTop: 8}, welcomeDetail: {fontSize: 12, lineHeight: 18, color: '#E5ECFF', marginTop: 6, maxWidth: 250}, welcomeGraphic: {width: 76, height: 76, borderRadius: 26, borderColor: 'rgba(255,255,255,0.23)', borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', transform: [{rotate: '-7deg'}]}, welcomeGraphicText: {fontSize: 16, color: '#FFF', fontWeight: '900', letterSpacing: 1}, welcomeGraphicSub: {fontSize: 8, color: '#DCE7FF', fontWeight: '800', letterSpacing: 2, marginTop: 3},
    metricGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24}, metricCard: {width: '48.3%', minHeight: 112, borderRadius: 17, borderWidth: 1, padding: 14, justifyContent: 'space-between'}, metricBlue: {backgroundColor: c.blueSoft, borderColor: c.blueSoft}, metricGreen: {backgroundColor: c.greenSoft, borderColor: c.greenSoft}, metricAmber: {backgroundColor: c.amberSoft, borderColor: c.amberSoft}, metricRed: {backgroundColor: c.redSoft, borderColor: c.redSoft}, metricLabel: {fontSize: 11, fontWeight: '700', color: c.muted}, metricValue: {fontSize: 29, lineHeight: 34, fontWeight: '900', color: c.ink, marginTop: 5}, metricHint: {fontSize: 10, color: c.muted, marginTop: 3},
    sectionHeader: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11}, sectionTitle: {fontSize: 18, color: c.ink, fontWeight: '800', letterSpacing: -0.2}, sectionDetail: {fontSize: 11, color: c.muted, marginTop: 4, lineHeight: 16}, textLink: {fontSize: 12, fontWeight: '800', color: c.blue},
    sectionIntro: {marginTop: 4, marginBottom: 15}, introEyebrow: {fontSize: 9, fontWeight: '900', letterSpacing: 1.2, color: c.blue, marginBottom: 6},
    searchWrap: {height: 48, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 14, marginBottom: 12}, searchIcon: {fontSize: 25, lineHeight: 28, color: c.muted}, searchInput: {flex: 1, paddingVertical: 0, color: c.ink, fontSize: 13}, searchClear: {fontSize: 22, color: c.muted, width: 20, textAlign: 'center'}, filterRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12}, choice: {paddingHorizontal: 12, paddingVertical: 9, borderRadius: 11, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, marginRight: 1, marginBottom: 2}, choiceSelected: {backgroundColor: c.blueSoft, borderColor: c.blue}, choiceText: {fontSize: 11, color: c.muted, fontWeight: '700'}, choiceTextSelected: {color: c.blue}, choiceWrap: {flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8},
    reportRow: {flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 15, marginBottom: 9}, reportIcon: {width: 39, height: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center'}, reportIconGlyph: {fontSize: 22, color: c.ink}, reportBody: {flex: 1, minWidth: 0}, rowBetween: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6}, reportCode: {fontSize: 13, fontWeight: '900', color: c.ink}, reportFarm: {fontSize: 11, color: c.ink, marginTop: 5, fontWeight: '600'}, rowMeta: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginTop: 5}, reportMeta: {fontSize: 10, color: c.muted, flexShrink: 1}, reportSeverity: {fontSize: 10, fontWeight: '800'}, reportDate: {fontSize: 10, color: c.muted, marginTop: 5}, rowArrow: {fontSize: 24, color: c.muted, marginLeft: 1}, severityBlue: {backgroundColor: c.blueSoft, color: c.blue}, severityAmber: {backgroundColor: c.amberSoft, color: c.amber}, severityOrange: {backgroundColor: c.orangeSoft, color: c.orange}, severityRed: {backgroundColor: c.redSoft, color: c.red}, severityMuted: {backgroundColor: c.surfaceAlt, color: c.muted},
    badge: {alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5}, badgeText: {fontSize: 9, fontWeight: '800'}, badgeAmber: {backgroundColor: c.amberSoft, color: c.amber}, badgeGreen: {backgroundColor: c.greenSoft, color: c.green}, badgeMuted: {backgroundColor: c.surfaceAlt, color: c.muted}, badgeRed: {backgroundColor: c.redSoft, color: c.red}, badgeBlue: {backgroundColor: c.blueSoft, color: c.blue},
    farmerRow: {flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 15, marginBottom: 9}, avatar: {width: 44, height: 44, borderRadius: 15, backgroundColor: c.greenSoft, justifyContent: 'center', alignItems: 'center'}, avatarText: {fontSize: 15, fontWeight: '900', color: c.green}, farmerBody: {flex: 1, minWidth: 0}, farmerName: {fontSize: 13, fontWeight: '800', color: c.ink}, farmerReference: {fontSize: 10, color: c.muted, marginTop: 3}, farmerProperty: {fontSize: 10, color: c.blue, marginTop: 5},
    emptyCard: {alignItems: 'center', justifyContent: 'center', paddingVertical: 29, paddingHorizontal: 20, borderWidth: 1, borderColor: c.line, borderRadius: 17, backgroundColor: c.surface, marginVertical: 5}, emptyIcon: {width: 42, height: 42, borderRadius: 15, backgroundColor: c.greenSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 10}, emptyGlyph: {fontSize: 22, fontWeight: '800', color: c.green}, emptyTitle: {fontSize: 14, fontWeight: '800', color: c.ink}, emptyDetail: {fontSize: 11, lineHeight: 17, color: c.muted, textAlign: 'center', marginTop: 5}, listFootnote: {fontSize: 10, textAlign: 'center', color: c.muted, marginVertical: 10},
    privacyCallout: {flexDirection: 'row', gap: 9, backgroundColor: c.blueSoft, borderRadius: 13, padding: 12, marginTop: 14, marginBottom: 8}, privacyGlyph: {fontSize: 17, color: c.blue, fontWeight: '700'}, privacyText: {flex: 1, fontSize: 10, lineHeight: 15, color: c.muted},
    detailHero: {padding: 17, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 17, marginBottom: 11}, detailHeroTop: {flexDirection: 'row', gap: 10, alignItems: 'flex-start'}, detailCode: {fontSize: 10, color: c.blue, fontWeight: '900', letterSpacing: 0.8}, detailTitle: {fontSize: 19, fontWeight: '800', color: c.ink, marginTop: 5}, detailSub: {fontSize: 11, color: c.muted, marginTop: 4}, detailMetrics: {flexDirection: 'row', marginTop: 17, paddingTop: 14, borderTopWidth: 1, borderTopColor: c.line, gap: 9}, detailMetric: {flex: 1}, detailMetricLabel: {fontSize: 9, color: c.muted, fontWeight: '600'}, detailMetricValue: {fontSize: 11, color: c.ink, fontWeight: '800', marginTop: 5},
    card: {padding: 16, borderRadius: 17, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, marginBottom: 11}, cardTitleBlock: {marginBottom: 15}, cardTitle: {fontSize: 15, fontWeight: '800', color: c.ink}, cardDetail: {fontSize: 10, lineHeight: 15, color: c.muted, marginTop: 4}, fieldLabel: {fontSize: 11, color: c.ink, fontWeight: '800', marginBottom: 6}, bodyText: {fontSize: 12, color: c.ink, lineHeight: 18}, contextStrip: {padding: 10, backgroundColor: c.blueSoft, borderRadius: 10, marginTop: 14}, contextStripText: {fontSize: 10, color: c.blue, lineHeight: 15}, input: {minHeight: 46, borderColor: c.line, borderWidth: 1, backgroundColor: c.surfaceAlt, color: c.ink, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 12}, multiline: {minHeight: 82, textAlignVertical: 'top'}, inputHint: {fontSize: 10, color: c.muted, marginTop: -2}, optionalText: {color: c.muted, fontWeight: '500'},
    photoGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 9}, photoCard: {width: '48.2%', backgroundColor: c.surfaceAlt, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: c.line}, photo: {width: '100%', height: 116, backgroundColor: c.surfaceAlt}, photoName: {fontSize: 9, color: c.muted, paddingHorizontal: 8, paddingVertical: 7}, photoUnavailable: {height: 116, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceAlt}, photoUnavailableGlyph: {fontSize: 25, color: c.muted}, photoUnavailableText: {fontSize: 10, color: c.muted, marginTop: 4},
    primaryButton: {height: 49, borderRadius: 13, backgroundColor: c.blue, alignItems: 'center', justifyContent: 'center', marginTop: 20}, primaryButtonText: {fontSize: 13, fontWeight: '800', color: '#FFFFFF'}, buttonDisabled: {opacity: 0.55}, buttonPressed: {opacity: 0.82}, readOnly: {backgroundColor: c.surfaceAlt, borderRadius: 11, padding: 12, marginTop: 15}, readOnlyText: {fontSize: 11, color: c.muted},
    profileCard: {padding: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 17, marginBottom: 14}, profileHero: {flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 12}, avatarLarge: {width: 58, height: 58, borderRadius: 19}, avatarTextLarge: {fontSize: 19, fontWeight: '900', color: c.green}, profileName: {fontSize: 16, fontWeight: '800', color: c.ink}, profileSub: {fontSize: 10, color: c.muted, marginTop: 4}, infoLine: {flexDirection: 'row', justifyContent: 'space-between', gap: 15, paddingTop: 11, paddingBottom: 3, marginTop: 8, borderTopWidth: 1, borderTopColor: c.line}, infoLabel: {fontSize: 10, color: c.muted}, infoValue: {flex: 1, textAlign: 'right', fontSize: 10, color: c.ink, fontWeight: '700'},
    propertyCard: {padding: 15, borderRadius: 15, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, marginBottom: 9}, propertyHeader: {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 5}, propertyPin: {width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: c.blueSoft}, propertyPinText: {fontSize: 20, color: c.blue}, propertyName: {fontSize: 13, fontWeight: '800', color: c.ink}, propertyArea: {fontSize: 10, color: c.muted, marginTop: 3}, consentLine: {fontSize: 10, color: c.green, marginTop: 10}, consentLineMuted: {fontSize: 10, lineHeight: 15, color: c.muted, marginTop: 10},
    themeOption: {minHeight: 61, borderTopColor: c.line, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 11}, radio: {width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: c.muted, alignItems: 'center', justifyContent: 'center'}, radioSelected: {borderColor: c.blue}, radioDot: {width: 10, height: 10, borderRadius: 5, backgroundColor: c.blue}, themeLabel: {fontSize: 12, fontWeight: '800', color: c.ink}, themeHelp: {fontSize: 10, color: c.muted, marginTop: 3}, themePreview: {fontSize: 20, color: c.blue, paddingHorizontal: 7}, scopeRow: {flexDirection: 'row', gap: 8, marginBottom: 11, alignItems: 'flex-start'}, scopeCheck: {fontSize: 14, color: c.green, fontWeight: '900'}, scopeText: {fontSize: 10, color: c.muted, lineHeight: 15, flex: 1}, signOutButton: {height: 47, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: c.red, backgroundColor: c.surface, marginTop: 5}, signOutText: {fontSize: 12, color: c.red, fontWeight: '800'}, versionText: {textAlign: 'center', color: c.muted, fontSize: 9, marginVertical: 15},
    loginKeyboard: {flex: 1}, loginScroll: {flexGrow: 1, justifyContent: 'center', paddingHorizontal: 21, paddingTop: 25}, loginBrand: {alignItems: 'center', marginBottom: 22}, brandMarkLarge: {width: 65, height: 65, borderRadius: 23, backgroundColor: c.greenSoft, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center'}, brandMarkLargeText: {fontSize: 31, fontWeight: '900', color: c.green}, brandLeafLarge: {position: 'absolute', top: 12, right: 12, width: 11, height: 7, borderRadius: 8, backgroundColor: c.green, transform: [{rotate: '-35deg'}]}, loginBrandName: {fontSize: 20, fontWeight: '900', color: c.ink, marginTop: 12, letterSpacing: 1}, loginBrandSub: {fontSize: 8, fontWeight: '800', color: c.muted, marginTop: 4, letterSpacing: 1.25}, loginCard: {padding: 22, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 21, shadowColor: c.shadow, shadowOpacity: 0.06, shadowRadius: 18, shadowOffset: {width: 0, height: 8}, elevation: 3}, loginEyebrow: {alignSelf: 'flex-start', backgroundColor: c.blueSoft, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6, marginBottom: 12}, loginEyebrowText: {fontSize: 9, fontWeight: '900', color: c.blue, letterSpacing: 0.8}, loginTitle: {fontSize: 25, fontWeight: '900', color: c.ink, letterSpacing: -0.5}, loginDetail: {fontSize: 12, lineHeight: 18, color: c.muted, marginTop: 7, marginBottom: 20}, loginError: {padding: 10, borderRadius: 10, backgroundColor: c.redSoft, marginBottom: 14}, loginErrorText: {fontSize: 11, color: c.red, lineHeight: 16}, loginSecurity: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderTopWidth: 1, borderTopColor: c.line, marginTop: 18, paddingTop: 15}, securityGlyph: {fontSize: 14, color: c.green}, loginSecurityText: {fontSize: 9, color: c.muted}, loginFoot: {textAlign: 'center', fontSize: 9, color: c.muted, marginTop: 17},
  });
}

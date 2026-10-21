import React, { useMemo, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { Choice, EmptyCard, LoadMoreButton, SearchInput, SectionIntro } from '../components/ui';
import { FieldReport, StaffVisit, VisitCheckingInput, VisitCheckingResult } from '../types';
import { Palette } from '../theme';
import { formatDate } from '../utils';

type VisitFilter = 'All' | 'Scheduled' | 'Completed' | 'Cancelled';
type VisitPayload = {
  scheduledAt: string;
  visitFindings: string;
  checkings: VisitCheckingInput[];
};

const CHECKING_LABELS = [
  'Visible plant symptoms',
  'Affected area estimate',
  'Crop growth stage and field condition',
  'Nearby sugarcane fields',
  'Farmer-reported changes since last visit',
];

const RESULT_OPTIONS: { value: VisitCheckingResult; label: string }[] = [
  { value: 'observed', label: 'Observed' },
  { value: 'not_observed', label: 'Not observed' },
  { value: 'checked', label: 'Checked' },
  { value: 'unable_to_check', label: 'Unable' },
];

function todayInput() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function checkingTemplate(existing: StaffVisit['checkings'] = []): VisitCheckingInput[] {
  const byLabel = new Map(existing.map(item => [item.label, item]));
  const labels = [...CHECKING_LABELS, ...existing.map(item => item.label).filter(label => !CHECKING_LABELS.includes(label))];
  return labels.map(label => {
    const previous = byLabel.get(label);
    return previous
      ? { label, result: previous.result, finding: previous.finding || '' }
      : { label, result: 'unable_to_check', finding: '' };
  });
}

export function VisitsScreen({
  visits,
  visitTotal,
  reports,
  reportTotal,
  online,
  loadingMore,
  refreshing,
  visitBusy,
  canManage,
  onLoadMore,
  onCreateVisit,
  onUpdateVisit,
  onOpenReport,
  styles,
  colors,
}: {
  visits: StaffVisit[];
  visitTotal: number;
  reports: FieldReport[];
  reportTotal: number;
  online: boolean;
  loadingMore: 'reports' | 'farmers' | 'visits' | null;
  refreshing: boolean;
  visitBusy: boolean;
  canManage: boolean;
  onLoadMore: (kind: 'reports' | 'farmers' | 'visits') => void;
  onCreateVisit: (reportId: number, values: VisitPayload) => Promise<StaffVisit | null>;
  onUpdateVisit: (visitId: number, values: VisitPayload & { status: StaffVisit['status'] }) => Promise<StaffVisit | null>;
  onOpenReport: (report: FieldReport | number) => void;
  styles: any;
  colors: Palette;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<VisitFilter>('All');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [reportId, setReportId] = useState<number | null>(null);
  const [scheduledAt, setScheduledAt] = useState(todayInput());
  const [scheduleFindings, setScheduleFindings] = useState('');
  const [editingVisitId, setEditingVisitId] = useState<number | null>(null);
  const [editScheduledAt, setEditScheduledAt] = useState('');
  const [visitFindings, setVisitFindings] = useState('');
  const [checkings, setCheckings] = useState<VisitCheckingInput[]>([]);

  const needle = query.trim().toLocaleLowerCase();
  const visibleVisits = useMemo(() => visits.filter(visit => {
    const statusMatch = filter === 'All' || visit.status.toLocaleLowerCase() === filter.toLocaleLowerCase();
    const textMatch = !needle || [visit.report_code, visit.farmer_name, visit.property_name, visit.province, visit.municipality, visit.staff_name]
      .some(value => value?.toLocaleLowerCase().includes(needle));
    return statusMatch && textMatch;
  }), [filter, needle, visits]);
  const visibleReports = useMemo(() => reports.filter(report => !needle || [report.code, report.farmer?.name, report.property_name, report.province, report.municipality]
    .some(value => value?.toLocaleLowerCase().includes(needle))), [needle, reports]);
  const scheduledCount = visits.filter(visit => visit.status === 'scheduled').length;
  const completedCount = visits.filter(visit => visit.status === 'completed').length;

  const startEditing = (visit: StaffVisit) => {
    setEditingVisitId(visit.id);
    setEditScheduledAt(visit.scheduled_at.slice(0, 10));
    setVisitFindings(visit.visit_findings || '');
    setCheckings(checkingTemplate(visit.checkings));
  };

  const submitSchedule = async () => {
    if (!reportId) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledAt)) {
      Alert.alert('Check the date', 'Enter the visit date as YYYY-MM-DD.');
      return;
    }
    const created = await onCreateVisit(reportId, {
      scheduledAt,
      visitFindings: scheduleFindings.trim(),
      checkings: [],
    });
    if (created) {
      setScheduleOpen(false);
      setReportId(null);
      setScheduleFindings('');
      setScheduledAt(todayInput());
    }
  };

  const saveVisit = async (visit: StaffVisit, status: StaffVisit['status']) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(editScheduledAt)) {
      Alert.alert('Check the date', 'Enter the visit date as YYYY-MM-DD.');
      return;
    }
    if (status === 'completed' && checkings.length === 0) {
      Alert.alert('Add visit checks', 'Record at least one check before completing the visit.');
      return;
    }
    const updated = await onUpdateVisit(visit.id, {
      status,
      scheduledAt: editScheduledAt,
      visitFindings: visitFindings.trim(),
      checkings,
    });
    if (updated) setEditingVisitId(null);
  };

  const cancelVisit = (visit: StaffVisit) => Alert.alert(
    'Cancel this visit?',
    'The visit will remain in the history as cancelled.',
    [
      { text: 'Keep visit', style: 'cancel' },
      { text: 'Cancel visit', style: 'destructive', onPress: () => void onUpdateVisit(visit.id, {
        status: 'cancelled',
        scheduledAt: visit.scheduled_at.slice(0, 10),
        visitFindings: visit.visit_findings || '',
        checkings: visit.checkings.map(item => ({ label: item.label, result: item.result, finding: item.finding || '' })),
      }) },
    ],
  );

  const setChecking = (index: number, patch: Partial<VisitCheckingInput>) => {
    setCheckings(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  const statusColor = (status: StaffVisit['status']) => status === 'completed' ? colors.green : status === 'cancelled' ? colors.muted : colors.amber;

  return (
    <View>
      <SectionIntro
        eyebrow="FIELD VISITS"
        title="Follow-up visits"
        detail={`${visitTotal} visit records · ${scheduledCount} scheduled · ${completedCount} completed in loaded records`}
        styles={styles}
      />

      <View style={{ marginBottom: 12, padding: 13, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
        <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '800' }}>Visit history</Text>
        <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 5 }}>
          Each visit belongs to a farmer report. Record what staff checked and found at that visit; farmer observations and SRA assessments remain separate.
        </Text>
      </View>

      {canManage ? (
        <Pressable onPress={() => setScheduleOpen(value => !value)} disabled={!online || visitBusy} style={{ marginBottom: 12, padding: 13, borderRadius: 10, alignItems: 'center', backgroundColor: colors.blue, opacity: online ? 1 : 0.55 }}>
          <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>{scheduleOpen ? 'Close scheduler' : '＋ Schedule follow-up visit'}</Text>
        </Pressable>
      ) : null}

      {scheduleOpen ? (
        <View style={{ marginBottom: 14, padding: 13, borderRadius: 12, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1 }}>
          <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '800', marginBottom: 5 }}>Choose a farmer report</Text>
          <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 16, marginBottom: 9 }}>A visit must be linked to an existing field report.</Text>
          {visibleReports.length ? visibleReports.slice(0, 20).map(report => (
            <Pressable key={report.id} onPress={() => setReportId(report.id)} style={{ padding: 10, marginBottom: 6, borderRadius: 9, borderWidth: 1, borderColor: reportId === report.id ? colors.blue : colors.line, backgroundColor: reportId === report.id ? colors.blueSoft : colors.surfaceAlt }}>
              <Text style={{ color: colors.ink, fontSize: 12, fontWeight: '800' }}>{report.code} · {report.property_name}</Text>
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 3 }}>{report.farmer?.name || 'Farmer'} · {report.municipality}, {report.province}</Text>
            </Pressable>
          )) : <Text style={{ color: colors.muted, fontSize: 12, paddingVertical: 8 }}>No loaded reports match your search. Load more reports from the Reports screen.</Text>}
          <Text style={{ color: colors.ink, fontSize: 12, fontWeight: '700', marginTop: 6 }}>Scheduled date (YYYY-MM-DD)</Text>
          <TextInput value={scheduledAt} onChangeText={setScheduledAt} placeholder="2026-10-22" placeholderTextColor={colors.muted} style={{ marginTop: 6, marginBottom: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 9, color: colors.ink, backgroundColor: colors.surfaceAlt }} />
          <TextInput value={scheduleFindings} onChangeText={setScheduleFindings} multiline placeholder="Purpose or preparation notes (optional)" placeholderTextColor={colors.muted} style={{ minHeight: 68, textAlignVertical: 'top', borderWidth: 1, borderColor: colors.line, borderRadius: 9, padding: 10, color: colors.ink, backgroundColor: colors.surfaceAlt }} />
          <Pressable onPress={() => void submitSchedule()} disabled={!online || visitBusy || !reportId} style={{ marginTop: 10, padding: 12, alignItems: 'center', borderRadius: 9, backgroundColor: colors.blue, opacity: !online || visitBusy || !reportId ? 0.5 : 1 }}>
            <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>{visitBusy ? 'Saving…' : 'Schedule visit'}</Text>
          </Pressable>
        </View>
      ) : null}

      <SearchInput value={query} onChange={setQuery} placeholder="Search report, farmer, farm or town" styles={styles} colors={colors} />
      <View style={styles.filterRow}>
        {(['All', 'Scheduled', 'Completed', 'Cancelled'] as VisitFilter[]).map(value => (
          <Choice key={value} label={value} selected={filter === value} onPress={() => setFilter(value)} styles={styles} />
        ))}
      </View>

      {visibleVisits.map(visit => {
        const editing = editingVisitId === visit.id;
        return (
          <View key={visit.id} style={{ marginBottom: 12, padding: 13, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.blue, fontSize: 11, fontWeight: '800' }}>{visit.report_code} · {visit.property_name}</Text>
                <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '800', marginTop: 4 }}>{visit.farmer_name}</Text>
                <Text style={{ color: colors.muted, fontSize: 11, marginTop: 3 }}>{visit.municipality}, {visit.province}</Text>
              </View>
              <Text style={{ color: statusColor(visit.status), fontSize: 11, fontWeight: '800', textTransform: 'capitalize' }}>{visit.status}</Text>
            </View>
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 9 }}>Scheduled · {formatDate(visit.scheduled_at)}{visit.completed_at ? `  ·  Completed ${formatDate(visit.completed_at)}` : ''}</Text>
            {visit.staff_name ? <Text style={{ color: colors.muted, fontSize: 10, marginTop: 3 }}>Assigned to {visit.staff_name}</Text> : null}
            {visit.completed_by_name ? <Text style={{ color: colors.muted, fontSize: 10, marginTop: 3 }}>Completed by {visit.completed_by_name}</Text> : null}
            {visit.visit_findings ? <Text style={{ color: colors.ink, fontSize: 12, lineHeight: 18, marginTop: 9 }}>{visit.visit_findings}</Text> : null}
            {visit.checkings.map(check => (
              <View key={check.id} style={{ marginTop: 8, padding: 9, borderRadius: 9, backgroundColor: colors.surfaceAlt }}>
                <Text style={{ color: colors.ink, fontSize: 11, fontWeight: '800' }}>{check.label} · {check.result.replaceAll('_', ' ')}</Text>
                {check.finding ? <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 }}>{check.finding}</Text> : null}
              </View>
            ))}

            {editing ? (
              <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 }}>
                <Text style={{ color: colors.ink, fontSize: 12, fontWeight: '800' }}>Visit date (YYYY-MM-DD)</Text>
                <TextInput value={editScheduledAt} onChangeText={setEditScheduledAt} placeholder="2026-10-22" placeholderTextColor={colors.muted} style={{ marginTop: 6, marginBottom: 10, borderWidth: 1, borderColor: colors.line, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 9, color: colors.ink, backgroundColor: colors.surfaceAlt }} />
                {checkings.map((check, index) => (
                  <View key={`${check.label}-${index}`} style={{ marginBottom: 11, padding: 10, borderRadius: 9, backgroundColor: colors.surfaceAlt }}>
                    <Text style={{ color: colors.ink, fontSize: 12, fontWeight: '800' }}>{check.label}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {RESULT_OPTIONS.map(option => (
                        <Pressable key={option.value} onPress={() => setChecking(index, { result: option.value })} style={{ paddingVertical: 6, paddingHorizontal: 8, borderRadius: 20, borderWidth: 1, borderColor: check.result === option.value ? colors.blue : colors.line, backgroundColor: check.result === option.value ? colors.blueSoft : colors.surface }}>
                          <Text style={{ color: check.result === option.value ? colors.blue : colors.muted, fontSize: 10, fontWeight: '700' }}>{option.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <TextInput value={check.finding} onChangeText={value => setChecking(index, { finding: value })} multiline placeholder="Finding or short note (optional)" placeholderTextColor={colors.muted} style={{ minHeight: 48, textAlignVertical: 'top', marginTop: 8, borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: 8, color: colors.ink, backgroundColor: colors.surface }} />
                  </View>
                ))}
                <Text style={{ color: colors.ink, fontSize: 12, fontWeight: '800', marginBottom: 6 }}>Overall visit findings</Text>
                <TextInput value={visitFindings} onChangeText={setVisitFindings} multiline placeholder="Summarize what staff observed and recommended for follow-up." placeholderTextColor={colors.muted} style={{ minHeight: 76, textAlignVertical: 'top', borderWidth: 1, borderColor: colors.line, borderRadius: 9, padding: 10, color: colors.ink, backgroundColor: colors.surfaceAlt }} />
                <Pressable onPress={() => void saveVisit(visit, 'scheduled')} disabled={!online || visitBusy} style={{ marginTop: 9, padding: 11, alignItems: 'center', borderRadius: 9, backgroundColor: colors.blue, opacity: !online || visitBusy ? 0.5 : 1 }}>
                  <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>{visitBusy ? 'Saving…' : 'Save visit checks'}</Text>
                </Pressable>
                <Pressable onPress={() => void saveVisit(visit, 'completed')} disabled={!online || visitBusy} style={{ marginTop: 7, padding: 11, alignItems: 'center', borderRadius: 9, backgroundColor: colors.green, opacity: !online || visitBusy ? 0.5 : 1 }}>
                  <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>Complete visit</Text>
                </Pressable>
                <Pressable onPress={() => setEditingVisitId(null)} style={{ marginTop: 7, padding: 9, alignItems: 'center' }}><Text style={{ color: colors.muted, fontWeight: '700' }}>Close editor</Text></Pressable>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              <Pressable onPress={() => onOpenReport(reports.find(report => report.id === visit.report_id) || visit.report_id)} style={{ paddingVertical: 8, paddingHorizontal: 11, borderRadius: 8, borderWidth: 1, borderColor: colors.line }}>
                <Text style={{ color: colors.blue, fontSize: 11, fontWeight: '800' }}>Open report</Text>
              </Pressable>
              {canManage && visit.status === 'scheduled' && !editing ? (
                <Pressable onPress={() => startEditing(visit)} disabled={!online} style={{ paddingVertical: 8, paddingHorizontal: 11, borderRadius: 8, backgroundColor: colors.blueSoft, opacity: online ? 1 : 0.5 }}>
                  <Text style={{ color: colors.blue, fontSize: 11, fontWeight: '800' }}>Record checkings</Text>
                </Pressable>
              ) : null}
              {canManage && visit.status === 'scheduled' ? (
                <Pressable onPress={() => cancelVisit(visit)} disabled={!online || visitBusy} style={{ paddingVertical: 8, paddingHorizontal: 11, borderRadius: 8, borderWidth: 1, borderColor: colors.line, opacity: online ? 1 : 0.5 }}>
                  <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '800' }}>Cancel visit</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        );
      })}

      {visibleVisits.length === 0 ? <EmptyCard title={filter === 'Scheduled' ? 'No scheduled visits' : 'No visit records found'} detail={online ? 'Schedule a follow-up from a farmer report or adjust your search.' : 'Cached visit history is available offline. Reconnect to refresh or record visits.'} styles={styles} /> : null}
      {visitTotal > visits.length ? (
        <LoadMoreButton label="Load more visits" busy={loadingMore === 'visits'} disabled={Boolean(loadingMore) || refreshing || !online} onPress={() => onLoadMore('visits')} styles={styles} colors={colors} />
      ) : null}
      {reportTotal > reports.length ? <Text style={styles.listFootnote}>{reports.length} of {reportTotal} reports are loaded for scheduling. Load more from Reports if needed.</Text> : null}
      {!online ? <Text style={[styles.listFootnote, { marginTop: 7 }]}>Visit changes require a connection. You can still review cached visit records offline.</Text> : null}
    </View>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { KeyboardAwareTextInput } from '../components/KeyboardAwareTextInput';
import {
  Choice,
  EmptyCard,
  LoadMoreButton,
  SearchInput,
  SectionIntro,
} from '../components/ui';
import { DatePickerField } from '../components/DatePickerField';
import { NumericStepperInput } from '../components/NumericStepperInput';
import {
  FieldReport,
  CropCharacteristics,
  StaffVisit,
  VisitCheckingInput,
  VisitCheckingResult,
} from '../types';
import { Palette } from '../theme';
import { formatDate } from '../utils';
import { reportIsCompleteWithoutVisit } from '../app/reportReview';
import type { PendingVisitChange } from '../offlineStore';

type VisitFilter = 'Scheduled' | 'Completed' | 'Cancelled';
type VisitPayload = {
  scheduledAt: string;
  visitFindings: string;
  checkings: VisitCheckingInput[];
  cropCharacteristics: CropCharacteristics;
};
type VisitCreatePayload = Omit<VisitPayload, 'cropCharacteristics'>;

const CROP_FIELDS: {
  key: 'leavesPerStalk' | 'plantHeight' | 'leafLength' | 'leafWidth' | 'tillers';
  label: string;
  unit: string;
}[] = [
  { key: 'leavesPerStalk', label: 'Leaves per stalk', unit: 'count' },
  { key: 'plantHeight', label: 'Plant height', unit: 'cm' },
  { key: 'leafLength', label: 'Leaf length', unit: 'cm' },
  { key: 'leafWidth', label: 'Leaf width', unit: 'cm' },
  { key: 'tillers', label: 'Tillers', unit: 'count' },
];

function emptyCropCharacteristics(): CropCharacteristics {
  return {
    leavesPerStalk: null,
    plantHeight: null,
    leafLength: null,
    leafWidth: null,
    tillers: null,
    measurementDate: null,
    cropVariety: null,
    growthStage: null,
    sampleCount: null,
  };
}

function cropValue(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function cropDisplay(value: number | null | undefined, unit: string) {
  return value == null ? null : `${value} ${unit}`;
}

type FarmHistoryGroup = {
  key: string;
  propertyId?: number | null;
  farmerName: string;
  propertyName: string;
  municipality: string;
  province: string;
  visits: StaffVisit[];
  reports: FieldReport[];
  latestReport: FieldReport | null;
};

export type FarmHistoryRequest = {
  requestId: number;
  reportId: number;
  propertyId?: number | null;
  farmerName?: string | null;
  propertyName: string;
  municipality: string | null;
  province: string;
};

type FarmHistoryTarget = FarmHistoryRequest & { key: string };

function placeLabelKey(
  farmer: string | null | undefined,
  property: string | null | undefined,
  municipality: string | null | undefined,
  province: string | null | undefined,
) {
  return [farmer, property, municipality, province]
    .map(value => value?.trim().toLocaleLowerCase() || '')
    .join('|');
}

function farmKey(
  propertyId: number | null | undefined,
  farmer: string | null | undefined,
  property: string | null | undefined,
  municipality: string | null | undefined,
  province: string | null | undefined,
) {
  return propertyId != null
    ? `property:${propertyId}`
    : placeLabelKey(farmer, property, municipality, province);
}

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

function checkingTemplate(
  existing: StaffVisit['checkings'] = [],
): VisitCheckingInput[] {
  const byLabel = new Map(existing.map(item => [item.label, item]));
  const labels = [
    ...CHECKING_LABELS,
    ...existing
      .map(item => item.label)
      .filter(label => !CHECKING_LABELS.includes(label)),
  ];
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
  pendingVisitChanges,
  onResolveVisitChange,
  canManage,
  onLoadMore,
  onCreateVisit,
  onUpdateVisit,
  onOpenReport,
  onHistoryBackHandlerChange,
  historyRequest,
  onHistoryRequestHandled,
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
  pendingVisitChanges: PendingVisitChange[];
  onResolveVisitChange: (
    changeId: string,
    choice: 'keep_local' | 'use_server',
  ) => void;
  canManage: boolean;
  onLoadMore: (kind: 'reports' | 'farmers' | 'visits') => void;
  onCreateVisit: (
    reportId: number,
    values: VisitCreatePayload,
  ) => Promise<StaffVisit | null>;
  onUpdateVisit: (
    visitId: number,
    values: VisitPayload & { status: StaffVisit['status'] },
  ) => Promise<StaffVisit | null>;
  onOpenReport: (report: FieldReport | number) => void;
  onHistoryBackHandlerChange: (handler: (() => boolean) | null) => void;
  historyRequest: FarmHistoryRequest | null;
  onHistoryRequestHandled: (requestId: number) => void;
  styles: any;
  colors: Palette;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<VisitFilter>('Scheduled');
  const [historyLocationKey, setHistoryLocationKey] = useState<string | null>(
    null,
  );
  const [historyTarget, setHistoryTarget] = useState<FarmHistoryTarget | null>(
    null,
  );
  const [historyReportId, setHistoryReportId] = useState<number | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [reportId, setReportId] = useState<number | null>(null);
  const [scheduledAt, setScheduledAt] = useState(todayInput());
  const [scheduleFindings, setScheduleFindings] = useState('');
  const [editingVisitId, setEditingVisitId] = useState<number | null>(null);
  const [editScheduledAt, setEditScheduledAt] = useState('');
  const [visitFindings, setVisitFindings] = useState('');
  const [checkings, setCheckings] = useState<VisitCheckingInput[]>([]);
  const [cropCharacteristics, setCropCharacteristics] =
    useState<CropCharacteristics>(emptyCropCharacteristics);

  useEffect(() => {
    onHistoryBackHandlerChange(() => {
      if (filter !== 'Completed' || !historyLocationKey) return false;
      if (historyReportId !== null) {
        setHistoryReportId(null);
        return true;
      }
      setHistoryLocationKey(null);
      setHistoryTarget(null);
      return true;
    });
    return () => onHistoryBackHandlerChange(null);
  }, [filter, historyLocationKey, historyReportId, onHistoryBackHandlerChange]);

  const needle = query.trim().toLocaleLowerCase();
  const farmHistoryGroups = useMemo(() => {
    const groups = new Map<string, FarmHistoryGroup>();
    const getGroup = (key: string, values: Partial<FarmHistoryGroup>) => {
      const existing = groups.get(key);
      if (existing) return existing;
      const created: FarmHistoryGroup = {
        key,
        propertyId: values.propertyId,
        farmerName: values.farmerName || 'Farmer',
        propertyName: values.propertyName || 'Farm',
        municipality: values.municipality || '',
        province: values.province || '',
        visits: [],
        reports: [],
        latestReport: null,
      };
      groups.set(key, created);
      return created;
    };
    const reportForVisit = (visit: StaffVisit) =>
      reports.find(report => report.id === visit.report_id);
    const completedVisits = visits.filter(
      visit => visit.status === 'completed',
    );
    const addCompletedReport = (
      group: FarmHistoryGroup,
      report: FieldReport,
    ) => {
      if (
        report.review_pending ||
        group.reports.some(item => item.id === report.id)
      )
        return;
      group.reports.push(report);
      group.reports.sort((a, b) =>
        (b.submitted_at || b.observed_at).localeCompare(
          a.submitted_at || a.observed_at,
        ),
      );
      group.latestReport = group.reports[0] || null;
    };

    completedVisits.forEach(visit => {
      const report = reportForVisit(visit);
      const key = farmKey(
        report?.property_id ?? visit.property_id,
        visit.farmer_name || report?.farmer?.name,
        visit.property_name || report?.property_name,
        visit.municipality || report?.municipality,
        visit.province || report?.province,
      );
      if (key === '|||') return;
      const group = getGroup(key, {
        propertyId: report?.property_id ?? visit.property_id,
        farmerName: visit.farmer_name || report?.farmer?.name,
        propertyName: visit.property_name || report?.property_name,
        municipality: visit.municipality || report?.municipality,
        province: visit.province || report?.province,
      });
      group.visits.push(visit);
      if (report) addCompletedReport(group, report);
    });

    reports
      .filter(report => {
        if (report.review_pending) return false;
        return (
          reportIsCompleteWithoutVisit(report) ||
          completedVisits.some(visit => visit.report_id === report.id)
        );
      })
      .forEach(report => {
        const key = farmKey(
          report.property_id,
          report.farmer?.name,
          report.property_name,
          report.municipality,
          report.province,
        );
        if (key === '|||') return;
        const group = getGroup(key, {
          propertyId: report.property_id,
          farmerName: report.farmer?.name,
          propertyName: report.property_name,
          municipality: report.municipality,
          province: report.province,
        });
        addCompletedReport(group, report);
      });

    if (historyTarget && !groups.has(historyTarget.key)) {
      groups.set(historyTarget.key, {
        key: historyTarget.key,
        propertyId: historyTarget.propertyId,
        farmerName: historyTarget.farmerName || 'Farmer',
        propertyName: historyTarget.propertyName || 'Farm',
        municipality: historyTarget.municipality || '',
        province: historyTarget.province || '',
        visits: [],
        reports: [],
        latestReport: null,
      });
    }

    return [...groups.values()].sort((a, b) =>
      `${a.farmerName} ${a.propertyName}`.localeCompare(
        `${b.farmerName} ${b.propertyName}`,
      ),
    );
  }, [historyTarget, reports, visits]);

  useEffect(() => {
    if (
      !historyRequest ||
      historyTarget?.requestId === historyRequest.requestId
    )
      return;
    const labelKey = placeLabelKey(
      historyRequest.farmerName,
      historyRequest.propertyName,
      historyRequest.municipality,
      historyRequest.province,
    );
    const existing = farmHistoryGroups.find(group =>
      historyRequest.propertyId != null && group.propertyId != null
        ? group.propertyId === historyRequest.propertyId
        : group.key === labelKey ||
          (group.propertyName.trim().toLocaleLowerCase() ===
            historyRequest.propertyName.trim().toLocaleLowerCase() &&
            group.municipality.trim().toLocaleLowerCase() ===
              (historyRequest.municipality || '').trim().toLocaleLowerCase() &&
            group.province.trim().toLocaleLowerCase() ===
              historyRequest.province.trim().toLocaleLowerCase()),
    );
    const key =
      existing?.key ||
      farmKey(
        historyRequest.propertyId,
        historyRequest.farmerName,
        historyRequest.propertyName,
        historyRequest.municipality,
        historyRequest.province,
      );
    setHistoryTarget({ ...historyRequest, key });
    setFilter('Completed');
    setQuery('');
    setHistoryReportId(null);
    setHistoryLocationKey(key);
    onHistoryRequestHandled(historyRequest.requestId);
  }, [
    farmHistoryGroups,
    historyRequest,
    historyTarget?.requestId,
    onHistoryRequestHandled,
  ]);
  const visibleVisits = useMemo(
    () =>
      visits.filter(visit => {
        const linkedReport = reports.find(
          report => report.id === visit.report_id,
        );
        const noDetection =
          linkedReport?.verification_status === 'No detection';
        const statusMatch =
          visit.status.toLocaleLowerCase() === filter.toLocaleLowerCase() &&
          !(noDetection && visit.status === 'scheduled');
        const textMatch =
          !needle ||
          [
            visit.report_code,
            visit.farmer_name,
            visit.property_name,
            visit.province,
            visit.municipality,
            visit.staff_name,
          ].some(value => value?.toLocaleLowerCase().includes(needle));
        return statusMatch && textMatch;
      }),
    [filter, historyLocationKey, needle, visits, reports],
  );
  const visibleReports = useMemo(
    () =>
      reports.filter(
        report =>
          !needle ||
          [
            report.code,
            report.farmer?.name,
            report.property_name,
            report.province,
            report.municipality,
          ].some(value => value?.toLocaleLowerCase().includes(needle)),
      ),
    [needle, reports],
  );
  const visibleFarmHistory = useMemo(() => {
    if (filter !== 'Completed') return [];
    return farmHistoryGroups.filter(group => {
      const textMatch =
        !needle ||
        [
          group.farmerName,
          group.propertyName,
          group.municipality,
          group.province,
          ...group.reports.map(report => report.code),
        ].some(value => value?.toLocaleLowerCase().includes(needle));
      return (
        textMatch && (!historyLocationKey || group.key === historyLocationKey)
      );
    });
  }, [farmHistoryGroups, filter, historyLocationKey, needle]);
  const selectedHistoryReport = useMemo(
    () =>
      visibleFarmHistory[0]?.reports.find(
        report => report.id === historyReportId,
      ) || null,
    [historyReportId, visibleFarmHistory],
  );
  const selectedReportVisits = useMemo(
    () =>
      historyReportId === null
        ? []
        : visits.filter(
            visit =>
              visit.report_id === historyReportId &&
              visit.status === 'completed',
          ).sort((a, b) =>
            (b.completed_at || b.scheduled_at).localeCompare(
              a.completed_at || a.scheduled_at,
            ),
          ),
    [historyReportId, visits],
  );
  const scheduledCount = visits.filter(
    visit => visit.status === 'scheduled',
  ).length;
  const completedCount = visits.filter(
    visit => visit.status === 'completed',
  ).length;

  const startEditing = (visit: StaffVisit) => {
    setEditingVisitId(visit.id);
    setEditScheduledAt(visit.scheduled_at.slice(0, 10));
    setVisitFindings(visit.visit_findings || '');
    setCheckings(checkingTemplate(visit.checkings));
    setCropCharacteristics(
      { ...emptyCropCharacteristics(), ...(visit.crop_characteristics || {}) },
    );
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
    if (cropCharacteristics.measurementDate && !/^\d{4}-\d{2}-\d{2}$/.test(cropCharacteristics.measurementDate)) {
      Alert.alert('Check measurement date', 'Enter the crop measurement date as YYYY-MM-DD.');
      return;
    }
    if (cropCharacteristics.sampleCount != null && (!Number.isInteger(cropCharacteristics.sampleCount) || cropCharacteristics.sampleCount < 1 || cropCharacteristics.sampleCount > 1000000)) {
      Alert.alert('Check sample count', 'Plants sampled must be a whole number from 1 to 1,000,000.');
      return;
    }
    if (status === 'completed' && checkings.length === 0) {
      Alert.alert(
        'Add visit checks',
        'Record at least one check before completing the visit.',
      );
      return;
    }
    const updated = await onUpdateVisit(visit.id, {
      status,
      scheduledAt: editScheduledAt,
      visitFindings: visitFindings.trim(),
      checkings,
      cropCharacteristics,
    });
    if (updated) setEditingVisitId(null);
  };

  const cancelVisit = (visit: StaffVisit) =>
    Alert.alert(
      'Cancel this visit?',
      'The visit will remain in the history as cancelled.',
      [
        { text: 'Keep visit', style: 'cancel' },
        {
          text: 'Cancel visit',
          style: 'destructive',
          onPress: () =>
            void onUpdateVisit(visit.id, {
              status: 'cancelled',
              scheduledAt: visit.scheduled_at.slice(0, 10),
              visitFindings: visit.visit_findings || '',
              checkings: visit.checkings.map(item => ({
                label: item.label,
                result: item.result,
                finding: item.finding || '',
              })),
              cropCharacteristics:
                visit.crop_characteristics || emptyCropCharacteristics(),
            }),
        },
      ],
    );

  const setChecking = (index: number, patch: Partial<VisitCheckingInput>) => {
    setCheckings(current =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  };

  const statusColor = (status: StaffVisit['status']) =>
    status === 'completed'
      ? colors.green
      : status === 'cancelled'
      ? colors.muted
      : colors.amber;

  return (
    <View>
      <SectionIntro
        eyebrow="FIELD VISITS"
        title="Follow-up visits"
        detail={`${visitTotal} visit records · ${scheduledCount} scheduled · ${completedCount} completed in loaded records`}
        styles={styles}
      />

      {pendingVisitChanges.length ? (
        <View
          style={{
            marginBottom: 12,
            padding: 12,
            borderRadius: 11,
            borderWidth: 1,
            borderColor: pendingVisitChanges.some(item => item.state === 'conflict')
              ? colors.amber
              : colors.line,
            backgroundColor: colors.surface,
          }}
        >
          <Text style={{ color: colors.ink, fontSize: 12, fontWeight: '800' }}>
            {pendingVisitChanges.length} visit change{pendingVisitChanges.length === 1 ? '' : 's'} on this device
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 4 }}>
            {online
              ? 'Changes without conflicts sync automatically while this device is online.'
              : 'Saved on this device. Changes will sync when the connection returns.'}
          </Text>
          {pendingVisitChanges.filter(item => item.state === 'conflict').map(change => (
            <View
              key={change.id}
              style={{
                marginTop: 9,
                padding: 10,
                borderRadius: 9,
                backgroundColor: colors.surfaceAlt,
                borderWidth: 1,
                borderColor: colors.line,
              }}
            >
              <Text style={{ color: colors.amber, fontSize: 11, fontWeight: '800' }}>
                Sync conflict · {change.localVisit.report_code || `Report ${change.reportId}`}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 4 }}>
                {change.conflictMessage || 'This visit changed on the server while you were offline.'}
              </Text>
              {change.remoteVisit ? (
                <Text style={{ color: colors.ink, fontSize: 11, lineHeight: 16, marginTop: 5 }}>
                  Server version: {formatDate(change.remoteVisit.scheduled_at)} · {change.remoteVisit.status}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 9 }}>
                {change.remoteVisit ? (
                  <Pressable
                    onPress={() => onResolveVisitChange(change.id, 'keep_local')}
                    style={{ paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: colors.blue }}
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>Keep my changes</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => onResolveVisitChange(change.id, 'use_server')}
                  style={{ paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.line }}
                >
                  <Text style={{ color: colors.blue, fontSize: 10, fontWeight: '800' }}>
                    {change.remoteVisit
                      ? 'Use server version'
                      : change.baseVisit
                      ? 'Restore last loaded version'
                      : 'Discard queued change'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {canManage ? (
        <Pressable
          onPress={() => setScheduleOpen(value => !value)}
          disabled={visitBusy}
          style={{
            marginBottom: 12,
            padding: 13,
            borderRadius: 10,
            alignItems: 'center',
            backgroundColor: colors.blue,
            opacity: visitBusy ? 0.55 : 1,
          }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>
            {scheduleOpen ? 'Close scheduler' : '＋ Schedule follow-up visit'}
          </Text>
        </Pressable>
      ) : null}

      {scheduleOpen ? (
        <View
          style={{
            marginBottom: 14,
            padding: 13,
            borderRadius: 12,
            backgroundColor: colors.surface,
            borderColor: colors.line,
            borderWidth: 1,
          }}
        >
          <Text
            style={{
              color: colors.ink,
              fontSize: 14,
              fontWeight: '800',
              marginBottom: 5,
            }}
          >
            Choose a farmer report
          </Text>
          <Text
            style={{
              color: colors.muted,
              fontSize: 11,
              lineHeight: 16,
              marginBottom: 9,
            }}
          >
            A visit must be linked to an existing field report.
          </Text>
          {visibleReports.length ? (
            visibleReports.slice(0, 20).map(report => (
              <Pressable
                key={report.id}
                onPress={() => setReportId(report.id)}
                style={{
                  padding: 10,
                  marginBottom: 6,
                  borderRadius: 9,
                  borderWidth: 1,
                  borderColor:
                    reportId === report.id ? colors.blue : colors.line,
                  backgroundColor:
                    reportId === report.id
                      ? colors.blueSoft
                      : colors.surfaceAlt,
                }}
              >
                <Text
                  style={{ color: colors.ink, fontSize: 12, fontWeight: '800' }}
                >
                  {report.code} · {report.property_name}
                </Text>
                <Text
                  style={{ color: colors.muted, fontSize: 11, marginTop: 3 }}
                >
                  {report.farmer?.name || 'Farmer'} · {report.municipality},{' '}
                  {report.province}
                </Text>
              </Pressable>
            ))
          ) : (
            <Text
              style={{ color: colors.muted, fontSize: 12, paddingVertical: 8 }}
            >
              No loaded reports match your search. Load more reports from the
              Reports screen.
            </Text>
          )}
          <Text
            style={{
              color: colors.ink,
              fontSize: 12,
              fontWeight: '700',
              marginTop: 6,
            }}
          >
            Scheduled date
          </Text>
          <View style={{ marginTop: 6, marginBottom: 10 }}>
            <DatePickerField
              value={scheduledAt}
              onChange={setScheduledAt}
              colors={colors}
              disabled={visitBusy}
            />
          </View>
          <KeyboardAwareTextInput
            value={scheduleFindings}
            onChangeText={setScheduleFindings}
            multiline
            placeholder="Purpose or preparation notes (optional)"
            placeholderTextColor={colors.muted}
            style={{
              minHeight: 68,
              textAlignVertical: 'top',
              borderWidth: 1,
              borderColor: colors.line,
              borderRadius: 9,
              padding: 10,
              color: colors.ink,
              backgroundColor: colors.surfaceAlt,
            }}
          />
          <Pressable
            onPress={() => void submitSchedule()}
            disabled={visitBusy || !reportId}
            style={{
              marginTop: 10,
              padding: 12,
              alignItems: 'center',
              borderRadius: 9,
              backgroundColor: colors.blue,
              opacity: visitBusy || !reportId ? 0.5 : 1,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>
              {visitBusy ? 'Saving…' : 'Schedule visit'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search report, farmer, farm or town"
        styles={styles}
        colors={colors}
      />
      <View style={styles.filterRow}>
        {(['Scheduled', 'Completed', 'Cancelled'] as VisitFilter[]).map(
          value => (
            <Choice
              key={value}
              label={
                value === 'Scheduled'
                  ? 'Upcoming'
                  : value === 'Completed'
                  ? 'History'
                  : value
              }
              selected={filter === value}
              onPress={() => {
                setFilter(value);
                setHistoryLocationKey(null);
                setHistoryTarget(null);
                setHistoryReportId(null);
              }}
              styles={styles}
            />
          ),
        )}
      </View>
      {filter === 'Completed' && historyLocationKey ? (
        <Pressable
          onPress={() => {
            if (historyReportId !== null) {
              setHistoryReportId(null);
            } else {
              setHistoryLocationKey(null);
              setHistoryTarget(null);
            }
          }}
          style={{
            marginBottom: 10,
            padding: 10,
            borderRadius: 9,
            backgroundColor: colors.blueSoft,
          }}
        >
          <Text style={{ color: colors.blue, fontSize: 11, fontWeight: '800' }}>
            {historyReportId !== null
              ? '← Previous reports'
              : '← All farms'}
          </Text>
        </Pressable>
      ) : null}

      {filter !== 'Completed'
        ? visibleVisits.map(visit => {
            const editing = editingVisitId === visit.id;
            return (
              <View
                key={visit.id}
                style={{
                  marginBottom: 12,
                  padding: 13,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.line,
                  backgroundColor: colors.surface,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colors.blue,
                        fontSize: 11,
                        fontWeight: '800',
                      }}
                    >
                      {visit.report_code} · {visit.property_name}
                    </Text>
                    <Text
                      style={{
                        color: colors.ink,
                        fontSize: 14,
                        fontWeight: '800',
                        marginTop: 4,
                      }}
                    >
                      {visit.farmer_name}
                    </Text>
                    <Text
                      style={{
                        color: colors.muted,
                        fontSize: 11,
                        marginTop: 3,
                      }}
                    >
                      {visit.municipality}, {visit.province}
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: statusColor(visit.status),
                      fontSize: 11,
                      fontWeight: '800',
                      textTransform: 'capitalize',
                    }}
                  >
                    {visit.status}
                  </Text>
                </View>
                {visit.sync_state ? (
                  <Text
                    style={{
                      color: visit.sync_state === 'conflict' ? colors.amber : colors.blue,
                      fontSize: 10,
                      fontWeight: '800',
                      marginTop: 7,
                    }}
                  >
                    {visit.sync_state === 'conflict' ? 'Needs conflict resolution' : 'Saved on device · waiting to sync'}
                  </Text>
                ) : null}
                <Text
                  style={{ color: colors.muted, fontSize: 11, marginTop: 9 }}
                >
                  Scheduled · {formatDate(visit.scheduled_at)}
                  {visit.completed_at
                    ? `  ·  Completed ${formatDate(visit.completed_at)}`
                    : ''}
                </Text>
                {visit.staff_name ? (
                  <Text
                    style={{ color: colors.muted, fontSize: 10, marginTop: 3 }}
                  >
                    Assigned to {visit.staff_name}
                  </Text>
                ) : null}
                {visit.completed_by_name ? (
                  <Text
                    style={{ color: colors.muted, fontSize: 10, marginTop: 3 }}
                  >
                    Completed by {visit.completed_by_name}
                  </Text>
                ) : null}
                {visit.visit_findings ? (
                  <Text
                    style={{
                      color: colors.ink,
                      fontSize: 12,
                      lineHeight: 18,
                      marginTop: 9,
                    }}
                  >
                    {visit.visit_findings}
                  </Text>
                ) : null}
                {visit.crop_characteristics ? (
                  <View
                    style={{
                      marginTop: 8,
                      padding: 9,
                      borderRadius: 9,
                      backgroundColor: colors.surfaceAlt,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.ink,
                        fontSize: 11,
                        fontWeight: '800',
                      }}
                    >
                      Crop characteristics
                    </Text>
                    <Text
                      style={{
                        color: colors.muted,
                        fontSize: 11,
                        lineHeight: 17,
                        marginTop: 3,
                      }}
                    >
                      {CROP_FIELDS.map(field => {
                        const value = cropDisplay(
                          visit.crop_characteristics?.[field.key],
                          field.unit,
                        );
                        return value ? `${field.label}: ${value}` : null;
                      })
                        .filter(Boolean)
                        .join(' · ') || 'No measurements recorded'}
                    </Text>
                    {visit.crop_characteristics.measurementDate || visit.crop_characteristics.cropVariety || visit.crop_characteristics.growthStage || visit.crop_characteristics.sampleCount != null ? (
                      <Text style={{ color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 4 }}>
                        {[visit.crop_characteristics.measurementDate ? `Measured ${formatDate(visit.crop_characteristics.measurementDate)}` : null, visit.crop_characteristics.cropVariety ? `Variety: ${visit.crop_characteristics.cropVariety}` : null, visit.crop_characteristics.growthStage ? `Stage: ${visit.crop_characteristics.growthStage}` : null, visit.crop_characteristics.sampleCount != null ? `Sample: ${visit.crop_characteristics.sampleCount} plants` : null].filter(Boolean).join(' · ')}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                {visit.checkings.map(check => (
                  <View
                    key={check.id}
                    style={{
                      marginTop: 8,
                      padding: 9,
                      borderRadius: 9,
                      backgroundColor: colors.surfaceAlt,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.ink,
                        fontSize: 11,
                        fontWeight: '800',
                      }}
                    >
                      {check.label} · {check.result.replaceAll('_', ' ')}
                    </Text>
                    {check.finding ? (
                      <Text
                        style={{
                          color: colors.muted,
                          fontSize: 11,
                          lineHeight: 16,
                          marginTop: 3,
                        }}
                      >
                        {check.finding}
                      </Text>
                    ) : null}
                  </View>
                ))}

                {editing ? (
                  <View
                    style={{
                      marginTop: 12,
                      borderTopWidth: 1,
                      borderTopColor: colors.line,
                      paddingTop: 12,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.ink,
                        fontSize: 12,
                        fontWeight: '800',
                      }}
                    >
                      Visit date
                    </Text>
                    <View style={{ marginTop: 6, marginBottom: 10 }}>
                      <DatePickerField
                        value={editScheduledAt}
                        onChange={setEditScheduledAt}
                        colors={colors}
                        disabled={visitBusy}
                      />
                    </View>
                    <Text
                      style={{
                        color: colors.ink,
                        fontSize: 12,
                        fontWeight: '800',
                        marginBottom: 6,
                      }}
                    >
                      Crop characteristics
                    </Text>
                    <Text
                      style={{
                        color: colors.muted,
                        fontSize: 10,
                        marginBottom: 8,
                      }}
                    >
                      Measure the stalk and leaves. Lengths and widths are in
                      centimeters.
                    </Text>
                    <View
                      style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        gap: 8,
                        marginBottom: 12,
                      }}
                    >
                      {CROP_FIELDS.map(field => (
                        <View key={field.key} style={{ width: '48%' }}>
                          <Text
                            style={{
                              color: colors.muted,
                              fontSize: 10,
                              fontWeight: '700',
                              marginBottom: 4,
                            }}
                          >
                            {field.label} ({field.unit})
                          </Text>
                          <NumericStepperInput
                            value={
                              cropCharacteristics[field.key] == null
                                ? ''
                                : String(cropCharacteristics[field.key])
                            }
                            onChangeText={value =>
                              setCropCharacteristics(current => ({
                                ...current,
                                [field.key]: cropValue(value),
                              }))
                            }
                            accessibilityLabel={field.label}
                            step={field.unit === 'count' ? 1 : 0.1}
                            integer={field.unit === 'count'}
                            keyboardType={field.unit === 'count' ? 'number-pad' : 'decimal-pad'}
                            placeholder="Optional"
                            placeholderTextColor={colors.muted}
                            textColor={colors.muted}
                            borderColor={colors.line}
                            backgroundColor={colors.surfaceAlt}
                            style={{
                              borderWidth: 1,
                              borderColor: colors.line,
                              borderRadius: 8,
                              padding: 9,
                              color: colors.ink,
                              backgroundColor: colors.surfaceAlt,
                            }}
                          />
                        </View>
                      ))}
                    </View>
                    <Text style={{ color: colors.muted, fontSize: 10, fontWeight: '700', marginBottom: 4 }}>Measurement date</Text>
                    <DatePickerField value={cropCharacteristics.measurementDate || ''} onChange={value => setCropCharacteristics(current => ({ ...current, measurementDate: value || null }))} colors={colors} disabled={visitBusy} />
                    <Text style={{ color: colors.muted, fontSize: 10, fontWeight: '700', marginTop: 8, marginBottom: 4 }}>Crop variety</Text>
                    <KeyboardAwareTextInput value={cropCharacteristics.cropVariety || ''} onChangeText={value => setCropCharacteristics(current => ({ ...current, cropVariety: value || null }))} maxLength={120} placeholder="If known" placeholderTextColor={colors.muted} style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: 9, color: colors.ink, backgroundColor: colors.surface }} />
                    <Text style={{ color: colors.muted, fontSize: 10, fontWeight: '700', marginTop: 8, marginBottom: 4 }}>Crop growth stage</Text>
                    <KeyboardAwareTextInput value={cropCharacteristics.growthStage || ''} onChangeText={value => setCropCharacteristics(current => ({ ...current, growthStage: value || null }))} maxLength={80} placeholder="For example, tillering" placeholderTextColor={colors.muted} style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: 9, color: colors.ink, backgroundColor: colors.surface }} />
                    <Text style={{ color: colors.muted, fontSize: 10, fontWeight: '700', marginTop: 8, marginBottom: 4 }}>Plants sampled</Text>
                    <KeyboardAwareTextInput value={cropCharacteristics.sampleCount == null ? '' : String(cropCharacteristics.sampleCount)} onChangeText={value => setCropCharacteristics(current => ({ ...current, sampleCount: value.replace(/\D/g, '') ? Number(value.replace(/\D/g, '')) : null }))} keyboardType="number-pad" placeholder="Optional count" placeholderTextColor={colors.muted} style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: 9, color: colors.ink, backgroundColor: colors.surface }} />
                    <View style={{ marginTop: 16, marginBottom: 10, paddingTop: 13, borderTopWidth: 1, borderTopColor: colors.line }}>
                      <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '800' }}>Field checks</Text>
                      <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 4 }}>
                        Choose the result for each check. Add a short finding when useful.
                      </Text>
                    </View>
                    {checkings.map((check, index) => (
                      <View
                        key={`${check.label}-${index}`}
                        style={{
                          marginBottom: 11,
                          padding: 10,
                          borderRadius: 9,
                          backgroundColor: colors.surfaceAlt,
                        }}
                      >
                        <Text
                          style={{
                            color: colors.ink,
                            fontSize: 12,
                            fontWeight: '800',
                          }}
                        >
                          {check.label}
                        </Text>
                        <View
                          style={{
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            gap: 8,
                            marginTop: 10,
                          }}
                        >
                          {RESULT_OPTIONS.map(option => (
                            <Pressable
                              key={option.value}
                              accessibilityRole="radio"
                              accessibilityState={{
                                checked: check.result === option.value,
                              }}
                              onPress={() =>
                                setChecking(index, { result: option.value })
                              }
                              style={{
                                flexGrow: 1,
                                flexBasis: '46%',
                                minHeight: 42,
                                paddingVertical: 9,
                                paddingHorizontal: 10,
                                borderRadius: 9,
                                borderWidth: 1,
                                borderColor:
                                  check.result === option.value
                                    ? colors.blue
                                    : colors.line,
                                backgroundColor:
                                  check.result === option.value
                                    ? colors.blueSoft
                                    : colors.surface,
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Text
                                style={{
                                  color:
                                    check.result === option.value
                                      ? colors.blue
                                      : colors.muted,
                                  fontSize: 11,
                                  fontWeight:
                                    check.result === option.value ? '800' : '600',
                                  textAlign: 'center',
                                }}
                              >
                                {check.result === option.value
                                  ? `✓ ${option.label}`
                                  : option.label}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                        <KeyboardAwareTextInput
                          value={check.finding}
                          onChangeText={value =>
                            setChecking(index, { finding: value })
                          }
                          multiline
                        accessibilityLabel={`${check.label} finding`}
                        placeholder="Finding or short note (optional)"
                          placeholderTextColor={colors.muted}
                          style={{
                            minHeight: 48,
                            textAlignVertical: 'top',
                            marginTop: 8,
                            borderWidth: 1,
                            borderColor: colors.line,
                            borderRadius: 8,
                            padding: 8,
                            color: colors.ink,
                            backgroundColor: colors.surface,
                          }}
                        />
                      </View>
                    ))}
                    <Text
                      style={{
                        color: colors.ink,
                        fontSize: 12,
                        fontWeight: '800',
                        marginBottom: 6,
                      }}
                    >
                      Overall visit findings
                    </Text>
                    <KeyboardAwareTextInput
                      value={visitFindings}
                      onChangeText={setVisitFindings}
                      multiline
                      placeholder="Summarize what staff observed and recommended for follow-up."
                      placeholderTextColor={colors.muted}
                      style={{
                        minHeight: 76,
                        textAlignVertical: 'top',
                        borderWidth: 1,
                        borderColor: colors.line,
                        borderRadius: 9,
                        padding: 10,
                        color: colors.ink,
                        backgroundColor: colors.surfaceAlt,
                      }}
                    />
                    <Pressable
                      onPress={() => void saveVisit(visit, 'scheduled')}
                      disabled={visitBusy}
                      style={{
                        marginTop: 9,
                        padding: 11,
                        alignItems: 'center',
                        borderRadius: 9,
                        backgroundColor: colors.blue,
                        opacity: visitBusy ? 0.5 : 1,
                      }}
                    >
                      <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>
                        {visitBusy ? 'Saving…' : 'Save visit checks'}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void saveVisit(visit, 'completed')}
                      disabled={visitBusy}
                      style={{
                        marginTop: 7,
                        padding: 11,
                        alignItems: 'center',
                        borderRadius: 9,
                        backgroundColor: colors.green,
                        opacity: visitBusy ? 0.5 : 1,
                      }}
                    >
                      <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>
                        Complete visit
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setEditingVisitId(null)}
                      style={{ marginTop: 7, padding: 9, alignItems: 'center' }}
                    >
                      <Text style={{ color: colors.muted, fontWeight: '700' }}>
                        Close editor
                      </Text>
                    </Pressable>
                  </View>
                ) : null}

                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 8,
                    marginTop: 12,
                  }}
                >
                  <Pressable
                    onPress={() =>
                      onOpenReport(
                        reports.find(report => report.id === visit.report_id) ||
                          visit.report_id,
                      )
                    }
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 11,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: colors.line,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.blue,
                        fontSize: 11,
                        fontWeight: '800',
                      }}
                    >
                      Open report
                    </Text>
                  </Pressable>
                  {canManage && visit.status === 'scheduled' && !editing ? (
                    <Pressable
                      onPress={() => startEditing(visit)}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 11,
                        borderRadius: 8,
                        backgroundColor: colors.blueSoft,
                        opacity: 1,
                      }}
                    >
                      <Text
                        style={{
                          color: colors.blue,
                          fontSize: 11,
                          fontWeight: '800',
                        }}
                      >
                        Record checks
                      </Text>
                    </Pressable>
                  ) : null}
                  {canManage && visit.status === 'scheduled' ? (
                    <Pressable
                      onPress={() => cancelVisit(visit)}
                      disabled={visitBusy}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 11,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: colors.line,
                        opacity: visitBusy ? 0.5 : 1,
                      }}
                    >
                      <Text
                        style={{
                          color: colors.muted,
                          fontSize: 11,
                          fontWeight: '800',
                        }}
                      >
                        Cancel visit
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })
        : null}

      {filter === 'Completed' && !historyLocationKey
        ? visibleFarmHistory.map(group => (
            <Pressable
              key={group.key}
              onPress={() => setHistoryLocationKey(group.key)}
              style={{
                marginBottom: 11,
                padding: 13,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.line,
                backgroundColor: colors.surface,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: colors.ink,
                      fontSize: 14,
                      fontWeight: '800',
                    }}
                  >
                    {group.propertyName}
                  </Text>
                  <Text
                    style={{ color: colors.muted, fontSize: 11, marginTop: 3 }}
                  >
                    {group.farmerName} ·{' '}
                    {[group.municipality, group.province]
                      .filter(Boolean)
                      .join(', ')}
                  </Text>
                </View>
                <Text
                  style={{
                    color: colors.blue,
                    fontSize: 11,
                    fontWeight: '800',
                  }}
                >
                  {group.visits.length}{' '}
                  {group.visits.length === 1 ? 'visit' : 'visits'}
                </Text>
              </View>
              {group.latestReport ? (
                <View
                  style={{
                    marginTop: 10,
                    padding: 9,
                    borderRadius: 9,
                    backgroundColor: colors.surfaceAlt,
                  }}
                >
                  <Text
                    style={{
                      color: colors.muted,
                      fontSize: 10,
                      fontWeight: '700',
                    }}
                  >
                    LATEST COMPLETED REPORT
                  </Text>
                  <Text
                    style={{
                      color: colors.ink,
                      fontSize: 12,
                      fontWeight: '800',
                      marginTop: 3,
                    }}
                  >
                    {group.latestReport.code} ·{' '}
                    {group.latestReport.verification_status}
                  </Text>
                  <Text
                    style={{ color: colors.muted, fontSize: 10, marginTop: 2 }}
                  >
                    {formatDate(
                      group.latestReport.submitted_at ||
                        group.latestReport.observed_at,
                    )}
                  </Text>
                </View>
              ) : null}
              <Text
                style={{
                  color: colors.blue,
                  fontSize: 11,
                  fontWeight: '800',
                  marginTop: 9,
                }}
              >
                View farm history →
              </Text>
            </Pressable>
          ))
        : null}

      {filter === 'Completed' && historyLocationKey && visibleFarmHistory[0] ? (
        <View
          style={{
            marginBottom: 12,
            padding: 13,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.line,
            backgroundColor: colors.surface,
          }}
        >
          <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '800' }}>
            {visibleFarmHistory[0].farmerName} ·{' '}
            {visibleFarmHistory[0].propertyName}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11, marginTop: 3 }}>
            {[
              visibleFarmHistory[0].municipality,
              visibleFarmHistory[0].province,
            ]
              .filter(Boolean)
              .join(', ')}{' '}
            · {visibleFarmHistory[0].visits.length} completed{' '}
            {visibleFarmHistory[0].visits.length === 1 ? 'visit' : 'visits'}
          </Text>
          {visibleFarmHistory[0].latestReport && historyReportId === null ? (
            <Pressable
              onPress={() => onOpenReport(visibleFarmHistory[0].latestReport!)}
              style={{
                marginTop: 10,
                padding: 10,
                borderRadius: 9,
                backgroundColor: colors.blueSoft,
              }}
            >
              <Text
                style={{ color: colors.blue, fontSize: 10, fontWeight: '800' }}
              >
                LATEST COMPLETED REPORT
              </Text>
              <Text
                style={{
                  color: colors.ink,
                  fontSize: 12,
                  fontWeight: '800',
                  marginTop: 3,
                }}
              >
                {visibleFarmHistory[0].latestReport!.code} ·{' '}
                {visibleFarmHistory[0].latestReport!.verification_status}
              </Text>
              <Text
                style={{
                  color: colors.blue,
                  fontSize: 10,
                  fontWeight: '700',
                  marginTop: 4,
                }}
              >
                Open report
              </Text>
            </Pressable>
          ) : visibleFarmHistory[0].visits.length === 0 ? (
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 10 }}>
              No completed reports or visits have been recorded for this farm
              yet.
            </Text>
          ) : null}
        </View>
      ) : null}
      {filter === 'Completed' &&
      historyLocationKey &&
      historyReportId === null &&
      visibleFarmHistory[0]?.reports.length > 1 ? (
        <View
          style={{
            marginBottom: 12,
            marginLeft: 8,
            paddingLeft: 11,
            borderLeftWidth: 2,
            borderLeftColor: colors.blueSoft,
          }}
        >
          <Text
            style={{
              color: colors.blue,
              fontSize: 10,
              fontWeight: '800',
              marginBottom: 7,
              letterSpacing: 0.5,
            }}
          >
            PREVIOUS REPORTS
          </Text>
          {visibleFarmHistory[0].reports
            .filter(
              report => report.id !== visibleFarmHistory[0].latestReport?.id,
            )
            .map(report => {
              return (
                <View
                  key={`previous-report-${report.id}`}
                  style={{
                    marginBottom: 8,
                    marginLeft: 4,
                    padding: 11,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: colors.line,
                    backgroundColor: colors.surface,
                  }}
                >
                  <Text
                    style={{
                      color: colors.ink,
                      fontSize: 12,
                      fontWeight: '800',
                    }}
                  >
                    {report.code} · {report.verification_status}
                  </Text>
                  <Text
                    style={{ color: colors.muted, fontSize: 10, marginTop: 3 }}
                  >
                    Completed report ·{' '}
                    {formatDate(report.submitted_at || report.observed_at)}
                  </Text>
                  <View
                    style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
                  >
                    <Pressable
                      onPress={() => onOpenReport(report)}
                      style={{
                        alignSelf: 'flex-start',
                        marginTop: 8,
                        paddingVertical: 7,
                        paddingHorizontal: 10,
                        borderRadius: 8,
                        backgroundColor: colors.blueSoft,
                      }}
                    >
                      <Text
                        style={{
                          color: colors.blue,
                          fontSize: 11,
                          fontWeight: '800',
                        }}
                      >
                        Open report
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`View completed visits for report ${report.code}`}
                      onPress={() => setHistoryReportId(report.id)}
                      style={{
                        alignSelf: 'flex-start',
                        marginTop: 8,
                        paddingVertical: 7,
                        paddingHorizontal: 10,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: colors.line,
                        backgroundColor: colors.surface,
                      }}
                    >
                      <Text
                        style={{
                          color: colors.ink,
                          fontSize: 11,
                          fontWeight: '800',
                        }}
                      >
                        Previous visits
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
        </View>
      ) : null}
      {filter === 'Completed' &&
      historyLocationKey &&
      historyReportId !== null &&
      selectedHistoryReport ? (
        <View
          style={{
            marginBottom: 12,
            padding: 12,
            borderRadius: 11,
            borderWidth: 1,
            borderColor: colors.line,
            backgroundColor: colors.surface,
          }}
        >
          <Text
            style={{
              color: colors.blue,
              fontSize: 10,
              fontWeight: '800',
              marginBottom: 7,
              letterSpacing: 0.5,
            }}
          >
            PREVIOUS REPORT
          </Text>
          <Text style={{ color: colors.ink, fontSize: 12, fontWeight: '800' }}>
            {selectedHistoryReport.code} ·{' '}
            {selectedHistoryReport.verification_status}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 10, marginTop: 3 }}>
            {formatDate(
              selectedHistoryReport.submitted_at ||
                selectedHistoryReport.observed_at,
            )}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Pressable
              onPress={() => onOpenReport(selectedHistoryReport)}
              style={{
                alignSelf: 'flex-start',
                marginTop: 8,
                paddingVertical: 7,
                paddingHorizontal: 10,
                borderRadius: 8,
                backgroundColor: colors.blueSoft,
              }}
            >
              <Text
                style={{ color: colors.blue, fontSize: 11, fontWeight: '800' }}
              >
                Open report
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setHistoryReportId(null)}
              style={{
                alignSelf: 'flex-start',
                marginTop: 8,
                paddingVertical: 7,
                paddingHorizontal: 10,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.line,
                backgroundColor: colors.surface,
              }}
            >
              <Text
                style={{ color: colors.ink, fontSize: 11, fontWeight: '800' }}
              >
                Back to previous reports
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {filter === 'Completed' && historyReportId !== null ? (
        <View
          style={{
            marginBottom: 12,
            marginLeft: 8,
            paddingLeft: 11,
            borderLeftWidth: 2,
            borderLeftColor: colors.green,
          }}
        >
          <Text
            style={{
              color: colors.green,
              fontSize: 10,
              fontWeight: '800',
              marginBottom: 7,
              letterSpacing: 0.5,
            }}
          >
            VISIT HISTORY FOR THIS REPORT
          </Text>
          {selectedReportVisits.length ? (
            selectedReportVisits.map(visit => (
              <View
                key={`history-${visit.id}`}
                style={{
                  marginBottom: 9,
                  marginLeft: 4,
                  padding: 12,
                  borderRadius: 11,
                  borderWidth: 1,
                  borderColor: colors.line,
                  backgroundColor: colors.surface,
                }}
              >
                <Text
                  style={{ color: colors.blue, fontSize: 11, fontWeight: '800' }}
                >
                  {visit.report_code}
                </Text>
                <Text
                  style={{
                    color: colors.ink,
                    fontSize: 12,
                    fontWeight: '800',
                    marginTop: 4,
                  }}
                >
                  Completed {formatDate(visit.completed_at || visit.scheduled_at)}
                </Text>
                <Text
                  style={{ color: colors.muted, fontSize: 10, marginTop: 3 }}
                >
                  Scheduled {formatDate(visit.scheduled_at)}
                </Text>
                {visit.staff_name ? (
                  <Text
                    style={{ color: colors.muted, fontSize: 10, marginTop: 4 }}
                  >
                    Assigned staff: {visit.staff_name}
                  </Text>
                ) : null}
                {visit.completed_by_name ? (
                  <Text
                    style={{ color: colors.muted, fontSize: 10, marginTop: 3 }}
                  >
                    Completed by: {visit.completed_by_name}
                  </Text>
                ) : null}
                {visit.visit_findings ? (
                  <Text
                    style={{
                      color: colors.muted,
                      fontSize: 11,
                      lineHeight: 16,
                      marginTop: 5,
                    }}
                  >
                    {visit.visit_findings}
                  </Text>
                ) : null}
                {visit.checkings.map(check => (
                  <Text
                    key={check.id}
                    style={{ color: colors.muted, fontSize: 10, marginTop: 5 }}
                  >
                    {check.label}: {check.result.replaceAll('_', ' ')}
                    {check.finding ? ` · ${check.finding}` : ''}
                  </Text>
                ))}
              </View>
            ))
          ) : (
            <Text style={{ color: colors.muted, fontSize: 11, marginLeft: 4 }}>
              No completed visits are linked to this report.
            </Text>
          )}
        </View>
      ) : null}

      {filter !== 'Completed' && visibleVisits.length === 0 ? (
        <EmptyCard
          title={
            filter === 'Scheduled'
              ? 'No upcoming visits'
              : 'No visit records found'
          }
          detail={
            online
              ? 'Schedule a follow-up from a farmer report or adjust your search.'
              : 'Cached visit history is available offline. Reconnect to refresh or record visits.'
          }
          styles={styles}
        />
      ) : null}
      {filter === 'Completed' && visibleFarmHistory.length === 0 ? (
        <EmptyCard
          title="No farm history yet"
          detail="Completed visits and reports marked no detection or no visit needed will appear here, grouped by farm."
          styles={styles}
        />
      ) : null}
      {visitTotal > visits.length ? (
        <LoadMoreButton
          label="Load more visits"
          busy={loadingMore === 'visits'}
          disabled={Boolean(loadingMore) || refreshing || !online}
          onPress={() => onLoadMore('visits')}
          styles={styles}
          colors={colors}
        />
      ) : null}
      {reportTotal > reports.length ? (
        filter === 'Completed' ? (
          <LoadMoreButton
            label={`Load more reports (${reports.length} of ${reportTotal})`}
            busy={loadingMore === 'reports'}
            disabled={Boolean(loadingMore) || refreshing || !online}
            onPress={() => onLoadMore('reports')}
            styles={styles}
            colors={colors}
          />
        ) : (
          <Text style={styles.listFootnote}>
            {reports.length} of {reportTotal} reports are loaded. Load more from
            Reports if needed.
          </Text>
        )
      ) : null}
      {!online ? (
        <Text style={[styles.listFootnote, { marginTop: 7 }]}>
          Visit edits, checks, and scheduling are saved on this device while
          offline. Pending changes sync when connection returns; resolve any
          conflicts shown above before considering them saved to the workspace.
        </Text>
      ) : null}
    </View>
  );
}

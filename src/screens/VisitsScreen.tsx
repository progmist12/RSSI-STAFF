import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import {
  Choice,
  EmptyCard,
  LoadMoreButton,
  ReportRow,
  SearchInput,
  SectionIntro,
} from '../components/ui';
import { FieldReport } from '../types';
import { Palette } from '../theme';
import { formatDate } from '../utils';

type VisitFilter = 'All visits' | 'Follow-up set' | 'For verification';

export function VisitsScreen({
  reports,
  reportTotal,
  online,
  loadingMore,
  refreshing,
  onLoadMore,
  onOpenReport,
  styles,
  colors,
}: {
  reports: FieldReport[];
  reportTotal: number;
  online: boolean;
  loadingMore: 'reports' | 'farmers' | null;
  refreshing: boolean;
  onLoadMore: (kind: 'reports' | 'farmers') => void;
  onOpenReport: (report: FieldReport) => void;
  styles: any;
  colors: Palette;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<VisitFilter>('All visits');

  const followUpCount = reports.filter(report => report.follow_up_at).length;
  const visibleReports = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return [...reports]
      .filter(report => {
        const matchesFilter =
          filter === 'All visits' ||
          (filter === 'Follow-up set'
            ? Boolean(report.follow_up_at)
            : report.verification_status === 'For verification');
        const matchesSearch =
          !needle ||
          [
            report.code,
            report.property_name,
            report.farmer?.name,
            report.province,
            report.municipality,
            report.barangay,
          ].some(value => value?.toLocaleLowerCase().includes(needle));
        return matchesFilter && matchesSearch;
      })
      .sort(
        (left, right) =>
          new Date(right.observed_at).getTime() -
          new Date(left.observed_at).getTime(),
      );
  }, [filter, query, reports]);

  return (
    <View>
      <SectionIntro
        eyebrow="FIELD VISITS"
        title="Visit records"
        detail={`${reportTotal} field observations · ${followUpCount} follow-up dates in loaded records`}
        styles={styles}
      />

      <View
        style={{
          marginBottom: 12,
          padding: 13,
          borderRadius: 12,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.line,
        }}
      >
        <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '800' }}>
          Field activity
        </Text>
        <Text
          style={{
            color: colors.muted,
            fontSize: 11,
            lineHeight: 16,
            marginTop: 5,
          }}
        >
          Visit records are based on submitted field reports. Follow-up dates
          are the dates saved in each report review.
        </Text>
      </View>

      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search farmer, farm, report or town"
        styles={styles}
        colors={colors}
      />

      <View style={styles.filterRow}>
        {(
          ['All visits', 'Follow-up set', 'For verification'] as VisitFilter[]
        ).map(value => (
          <Choice
            key={value}
            label={value}
            selected={filter === value}
            onPress={() => setFilter(value)}
            styles={styles}
          />
        ))}
      </View>

      {visibleReports.map(report => (
        <View key={report.id}>
          <ReportRow
            report={report}
            onPress={() => onOpenReport(report)}
            styles={styles}
            compact
          />
          <View
            style={{
              marginTop: -4,
              marginBottom: 12,
              paddingHorizontal: 12,
              paddingVertical: 9,
              borderBottomLeftRadius: 10,
              borderBottomRightRadius: 10,
              backgroundColor: colors.surface,
              borderColor: colors.line,
              borderWidth: 1,
              borderTopWidth: 0,
              flexDirection: 'row',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <Text style={{ color: colors.muted, fontSize: 10 }}>
              Observed {formatDate(report.observed_at)}
            </Text>
            <Text
              numberOfLines={1}
              style={{ color: colors.blue, fontSize: 10, fontWeight: '700' }}
            >
              {report.follow_up_at
                ? `Follow-up · ${formatDate(report.follow_up_at)}`
                : 'No follow-up date'}
            </Text>
          </View>
        </View>
      ))}

      {visibleReports.length === 0 ? (
        <EmptyCard
          title={
            filter === 'Follow-up set'
              ? 'No follow-ups found'
              : 'No visit records found'
          }
          detail={
            online
              ? 'Try another search or filter, or load more field reports.'
              : 'Your saved field reports remain available offline.'
          }
          styles={styles}
        />
      ) : null}

      {reportTotal > reports.length ? (
        <>
          <LoadMoreButton
            label="Load more visit records"
            busy={loadingMore === 'reports'}
            disabled={Boolean(loadingMore) || refreshing || !online}
            onPress={() => onLoadMore('reports')}
            styles={styles}
            colors={colors}
          />
          <Text style={styles.listFootnote}>
            Showing {reports.length} of {reportTotal} field reports. Visit
            records use the observed date provided with each report.
          </Text>
        </>
      ) : null}
    </View>
  );
}

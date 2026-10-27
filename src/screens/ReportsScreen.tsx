import React from 'react';
import { Text, View } from 'react-native';
import { FieldReport, Farmer } from '../types';
import {
  Choice,
  EmptyCard,
  FarmerRow,
  LoadMoreButton,
  ReportRow,
  SearchInput,
  SectionIntro,
} from '../components/ui';

export function ReportsScreen({
  reports,
  reportTotal,
  listFilter,
  setListFilter,
  search,
  setSearch,
  online,
  loadingMore,
  refreshing,
  onLoadMore,
  onOpenReport,
  styles,
  colors,
}: any) {
  const statuses = [
    'Needs review',
    'Reviewed',
    'Confirmed',
    'Upcoming',
    'Completed',
    'All',
  ];
  return (
    <View>
      <SectionIntro
        eyebrow="TRIAGE QUEUE"
        title="Reports from the field"
        detail={`${reportTotal} reports in your province scope`}
        styles={styles}
      />
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search report, farmer or town"
        styles={styles}
        colors={colors}
      />
      <View style={styles.filterRow}>
        {statuses.map(value => (
          <Choice
            key={value}
            label={value}
            selected={listFilter === value}
            onPress={() => setListFilter(value)}
            styles={styles}
          />
        ))}
      </View>
      {reports.map((report: FieldReport) => (
        <ReportRow
          key={report.id}
          report={report}
          onPress={() => onOpenReport(report)}
          styles={styles}
          colors={colors}
        />
      ))}
      {reports.length === 0 && (
        <EmptyCard
          title="No reports found"
          detail={
            online
              ? 'Try another search or filter.'
              : 'Connect to the internet to load your report queue.'
          }
          styles={styles}
        />
      )}
      {reportTotal > reports.length && (
        <>
          <LoadMoreButton
            label="Load more reports"
            busy={loadingMore === 'reports'}
            disabled={Boolean(loadingMore) || refreshing || !online}
            onPress={() => onLoadMore('reports')}
            styles={styles}
            colors={colors}
          />
          <Text style={styles.listFootnote}>
            Showing {reports.length} of {reportTotal} reports. Search and
            filters apply to loaded reports.
          </Text>
        </>
      )}
    </View>
  );
}

export function FarmersScreen({
  farmers,
  farmerTotal,
  search,
  setSearch,
  online,
  loadingMore,
  refreshing,
  onLoadMore,
  onOpenFarmer,
  styles,
  colors,
}: any) {
  return (
    <View>
      <SectionIntro
        eyebrow="FARMER DIRECTORY"
        title="Farmers in your scope"
        detail={`${farmerTotal} accounts · private details are access controlled`}
        styles={styles}
      />
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search name, reference or farm"
        styles={styles}
        colors={colors}
      />
      {farmers.map((farmer: Farmer) => (
        <FarmerRow
          key={farmer.id}
          farmer={farmer}
          onPress={() => onOpenFarmer(farmer)}
          styles={styles}
          colors={colors}
        />
      ))}
      {farmers.length === 0 && (
        <EmptyCard
          title="No farmers found"
          detail={
            online
              ? 'Try a different name or farm.'
              : 'Farmer records load when the app is online.'
          }
          styles={styles}
        />
      )}
      {farmerTotal > farmers.length && (
        <>
          <LoadMoreButton
            label="Load more farmers"
            busy={loadingMore === 'farmers'}
            disabled={Boolean(loadingMore) || refreshing || !online}
            onPress={() => onLoadMore('farmers')}
            styles={styles}
            colors={colors}
          />
          <Text style={styles.listFootnote}>
            Showing {farmers.length} of {farmerTotal} farmers. Search applies to
            loaded farmers.
          </Text>
        </>
      )}
    </View>
  );
}

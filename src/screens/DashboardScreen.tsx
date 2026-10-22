import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { FieldReport } from '../types';
import { EmptyCard, MetricCard, ReportRow } from '../components/ui';
export function Dashboard({
  reports,
  pendingTotal,
  reportTotal,
  farmerTotal,
  severeTotal,
  styles,
  colors,
  onOpenReports,
  onOpenPending,
  onOpenFarmers,
  onSelectReport,
  refreshing,
}: any) {
  const recent = reports.slice(0, 5);
  return (
    <View>
      <View style={styles.welcomePanel}>
        <View style={{ flex: 1 }}>
          <Text style={styles.welcomeEyebrow}>FIELD MONITORING</Text>
          <Text style={styles.welcomeTitle}>Good day, team</Text>
          <Text style={styles.welcomeDetail}>
            Review incoming observations and keep the regional picture up to
            date.
          </Text>
        </View>
        <View style={styles.welcomeGraphic}>
          <Text style={styles.welcomeGraphicText}>RSSI</Text>
          <Text style={styles.welcomeGraphicSub}>SRA</Text>
        </View>
      </View>
      <View style={styles.metricGrid}>
        <MetricCard
          label="Needs review"
          value={pendingTotal}
          hint="Pending verification"
          tone="blue"
          styles={styles}
          onPress={onOpenPending}
        />
        <MetricCard
          label="Total reports"
          value={reportTotal}
          hint="Province scoped"
          tone="green"
          styles={styles}
          onPress={onOpenReports}
        />
        <MetricCard
          label="Farmers"
          value={farmerTotal}
          hint="Active directory"
          tone="amber"
          styles={styles}
          onPress={onOpenFarmers}
        />
        <MetricCard
          label="Severe reports"
          value={severeTotal}
          hint="Latest 50 reports"
          tone="red"
          styles={styles}
          onPress={onOpenReports}
        />
      </View>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Recent reports</Text>
          <Text style={styles.sectionDetail}>
            Latest farmer observations in your assigned area
          </Text>
        </View>
        <Pressable onPress={onOpenReports}>
          <Text style={styles.textLink}>View all ›</Text>
        </Pressable>
      </View>
      {recent.map((report: FieldReport) => (
        <ReportRow
          key={report.id}
          report={report}
          onPress={() => onSelectReport(report)}
          styles={styles}
          colors={colors}
          compact
        />
      ))}
      {!recent.length && (
        <EmptyCard
          title={refreshing ? 'Loading reports…' : 'Your queue is clear'}
          detail="New farmer observations will appear here."
          styles={styles}
        />
      )}
    </View>
  );
}

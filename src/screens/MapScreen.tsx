import React, { useMemo, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import {
  Camera,
  Map,
  Marker,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import { StaffMapLocation, StaffMapReport } from '../types';
import { Palette } from '../theme';
import { formatDate } from '../utils';

type VisibleLocation = StaffMapLocation & {
  visibleReports: StaffMapReport[];
};

const provinceOptions = [
  'Both provinces',
  'Negros Occidental',
  'Negros Oriental',
];
const statusOptions = ['All', 'For verification', 'Confirmed', 'No detection'];

function markerColor(status: string | undefined, colors: Palette) {
  if (status === 'Confirmed') return colors.green;
  if (status === 'No detection') return colors.blue;
  return colors.amber;
}

export function MapScreen({
  locations,
  totalReports,
  colors,
  onOpenReport,
  online,
}: {
  locations: StaffMapLocation[];
  totalReports: number;
  colors: Palette;
  onOpenReport: (reportId: number) => void;
  online: boolean;
}) {
  const [query, setQuery] = useState('');
  const [provinceIndex, setProvinceIndex] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [zoom, setZoom] = useState(8.2);
  const camera = useRef<CameraRef>(null);
  const [mapFailed, setMapFailed] = useState(false);

  const filteredLocations = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return locations
      .map((location, index) => {
        if (
          provinceIndex !== 0 &&
          location.province !== provinceOptions[provinceIndex]
        ) {
          return null;
        }
        const placeMatches =
          !needle ||
          `${location.title} ${location.detail} ${location.municipality || ''}`
            .toLocaleLowerCase()
            .includes(needle);
        let visibleReports = location.reports.filter(
          report =>
            statusIndex === 0 ||
            report.verification_status === statusOptions[statusIndex],
        );
        if (needle && !placeMatches) {
          visibleReports = visibleReports.filter(report =>
            `${report.code} ${report.property_name}`
              .toLocaleLowerCase()
              .includes(needle),
          );
        }
        if (!visibleReports.length) return null;
        return {
          ...location,
          key: `${location.location_type}-${location.province}-${location.municipality || location.title}-${index}`,
          visibleReports,
        };
      })
      .filter((location): location is VisibleLocation & { key: string } =>
        Boolean(location),
      );
  }, [locations, provinceIndex, query, statusIndex]);

  const selected =
    filteredLocations.find(location => location.key === selectedKey) ||
    filteredLocations[0];
  const visibleReportCount = filteredLocations.reduce(
    (total, location) => total + location.visibleReports.length,
    0,
  );
  const cycleProvince = () =>
    setProvinceIndex(index => (index + 1) % provinceOptions.length);
  const cycleStatus = () =>
    setStatusIndex(index => (index + 1) % statusOptions.length);

  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingTop: 18,
        paddingBottom: 20,
        gap: 13,
      }}
    >
      <View>
        <Text style={{ color: colors.ink, fontSize: 24, fontWeight: '800' }}>
          Negros coverage
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 5 }}>
          All submitted reports appear at a consented farm pin or an approximate
          municipality center.
        </Text>
      </View>

      <TextInput
        accessibilityLabel="Search map reports"
        value={query}
        onChangeText={setQuery}
        placeholder="Search municipality, property or report"
        placeholderTextColor={colors.muted}
        style={{
          minHeight: 46,
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: 10,
          paddingHorizontal: 13,
          backgroundColor: colors.surface,
          color: colors.ink,
          fontSize: 12,
        }}
      />

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable onPress={cycleProvince} style={filterStyle(colors)}>
          <Text numberOfLines={1} style={filterText(colors)}>
            {provinceOptions[provinceIndex]}
          </Text>
          <Text style={{ color: colors.muted }}>⌄</Text>
        </Pressable>
        <Pressable onPress={cycleStatus} style={filterStyle(colors)}>
          <Text numberOfLines={1} style={filterText(colors)}>
            Status: {statusOptions[statusIndex]}
          </Text>
          <Text style={{ color: colors.muted }}>⌄</Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: colors.ink, fontSize: 12, fontWeight: '700' }}>
          {visibleReportCount} of {totalReports} reports
        </Text>
        <Text style={{ color: colors.muted, fontSize: 11 }}>
          {filteredLocations.length} map locations
        </Text>
      </View>

      <View
        style={{
          height: 292,
          borderRadius: 14,
          overflow: 'hidden',
          backgroundColor: '#E8F1EF',
          borderWidth: 1,
          borderColor: colors.line,
        }}
      >
        <Map
          style={{ flex: 1 }}
          mapStyle="https://tiles.openfreemap.org/styles/liberty"
          attribution
          attributionPosition={{ bottom: 8, right: 8 }}
          logo={false}
          compass
          compassPosition={{ top: 10, left: 10 }}
          onRegionDidChange={(event: { nativeEvent: { zoom: number } }) =>
            setZoom(event.nativeEvent.zoom)
          }
          onDidFinishLoadingMap={() => setMapFailed(false)}
          onDidFailLoadingMap={() => setMapFailed(true)}
        >
          <Camera
            ref={camera}
            initialViewState={{ center: [122.9, 10.25], zoom: 8.2 }}
            minZoom={6}
            maxZoom={18}
          />
          {filteredLocations.map(location => {
            const latest = location.visibleReports[0];
            const color = markerColor(latest?.verification_status, colors);
            const isSelected = selected?.key === location.key;
            return (
              <Marker
                key={location.key}
                id={location.key}
                lngLat={[location.longitude, location.latitude]}
                onPress={() => setSelectedKey(location.key)}
                anchor="center"
              >
                <View
                  style={{
                    minWidth: isSelected ? 25 : 22,
                    height: isSelected ? 25 : 22,
                    paddingHorizontal: 4,
                    borderRadius: 14,
                    backgroundColor: color,
                    borderWidth: isSelected ? 3 : 2,
                    borderColor: '#FFFFFF',
                    elevation: 4,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '900' }}
                  >
                    {location.visibleReports.length}
                  </Text>
                </View>
              </Marker>
            );
          })}
        </Map>
        {mapFailed ? (
          <View
            style={{
              position: 'absolute',
              left: 10,
              right: 58,
              top: 10,
              padding: 8,
              borderRadius: 8,
              backgroundColor: '#FFFFFFE8',
            }}
          >
            <Text style={{ color: '#27364B', fontSize: 11 }}>
              {online
                ? 'Map tiles could not load. Check your connection and try again.'
                : 'Basemap needs internet. Your cached report markers remain available.'}
            </Text>
          </View>
        ) : null}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 8,
            bottom: 8,
            paddingHorizontal: 6,
            paddingVertical: 3,
            borderRadius: 4,
            backgroundColor: '#FFFFFFE8',
          }}
        >
          <Text style={{ color: '#27364B', fontSize: 9 }}>
            © OpenStreetMap contributors
          </Text>
        </View>
        <View style={{ position: 'absolute', right: 10, top: 66, gap: 6 }}>
          <MapControl
            label="Zoom in"
            text="+"
            colors={colors}
            onPress={() => {
              const nextZoom = Math.min(18, zoom + 1);
              setZoom(nextZoom);
              camera.current?.zoomTo(nextZoom, { duration: 250 });
            }}
          />
          <MapControl
            label="Zoom out"
            text="−"
            colors={colors}
            onPress={() => {
              const nextZoom = Math.max(6, zoom - 1);
              setZoom(nextZoom);
              camera.current?.zoomTo(nextZoom, { duration: 250 });
            }}
          />
          <MapControl
            label="Reset map view"
            text="◎"
            colors={colors}
            onPress={() => {
              camera.current?.flyTo({
                center: [122.9, 10.25],
                zoom: 8.2,
                duration: 500,
              });
              setZoom(8.2);
            }}
          />
        </View>
      </View>

      <View
        style={{
          padding: 12,
          borderRadius: 12,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.line,
        }}
      >
        <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '800' }}>
          SRA report status
        </Text>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 12,
            marginTop: 9,
          }}
        >
          {[
            ['Confirmed', colors.green],
            ['For verification', colors.amber],
            ['No detection', colors.blue],
          ].map(([label, color]) => (
            <View
              key={label}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
            >
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: color,
                }}
              />
              <Text style={{ color: colors.muted, fontSize: 10 }}>{label}</Text>
            </View>
          ))}
        </View>
        <Text
          style={{
            color: colors.muted,
            fontSize: 10,
            lineHeight: 15,
            marginTop: 8,
          }}
        >
          Farm pins appear only when location consent and staff permissions
          allow. Other reports are grouped at municipality centers. Tap a pin to
          open any report there. Basemap tiles need internet; saved report
          locations remain available offline.
        </Text>
      </View>

      <View
        style={{
          padding: 14,
          borderRadius: 14,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.line,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '800' }}>
            Reports at this location
          </Text>
          <Text style={{ color: colors.blue, fontSize: 11, fontWeight: '700' }}>
            {selected?.visibleReports.length || 0}
          </Text>
        </View>
        {selected ? (
          <>
            <Text
              style={{
                color: colors.ink,
                fontSize: 16,
                fontWeight: '800',
                marginTop: 10,
              }}
            >
              {selected.title}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
              {selected.detail}
              {selected.location_type !== 'consented_farm'
                ? ' · approximate location'
                : ''}
            </Text>
            {selected.visibleReports.map(report => (
              <View
                key={report.id}
                style={{
                  marginTop: 10,
                  padding: 10,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.line,
                  backgroundColor: colors.background,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <Text
                    style={{ color: colors.ink, fontSize: 12, fontWeight: '800' }}
                  >
                    {report.code}
                  </Text>
                  <Text
                    style={{ color: colors.muted, fontSize: 10, flexShrink: 1 }}
                  >
                    {report.verification_status}
                  </Text>
                </View>
                <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>
                  Observed {formatDate(report.observed_at)} ·{' '}
                  {report.farmer_severity}
                  {report.farmer_severity_range
                    ? ` · ${report.farmer_severity_range}`
                    : ''}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onOpenReport(report.id)}
                  style={{
                    marginTop: 8,
                    backgroundColor: colors.blue,
                    paddingVertical: 9,
                    borderRadius: 8,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 11 }}
                  >
                    Open {report.code}
                  </Text>
                </Pressable>
              </View>
            ))}
          </>
        ) : (
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 9 }}>
            {totalReports
              ? 'No reports match these filters. Choose another province or status.'
              : 'No field reports have been submitted yet.'}
          </Text>
        )}
      </View>
    </View>
  );
}

function filterStyle(colors: Palette) {
  return {
    minHeight: 44,
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    gap: 6,
  };
}

function filterText(colors: Palette) {
  return { color: colors.ink, fontSize: 11, flex: 1 };
}

function MapControl({
  label,
  text,
  colors,
  onPress,
}: {
  label: string;
  text: string;
  colors: Palette;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.line,
      }}
    >
      <Text style={{ color: colors.blue, fontSize: 21, fontWeight: '600' }}>
        {text}
      </Text>
    </Pressable>
  );
}

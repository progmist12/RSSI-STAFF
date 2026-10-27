import React, { useMemo, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import {
  Camera,
  Map,
  Marker,
  type CameraRef,
  type MapRef,
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
const statusOptions = ['All', 'For verification'];
const DEFAULT_MAP_CENTER: [number, number] = [122.9, 10.25];
const DEFAULT_MAP_ZOOM = 7.7;
function normalizedSeverity(severity: string | null | undefined) {
  if (severity === 'Low') return 'Mild';
  return severity || 'Not assessed';
}

function severityColor(severity: string | null | undefined) {
  switch (normalizedSeverity(severity)) {
    case 'Mild':
      return '#2563EB';
    case 'Moderate':
      return '#EAB308';
    case 'Severe':
      return '#F97316';
    case 'Highly severe':
      return '#DC2626';
    default:
      return '#16A34A';
  }
}

function severityRange(severity: string | null | undefined) {
  switch (normalizedSeverity(severity)) {
    case 'Mild':
      return '1–20%';
    case 'Moderate':
      return '21–50%';
    case 'Severe':
      return '51–70%';
    case 'Highly severe':
      return '71–100%';
    default:
      return null;
  }
}

function MapScreenView({
  locations,
  colors,
  onOpenReport,
  onViewFarmerHistory,
  online,
  onMapGestureChange,
}: {
  locations: StaffMapLocation[];
  colors: Palette;
  onOpenReport: (reportId: number) => void;
  onViewFarmerHistory: (
    report: StaffMapReport,
    location: StaffMapLocation,
  ) => void;
  online: boolean;
  onMapGestureChange: (active: boolean) => void;
}) {
  const [query, setQuery] = useState('');
  const [provinceIndex, setProvinceIndex] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);
  const [openFilter, setOpenFilter] = useState<'province' | 'status' | null>(
    null,
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [zoom, setZoom] = useState(DEFAULT_MAP_ZOOM);
  const camera = useRef<CameraRef>(null);
  const map = useRef<MapRef>(null);
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const [calloutPoint, setCalloutPoint] = useState<{
    x: number;
    y: number;
  } | null>(null);
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
        const noReport = location.reports.length === 0;
        if (needle && !placeMatches) {
          visibleReports = visibleReports.filter(report =>
            `${report.code} ${report.property_name}`
              .toLocaleLowerCase()
              .includes(needle),
          );
        }
        if (noReport && !placeMatches) return null;
        if (!visibleReports.length && (!noReport || statusIndex !== 0))
          return null;
        return {
          ...location,
          key: `${location.location_type}-${location.province}-${
            location.municipality || location.title
          }-${index}`,
          visibleReports,
        };
      })
      .filter((location): location is VisibleLocation & { key: string } =>
        Boolean(location),
      )
      .sort(
        (left, right) =>
          Number(left.visibleReports.length === 0) -
          Number(right.visibleReports.length === 0),
      );
  }, [locations, provinceIndex, query, statusIndex]);

  const visibleReportCount = filteredLocations.reduce(
    (total, location) => total + location.visibleReports.length,
    0,
  );
  const selectedLocation = filteredLocations.find(
    location => location.key === selectedKey,
  );
  const calloutWidth = 195;
  const calloutHeight = 64;
  const calloutLeft = calloutPoint
    ? Math.max(
        6,
        Math.min(
          calloutPoint.x - calloutWidth / 2,
          mapSize.width - calloutWidth - 6,
        ),
      )
    : 6;
  const calloutTop = calloutPoint
    ? calloutPoint.y >= calloutHeight + 12
      ? calloutPoint.y - calloutHeight - 10
      : calloutPoint.y + 12
    : 6;
  const updateCalloutPoint = (location: VisibleLocation & { key: string }) => {
    void map.current
      ?.project([location.longitude, location.latitude])
      .then(([x, y]) => setCalloutPoint({ x, y }));
  };
  const focusLocation = (location: VisibleLocation & { key: string }) => {
    setSelectedKey(location.key);
    setCalloutPoint(null);
    const nextZoom = Math.max(zoom, 10.5);
    setZoom(nextZoom);
    camera.current?.flyTo({
      center: [location.longitude, location.latitude],
      zoom: nextZoom,
      duration: 500,
    });
    // Project after the camera animation too; the first region event can fire
    // before React has rendered the newly selected location.
    setTimeout(() => updateCalloutPoint(location), 600);
  };
  const chooseProvince = (index: number) => {
    setProvinceIndex(index);
    setOpenFilter(null);
    setSelectedKey(null);
    setCalloutPoint(null);
  };
  const chooseStatus = (index: number) => {
    setStatusIndex(index);
    setOpenFilter(null);
    setSelectedKey(null);
    setCalloutPoint(null);
  };

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
          Reports are grouped by farm or approximate municipality. Filter by
          status to show all reports or only those awaiting verification.
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
        <View
          style={{
            flex: 1,
            zIndex: openFilter === 'province' ? 30 : 10,
          }}
        >
          <FilterDropdown
            value={provinceOptions[provinceIndex]}
            options={provinceOptions}
            selectedIndex={provinceIndex}
            expanded={openFilter === 'province'}
            colors={colors}
            onToggle={() =>
              setOpenFilter(openFilter === 'province' ? null : 'province')
            }
            onSelect={chooseProvince}
          />
        </View>
        <View
          style={{
            flex: 1,
            zIndex: openFilter === 'status' ? 30 : 10,
          }}
        >
          <FilterDropdown
            value={`Status: ${statusOptions[statusIndex]}`}
            options={statusOptions}
            selectedIndex={statusIndex}
            expanded={openFilter === 'status'}
            colors={colors}
            onToggle={() =>
              setOpenFilter(openFilter === 'status' ? null : 'status')
            }
            onSelect={chooseStatus}
          />
        </View>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: colors.ink, fontSize: 12, fontWeight: '700' }}>
          {visibleReportCount}{' '}
          {statusIndex === 0 ? 'reports shown' : 'reports for verification'}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 11 }}>
          {filteredLocations.length} map locations
        </Text>
      </View>

      <View
        onLayout={({ nativeEvent }) =>
          setMapSize({
            width: nativeEvent.layout.width,
            height: nativeEvent.layout.height,
          })
        }
        onTouchStart={() => onMapGestureChange(true)}
        onTouchEnd={() => onMapGestureChange(false)}
        onTouchCancel={() => onMapGestureChange(false)}
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
          ref={map}
          style={{ flex: 1 }}
          mapStyle="https://tiles.openfreemap.org/styles/liberty"
          androidView="texture"
          dragPan
          touchZoom
          doubleTapZoom
          doubleTapHoldZoom
          touchRotate={false}
          touchPitch={false}
          attribution
          attributionPosition={{ bottom: 8, right: 8 }}
          logo={false}
          compass
          compassPosition={{ top: 10, left: 10 }}
          onRegionDidChange={(event: { nativeEvent: { zoom: number } }) => {
            setZoom(event.nativeEvent.zoom);
            if (selectedLocation) updateCalloutPoint(selectedLocation);
          }}
          onDidFinishLoadingMap={() => setMapFailed(false)}
          onDidFailLoadingMap={() => setMapFailed(true)}
        >
          <Camera
            ref={camera}
            initialViewState={{
              center: DEFAULT_MAP_CENTER,
              zoom: DEFAULT_MAP_ZOOM,
            }}
            minZoom={6}
            maxZoom={22}
          />
          {filteredLocations.map(location => {
            const latest = location.visibleReports[0];
            const color = severityColor(latest?.farmer_severity);
            const isSelected = selectedKey === location.key;
            return (
              <Marker
                key={location.key}
                id={location.key}
                lngLat={[location.longitude, location.latitude]}
                onPress={() => focusLocation(location)}
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
                    style={{
                      color:
                        latest?.farmer_severity === 'Moderate'
                          ? '#1F2937'
                          : '#FFFFFF',
                      fontSize: 9,
                      fontWeight: '900',
                    }}
                  >
                    {location.visibleReports.length}
                  </Text>
                </View>
              </Marker>
            );
          })}
        </Map>
        {selectedLocation && calloutPoint ? (
          <View
            style={{
              position: 'absolute',
              left: calloutLeft,
              top: calloutTop,
              width: calloutWidth,
              padding: 10,
              borderRadius: 11,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.line,
              elevation: 10,
              zIndex: 20,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 6,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  numberOfLines={1}
                  style={{ color: colors.ink, fontSize: 12, fontWeight: '800' }}
                >
                  {selectedLocation.title}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ color: colors.muted, fontSize: 10, marginTop: 2 }}
                >
                  {selectedLocation.detail}
                  {selectedLocation.location_type !== 'consented_farm'
                    ? ' · approximate'
                    : ''}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close marker details"
                onPress={() => {
                  setSelectedKey(null);
                  setCalloutPoint(null);
                }}
                hitSlop={6}
              >
                <Text
                  style={{ color: colors.muted, fontSize: 19, lineHeight: 20 }}
                >
                  ×
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
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
              const nextZoom = Math.min(22, zoom + 1);
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
                center: DEFAULT_MAP_CENTER,
                zoom: DEFAULT_MAP_ZOOM,
                duration: 500,
              });
              setZoom(DEFAULT_MAP_ZOOM);
            }}
          />
        </View>
      </View>
      {selectedLocation ? (
        <View
          style={{
            padding: 14,
            borderRadius: 14,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.line,
            gap: 10,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text
              style={{ color: colors.ink, fontSize: 15, fontWeight: '800' }}
            >
              Reports at this location
            </Text>
            <Text
              style={{ color: colors.blue, fontSize: 11, fontWeight: '700' }}
            >
              {selectedLocation.visibleReports.length}
            </Text>
          </View>
          <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '800' }}>
            {selectedLocation.title}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11, marginTop: -7 }}>
            {selectedLocation.detail}
            {selectedLocation.location_type !== 'consented_farm'
              ? ' · approximate location'
              : ''}
          </Text>
          {selectedLocation.visibleReports[0] ? (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                onViewFarmerHistory(
                  selectedLocation.visibleReports[0],
                  selectedLocation,
                )
              }
              style={{
                paddingVertical: 10,
                borderRadius: 9,
                alignItems: 'center',
                backgroundColor: colors.blueSoft,
              }}
            >
              <Text
                style={{ color: colors.blue, fontSize: 11, fontWeight: '800' }}
              >
                View farmer history
              </Text>
            </Pressable>
          ) : null}
          {selectedLocation.visibleReports.length ? (
            selectedLocation.visibleReports.map(report => (
              <View
                key={report.id}
                style={{
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
                    style={{
                      color: colors.ink,
                      fontSize: 12,
                      fontWeight: '800',
                    }}
                  >
                    {report.code}
                  </Text>
                  <Text
                    style={{ color: colors.muted, fontSize: 10, flexShrink: 1 }}
                  >
                    {report.verification_status}
                  </Text>
                </View>
                <Text
                  style={{ color: colors.muted, fontSize: 10, marginTop: 4 }}
                >
                  Observed {formatDate(report.observed_at)}
                </Text>
                <Text
                  style={{
                    color: severityColor(report.farmer_severity),
                    fontSize: 11,
                    fontWeight: '800',
                    marginTop: 4,
                  }}
                >
                  Farmer severity: {normalizedSeverity(report.farmer_severity)}
                  {report.farmer_severity_range ||
                  severityRange(report.farmer_severity)
                    ? ` · ${
                        report.farmer_severity_range ||
                        severityRange(report.farmer_severity)
                      } damage`
                    : ''}
                </Text>
                <View style={{ marginTop: 8 }}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => onOpenReport(report.id)}
                    style={{
                      backgroundColor: colors.blue,
                      paddingVertical: 9,
                      borderRadius: 8,
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        color: '#FFFFFF',
                        fontWeight: '800',
                        fontSize: 11,
                      }}
                    >
                      Open report
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))
          ) : (
            <Text style={{ color: colors.muted, fontSize: 11 }}>
              No farmer report has been submitted for this location yet.
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

export const MapScreen = React.memo(MapScreenView);

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

function FilterDropdown({
  value,
  options,
  selectedIndex,
  expanded,
  colors,
  onToggle,
  onSelect,
}: {
  value: string;
  options: string[];
  selectedIndex: number;
  expanded: boolean;
  colors: Palette;
  onToggle: () => void;
  onSelect: (index: number) => void;
}) {
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={filterStyle(colors)}
      >
        <Text numberOfLines={1} style={filterText(colors)}>
          {value}
        </Text>
        <Text style={{ color: colors.muted }}>{expanded ? '−' : '⌄'}</Text>
      </Pressable>
      {expanded ? (
        <View
          style={{
            position: 'absolute',
            top: 48,
            left: 0,
            right: 0,
            borderWidth: 1,
            borderColor: colors.line,
            borderRadius: 10,
            backgroundColor: colors.surface,
            elevation: 12,
            zIndex: 30,
          }}
        >
          {options.map((option, index) => {
            const selected = index === selectedIndex;
            return (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => onSelect(index)}
                style={{
                  minHeight: 42,
                  paddingHorizontal: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: selected ? colors.blueSoft : colors.surface,
                  borderBottomWidth: index < options.length - 1 ? 1 : 0,
                  borderBottomColor: colors.line,
                }}
              >
                <Text
                  style={{
                    color: selected ? colors.blue : colors.ink,
                    fontSize: 12,
                    fontWeight: selected ? '700' : '500',
                  }}
                >
                  {option}
                </Text>
                {selected ? (
                  <Text style={{ color: colors.blue, fontWeight: '800' }}>
                    ✓
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </>
  );
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

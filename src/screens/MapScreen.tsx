import React, { useMemo, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import {
  Camera,
  Map,
  Marker,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import { FarmProperty, Farmer, FieldReport } from '../types';
import { Palette } from '../theme';
import { formatDate } from '../utils';

type MapSite = {
  key: string;
  property: FarmProperty;
  farmer: Farmer;
  report?: FieldReport;
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
  reports,
  farmers,
  colors,
  onOpenReport,
  online,
}: {
  reports: FieldReport[];
  farmers: Farmer[];
  colors: Palette;
  onOpenReport: (report: FieldReport) => void;
  online: boolean;
}) {
  const [query, setQuery] = useState('');
  const [provinceIndex, setProvinceIndex] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [zoom, setZoom] = useState(8.2);
  const camera = useRef<CameraRef>(null);
  const [mapFailed, setMapFailed] = useState(false);

  const sites = useMemo(() => {
    const properties = farmers.flatMap(farmer =>
      (farmer.properties || []).map(property => ({ farmer, property })),
    );
    return properties
      .filter(
        ({ property }) =>
          property.location_consent === true &&
          typeof property.latitude === 'number' &&
          typeof property.longitude === 'number' &&
          property.latitude >= 8.9 &&
          property.latitude <= 11.1 &&
          property.longitude >= 122.2 &&
          property.longitude <= 123.6,
      )
      .map(({ farmer, property }) => {
        const report = reports.find(
          item =>
            item.property_id === property.id ||
            item.property_name.toLocaleLowerCase() ===
              property.name.toLocaleLowerCase(),
        );
        return {
          key: `${farmer.id}-${property.id}`,
          property,
          farmer,
          report,
        };
      });
  }, [farmers, reports]);

  const filteredSites = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return sites.filter(site => {
      const matchesProvince =
        provinceIndex === 0 ||
        site.property.province === provinceOptions[provinceIndex];
      const matchesStatus =
        statusIndex === 0 ||
        site.report?.verification_status === statusOptions[statusIndex];
      const matchesSearch =
        !needle ||
        [
          site.property.name,
          site.property.municipality,
          site.property.province,
          site.farmer.name,
          site.report?.code,
        ].some(value => value?.toLocaleLowerCase().includes(needle));
      return matchesProvince && matchesStatus && matchesSearch;
    });
  }, [sites, query, provinceIndex, statusIndex]);

  const selected =
    filteredSites.find(site => site.key === selectedKey) || filteredSites[0];
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
          Locate reported sites and prioritize field validation.
        </Text>
      </View>

      <TextInput
        accessibilityLabel="Search map sites"
        value={query}
        onChangeText={setQuery}
        placeholder="Search city, property or report"
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
          {sites.length} mapped sites
        </Text>
        <Text style={{ color: colors.muted, fontSize: 11 }}>
          {sites.filter(site => site.report).length} report markers
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
          onRegionDidChange={event => setZoom(event.nativeEvent.zoom)}
          onDidFinishLoadingMap={() => setMapFailed(false)}
          onDidFailLoadingMap={() => setMapFailed(true)}
        >
          <Camera
            ref={camera}
            initialViewState={{ center: [122.9, 10.25], zoom: 8.2 }}
            minZoom={6}
            maxZoom={18}
          />
          {filteredSites.map(site => {
            const color = markerColor(site.report?.verification_status, colors);
            const isSelected = selected?.key === site.key;
            return (
              <Marker
                key={site.key}
                id={site.key}
                lngLat={[site.property.longitude!, site.property.latitude!]}
                onPress={() => setSelectedKey(site.key)}
                anchor="center"
              >
                <View
                  style={{
                    width: isSelected ? 20 : 15,
                    height: isSelected ? 20 : 15,
                    borderRadius: 12,
                    backgroundColor: color,
                    borderWidth: isSelected ? 3 : 2,
                    borderColor: '#FFFFFF',
                    elevation: 4,
                  }}
                />
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
                : 'Basemap needs internet. Your cached reports and markers remain available.'}
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
          Only consented property coordinates are shown. Map markers support
          field review and are not for navigation. The live OpenStreetMap
          basemap requires internet; cached workspace records remain available
          offline.
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
            Selected site
          </Text>
          <Text style={{ color: colors.blue, fontSize: 11, fontWeight: '700' }}>
            {selected?.report?.code || selected?.farmer.reference || '—'}
          </Text>
        </View>
        {selected ? (
          <>
            <Text
              style={{
                color: colors.ink,
                fontSize: 17,
                fontWeight: '800',
                marginTop: 10,
              }}
            >
              {selected.property.name}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
              {selected.farmer.name} · {selected.property.municipality},{' '}
              {selected.property.province}
            </Text>
            {selected.report ? (
              <>
                <Text
                  style={{ color: colors.muted, fontSize: 11, marginTop: 9 }}
                >
                  {selected.report.verification_status} · Observed{' '}
                  {formatDate(selected.report.observed_at)}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onOpenReport(selected.report!)}
                  style={{
                    marginTop: 12,
                    backgroundColor: colors.blue,
                    paddingVertical: 12,
                    borderRadius: 10,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontWeight: '800',
                      fontSize: 12,
                    }}
                  >
                    Open report
                  </Text>
                </Pressable>
              </>
            ) : (
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 9 }}>
                No report is linked to this site.
              </Text>
            )}
          </>
        ) : (
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 9 }}>
            No consented property coordinates are available for this map filter.
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

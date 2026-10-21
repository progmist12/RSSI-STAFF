import React, { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import Svg, {
  Circle,
  Line,
  Path,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import { FarmProperty, Farmer, FieldReport } from '../types';
import { Palette } from '../theme';
import { formatDate } from '../utils';

type MapSite = {
  key: string;
  property: FarmProperty;
  farmer: Farmer;
  report?: FieldReport;
  x: number;
  y: number;
};

const islandPath =
  'M177 0L207 3L239 26L227 60L204 90L186 118L175 157L145 193L115 220L81 251L51 278L17 272L0 250L22 222L37 201L27 185L51 147L52 120L69 93L95 67L120 50L131 29L155 23L177 0Z';
const orientalPath =
  'M163 0H173L205 23L193 57L170 87L152 115L141 154L111 190L81 217L47 248L17 275L0 271V257L31 210L66 178L88 142L95 108L126 75L135 40L163 0Z';

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

function coordinate(latitude: number, longitude: number) {
  const lng = Math.min(123.45, Math.max(122.3, longitude));
  const lat = Math.min(11, Math.max(9, latitude));
  return {
    x: 40 + ((lng - 122.3) / (123.45 - 122.3)) * 239,
    y: 7 + ((11 - lat) / 2) * 278,
  };
}

export function MapScreen({
  reports,
  farmers,
  colors,
  onOpenReport,
}: {
  reports: FieldReport[];
  farmers: Farmer[];
  colors: Palette;
  onOpenReport: (report: FieldReport) => void;
}) {
  const [query, setQuery] = useState('');
  const [provinceIndex, setProvinceIndex] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState({ x: 160, y: 146 });

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
        const point = coordinate(property.latitude!, property.longitude!);
        return {
          key: `${farmer.id}-${property.id}`,
          property,
          farmer,
          report,
          ...point,
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
  const viewWidth = 320 / zoom;
  const viewHeight = 286 / zoom;
  const viewBox = `${center.x - viewWidth / 2} ${
    center.y - viewHeight / 2
  } ${viewWidth} ${viewHeight}`;

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
        <Svg width="100%" height="100%" viewBox={viewBox}>
          <Rect x="0" y="0" width="340" height="300" fill="#E8F1EF" />
          {[45, 90, 135, 180, 225, 270].map(value => (
            <Line
              key={`v-${value}`}
              x1={value}
              y1="0"
              x2={value}
              y2="300"
              stroke="#DDEAE6"
              strokeWidth="0.7"
            />
          ))}
          {[40, 85, 130, 175, 220, 265].map(value => (
            <Line
              key={`h-${value}`}
              x1="0"
              y1={value}
              x2="340"
              y2={value}
              stroke="#DDEAE6"
              strokeWidth="0.7"
            />
          ))}
          <Path
            d={islandPath}
            transform="translate(40 7)"
            fill="#E0EBCF"
            stroke="#A1B98E"
            strokeWidth="1.4"
          />
          <Path d={orientalPath} transform="translate(74 10)" fill="#CFDFBA" />
          <Path
            d="M218 14L200 51L183 81L166 111L153 148L127 180L102 207L81 234L57 270"
            fill="none"
            stroke="#9AB589"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <SvgText x="4" y="132" fontSize="7" fontWeight="700" fill="#567466">
            NEGROS OCCIDENTAL
          </SvgText>
          <SvgText x="220" y="243" fontSize="7" fontWeight="700" fill="#567466">
            NEGROS ORIENTAL
          </SvgText>
          {filteredSites.map(site => {
            const color = markerColor(site.report?.verification_status, colors);
            const isSelected = selected?.key === site.key;
            return (
              <Circle
                key={site.key}
                cx={site.x}
                cy={site.y}
                r={isSelected ? 8 : 6}
                fill={color}
                stroke="#FFFFFF"
                strokeWidth={isSelected ? 3 : 2}
                onPress={() => setSelectedKey(site.key)}
              />
            );
          })}
          <SvgText x="290" y="19" fontSize="9" fontWeight="700" fill="#1E3A5F">
            N ↑
          </SvgText>
        </Svg>
        <View style={{ position: 'absolute', right: 10, top: 66, gap: 6 }}>
          <MapControl
            label="Zoom in"
            text="+"
            colors={colors}
            onPress={() => setZoom(value => Math.min(2.4, value + 0.2))}
          />
          <MapControl
            label="Zoom out"
            text="−"
            colors={colors}
            onPress={() => setZoom(value => Math.max(1, value - 0.2))}
          />
          <MapControl
            label="Reset map view"
            text="◎"
            colors={colors}
            onPress={() => {
              setZoom(1);
              setCenter({ x: 160, y: 146 });
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
          field review and are not for navigation.
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

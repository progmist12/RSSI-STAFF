import React, { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import type { FarmProperty } from '../types';
import type { Palette } from '../theme';

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const MAX_MERCATOR_LATITUDE = 85.05112878;

function coordinate(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCoordinate(value: number, positive: string, negative: string) {
  return `${Math.abs(value).toFixed(6)}° ${value < 0 ? negative : positive}`;
}

function mercatorY(latitude: number) {
  const limited = Math.max(
    -MAX_MERCATOR_LATITUDE,
    Math.min(MAX_MERCATOR_LATITUDE, latitude),
  );
  const radians = (limited * Math.PI) / 180;
  return (1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2;
}

function initialCamera(
  points: Array<{ latitude: number; longitude: number }>,
  width: number,
  height: number,
) {
  const longitudes = points.map(point => point.longitude);
  const latitudes = points.map(point => point.latitude);
  const west = Math.min(...longitudes);
  const east = Math.max(...longitudes);
  const south = Math.min(...latitudes);
  const north = Math.max(...latitudes);
  const center: [number, number] = [(west + east) / 2, (south + north) / 2];
  const longitudeSpan = Math.max((east - west) / 360, 1 / 1_000_000_000);
  const latitudeSpan = Math.max(
    Math.abs(mercatorY(north) - mercatorY(south)),
    1 / 1_000_000_000,
  );
  const availableWidth = Math.max(120, width - 56);
  const availableHeight = Math.max(120, height - 56);
  const zoom = Math.min(
    21,
    Math.max(
      6,
      Math.floor(
        Math.min(
          Math.log2(availableWidth / (512 * longitudeSpan)),
          Math.log2(availableHeight / (512 * latitudeSpan)),
        ),
      ),
    ),
  );

  return { center, zoom };
}

export function FarmPropertyMap({
  property,
  colors,
}: {
  property: FarmProperty;
  colors: Palette;
}) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const mapHeight = Math.round(Math.max(220, Math.min(340, windowHeight * 0.32)));
  const camera = useRef<CameraRef>(null);
  const [zoom, setZoom] = useState(16);
  const [showBoundaryCoordinates, setShowBoundaryCoordinates] = useState(false);
  const latitude = coordinate(property.latitude);
  const longitude = coordinate(property.longitude);
  const boundary = useMemo(
    () =>
      (property.boundary_coordinates || []).filter(point => {
        const pointLatitude = coordinate(point.latitude);
        const pointLongitude = coordinate(point.longitude);
        return (
          pointLatitude !== null &&
          pointLongitude !== null &&
          Math.abs(pointLatitude) <= 90 &&
          Math.abs(pointLongitude) <= 180
        );
      }),
    [property.boundary_coordinates],
  );
  const boundaryRing: GeoJSON.Position[] = boundary.map(point => [
    Number(point.longitude),
    Number(point.latitude),
  ]);
  if (boundaryRing.length >= 3) {
    const first = boundaryRing[0];
    const last = boundaryRing[boundaryRing.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      boundaryRing.push(first);
    }
  }
  const hasBoundary = boundaryRing.length >= 4;
  const hasPin = latitude !== null && longitude !== null;
  const mapPoints = hasBoundary
    ? boundary
    : hasPin
      ? [{ latitude, longitude }]
      : [];
  const initial = initialCamera(
    mapPoints,
    Math.max(240, windowWidth - 48),
    mapHeight,
  );
  const boundaryId = `farmer-property-boundary-${property.id}`;

  const changeZoom = (amount: number) => {
    const nextZoom = Math.max(6, Math.min(22, zoom + amount));
    setZoom(nextZoom);
    camera.current?.zoomTo(nextZoom, { duration: 220 });
  };

  return (
    <View style={{ marginTop: 12, gap: 8 }}>
      <Text style={{ color: colors.ink, fontSize: 12, fontWeight: '800' }}>
        Farm location map
      </Text>
      {property.location_consent && mapPoints.length ? (
        <>
          <View
            style={{
              height: mapHeight,
              borderRadius: 12,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: colors.line,
              backgroundColor: colors.surfaceAlt,
            }}
          >
            <Map
              style={{ flex: 1 }}
              mapStyle={MAP_STYLE}
              androidView="texture"
              dragPan
              touchZoom
              doubleTapZoom
              doubleTapHoldZoom
              touchRotate={false}
              touchPitch={false}
              attribution
              attributionPosition={{ bottom: 6, right: 6 }}
              logo={false}
              compass
              compassPosition={{ top: 8, left: 8 }}
              onRegionDidChange={(event: { nativeEvent: { zoom: number } }) =>
                setZoom(event.nativeEvent.zoom)
              }
            >
              <Camera
                ref={camera}
                initialViewState={{ center: initial.center, zoom: initial.zoom }}
                minZoom={6}
                maxZoom={22}
              />
              {hasBoundary ? (
                <GeoJSONSource
                  id={boundaryId}
                  data={{
                    type: 'Feature',
                    properties: {},
                    geometry: {
                      type: 'Polygon',
                      coordinates: [boundaryRing],
                    },
                  }}
                >
                  <Layer
                    id={`${boundaryId}-fill`}
                    type="fill"
                    source={boundaryId}
                    paint={{
                      'fill-color': colors.green,
                      'fill-opacity': 0.2,
                    }}
                  />
                  <Layer
                    id={`${boundaryId}-outline`}
                    type="line"
                    source={boundaryId}
                    paint={{
                      'line-color': colors.green,
                      'line-width': 3,
                    }}
                  />
                </GeoJSONSource>
              ) : null}
              {hasPin ? (
                <Marker lngLat={[longitude, latitude]} anchor="center">
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.green,
                      borderColor: '#FFFFFF',
                      borderWidth: 3,
                      elevation: 5,
                    }}
                  />
                </Marker>
              ) : null}
            </Map>
            <View
              style={{ position: 'absolute', right: 8, top: 8, gap: 6 }}
            >
              <MapButton
                label="Zoom in on farm"
                text="+"
                colors={colors}
                onPress={() => changeZoom(1)}
              />
              <MapButton
                label="Zoom out on farm"
                text="−"
                colors={colors}
                onPress={() => changeZoom(-1)}
              />
              <MapButton
                label="Fit farm boundary"
                text="⌖"
                colors={colors}
                onPress={() => {
                  camera.current?.flyTo({
                    center: initial.center,
                    zoom: initial.zoom,
                    duration: 350,
                  });
                  setZoom(initial.zoom);
                }}
              />
            </View>
          </View>
          {hasPin ? (
            <View
              style={{
                padding: 10,
                borderRadius: 9,
                backgroundColor: colors.surfaceAlt,
                borderWidth: 1,
                borderColor: colors.line,
              }}
            >
              <Text
                style={{ color: colors.muted, fontSize: 10, fontWeight: '700' }}
              >
                FARM PIN COORDINATES
              </Text>
              <Text
                selectable
                style={{
                  color: colors.ink,
                  fontSize: 12,
                  fontWeight: '700',
                  marginTop: 4,
                }}
              >
                {formatCoordinate(latitude, 'N', 'S')} ·{' '}
                {formatCoordinate(longitude, 'E', 'W')}
              </Text>
            </View>
          ) : null}
          {hasBoundary ? (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: showBoundaryCoordinates }}
                onPress={() =>
                  setShowBoundaryCoordinates(value => !value)
                }
                style={{
                  minHeight: 42,
                  paddingHorizontal: 10,
                  borderRadius: 9,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: colors.blueSoft,
                }}
              >
                <Text
                  style={{ color: colors.blue, fontSize: 11, fontWeight: '800' }}
                >
                  {showBoundaryCoordinates ? 'Hide' : 'View'} boundary coordinates
                  {' · '}
                  {boundary.length} points
                </Text>
                <Text style={{ color: colors.blue, fontSize: 16 }}>
                  {showBoundaryCoordinates ? '−' : '+'}
                </Text>
              </Pressable>
              {showBoundaryCoordinates ? (
                <ScrollView
                  nestedScrollEnabled
                  style={{
                    maxHeight: 180,
                    borderWidth: 1,
                    borderColor: colors.line,
                    borderRadius: 9,
                    backgroundColor: colors.surfaceAlt,
                  }}
                >
                  {boundary.map((point, index) => (
                    <View
                      key={`${index}-${point.latitude}-${point.longitude}`}
                      style={{
                        minHeight: 38,
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        borderBottomWidth: index < boundary.length - 1 ? 1 : 0,
                        borderBottomColor: colors.line,
                      }}
                    >
                      <Text
                        style={{
                          color: colors.muted,
                          fontSize: 10,
                          fontWeight: '700',
                        }}
                      >
                        Point {index + 1}
                      </Text>
                      <Text
                        selectable
                        style={{
                          color: colors.ink,
                          flexShrink: 1,
                          fontSize: 10,
                          textAlign: 'right',
                        }}
                      >
                        {formatCoordinate(Number(point.latitude), 'N', 'S')},{' '}
                        {formatCoordinate(Number(point.longitude), 'E', 'W')}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              ) : null}
            </>
          ) : null}
        </>
      ) : (
        <Text
          style={{
            color: colors.muted,
            fontSize: 11,
            lineHeight: 16,
            padding: 10,
            borderRadius: 9,
            backgroundColor: colors.surfaceAlt,
          }}
        >
          Exact map and coordinates are unavailable for this account. They are
          shown only when the farmer has shared the location and staff access
          permits viewing it.
        </Text>
      )}
    </View>
  );
}

function MapButton({
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
        width: 40,
        height: 40,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 2,
      }}
    >
      <Text style={{ color: colors.blue, fontSize: 21, fontWeight: '700' }}>
        {text}
      </Text>
    </Pressable>
  );
}

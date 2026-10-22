import React from 'react';
import { View } from 'react-native';

export type AppIconName =
  | 'notification'
  | 'overview'
  | 'map'
  | 'reports'
  | 'visits'
  | 'farmers'
  | 'calendar';

export function AppIcon({
  name,
  color,
  size = 22,
}: {
  name: AppIconName;
  color: string;
  size?: number;
}) {
  const scale = size / 22;
  const stroke = Math.max(1.6, 1.8 * scale);
  const line = (width: number, height: number, extra = {}) => ({
    position: 'absolute' as const,
    width: width * scale,
    height: height * scale,
    backgroundColor: color,
    ...extra,
  });

  if (name === 'notification') {
    return (
      <View style={{ width: size, height: size }}>
        <View
          style={{
            position: 'absolute',
            left: size * 0.25,
            top: size * 0.23,
            width: size * 0.5,
            height: size * 0.5,
            borderWidth: stroke,
            borderColor: color,
            borderTopWidth: 0,
            borderTopLeftRadius: size * 0.25,
            borderTopRightRadius: size * 0.25,
            borderBottomLeftRadius: size * 0.1,
            borderBottomRightRadius: size * 0.1,
          }}
        />
        <View
          style={line(1.8, 3, {
            left: size * 0.46,
            top: size * 0.11,
            borderRadius: 2,
          })}
        />
        <View
          style={line(15, 1.8, {
            left: size * 0.16,
            top: size * 0.76,
            borderRadius: 2,
          })}
        />
        <View
          style={{
            position: 'absolute',
            left: size * 0.43,
            top: size * 0.83,
            width: size * 0.14,
            height: size * 0.1,
            borderRadius: size,
            backgroundColor: color,
          }}
        />
      </View>
    );
  }

  if (name === 'calendar') {
    return (
      <View style={{ width: size, height: size, borderWidth: stroke, borderColor: color, borderRadius: size * 0.14 }}>
        <View style={{ position: 'absolute', left: 0, right: 0, top: size * 0.3, height: stroke, backgroundColor: color }} />
        <View style={{ position: 'absolute', left: size * 0.24, top: -size * 0.09, width: stroke, height: size * 0.28, backgroundColor: color, borderRadius: 2 }} />
        <View style={{ position: 'absolute', right: size * 0.24, top: -size * 0.09, width: stroke, height: size * 0.28, backgroundColor: color, borderRadius: 2 }} />
        {[0.32, 0.52, 0.72].map(x => [0.48, 0.68].map(y => <View key={`${x}-${y}`} style={{ position: 'absolute', left: size * x, top: size * y, width: size * 0.09, height: size * 0.09, borderRadius: size, backgroundColor: color }} />))}
      </View>
    );
  }

  if (name === 'overview') {
    return (
      <View style={{ width: size, height: size }}>
        <View
          style={{
            position: 'absolute',
            left: size * 0.22,
            top: size * 0.34,
            width: size * 0.56,
            height: size * 0.48,
            borderWidth: stroke,
            borderColor: color,
            borderTopWidth: 0,
            borderBottomLeftRadius: 2,
            borderBottomRightRadius: 2,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: size * 0.25,
            top: size * 0.13,
            width: size * 0.5,
            height: size * 0.5,
            borderLeftWidth: stroke,
            borderTopWidth: stroke,
            borderColor: color,
            transform: [{ rotate: '45deg' }],
            borderTopLeftRadius: 2,
          }}
        />
        <View
          style={line(3 * scale, 6 * scale, {
            left: size * 0.47,
            top: size * 0.59,
            borderRadius: 1,
          })}
        />
      </View>
    );
  }

  if (name === 'map') {
    return (
      <View
        style={{
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: size * 0.62,
            height: size * 0.62,
            borderWidth: stroke,
            borderColor: color,
            borderRadius: size,
          }}
        />
        <View
          style={line(1.6, 6, { left: size * 0.46, top: 0, borderRadius: 2 })}
        />
        <View
          style={line(1.6, 6, {
            left: size * 0.46,
            bottom: 0,
            borderRadius: 2,
          })}
        />
        <View
          style={line(6, 1.6, { left: 0, top: size * 0.46, borderRadius: 2 })}
        />
        <View
          style={line(6, 1.6, { right: 0, top: size * 0.46, borderRadius: 2 })}
        />
      </View>
    );
  }

  if (name === 'reports') {
    return (
      <View style={{ width: size, height: size }}>
        <View
          style={{
            position: 'absolute',
            left: size * 0.25,
            top: size * 0.12,
            width: size * 0.5,
            height: size * 0.76,
            borderWidth: stroke,
            borderColor: color,
            borderRadius: size * 0.08,
          }}
        />
        {[0.39, 0.53, 0.67].map(y => (
          <View
            key={y}
            style={line(7, 1.6, {
              left: size * 0.39,
              top: size * y,
              borderRadius: 2,
            })}
          />
        ))}
      </View>
    );
  }

  if (name === 'visits') {
    return (
      <View style={{ width: size, height: size }}>
        <View
          style={{
            position: 'absolute',
            left: size * 0.12,
            top: size * 0.12,
            width: size * 0.76,
            height: size * 0.76,
            borderWidth: stroke,
            borderColor: color,
            borderRadius: size,
          }}
        />
        <View
          style={line(1.8, 6, {
            left: size * 0.5,
            top: size * 0.27,
            borderRadius: 2,
          })}
        />
        <View
          style={{
            position: 'absolute',
            left: size * 0.5,
            top: size * 0.49,
            width: size * 0.22,
            height: stroke,
            backgroundColor: color,
            borderRadius: 2,
            transform: [{ rotate: '35deg' }],
            transformOrigin: 'left',
          }}
        />
      </View>
    );
  }

  return (
    <View style={{ width: size, height: size }}>
      {[0.25, 0.5, 0.75].map((x, index) => (
        <View
          key={`head-${x}`}
          style={{
            position: 'absolute',
            left: size * x - size * (index === 1 ? 0.12 : 0.1),
            top: size * (index === 1 ? 0.12 : 0.23),
            width: size * (index === 1 ? 0.24 : 0.2),
            height: size * (index === 1 ? 0.24 : 0.2),
            borderWidth: stroke,
            borderColor: color,
            borderRadius: size,
            backgroundColor: 'transparent',
          }}
        />
      ))}
      {[0.02, 0.27, 0.58].map((left, index) => (
        <View
          key={`shoulders-${left}`}
          style={{
            position: 'absolute',
            left: size * left,
            bottom: size * 0.12,
            width: size * (index === 1 ? 0.46 : 0.4),
            height: size * (index === 1 ? 0.34 : 0.27),
            borderWidth: stroke,
            borderColor: color,
            borderTopLeftRadius: size * 0.24,
            borderTopRightRadius: size * 0.24,
            borderBottomWidth: 0,
            backgroundColor: 'transparent',
          }}
        />
      ))}
    </View>
  );
}

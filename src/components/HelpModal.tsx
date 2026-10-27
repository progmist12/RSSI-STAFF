import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Palette } from '../theme';

export type HelpLegendItem = { label: string; color: string; dashed?: boolean };

export const MAP_SEVERITY_LEGEND: HelpLegendItem[] = [
  {
    label: 'No report · health not assessed',
    color: '#BBF7D0',
    dashed: true,
  },
  { label: 'Report · severity not assessed', color: '#16A34A' },
  { label: 'Mild · 1–20%', color: '#2563EB' },
  { label: 'Moderate · 21–50%', color: '#EAB308' },
  { label: 'Severe · 51–70%', color: '#F97316' },
  { label: 'Highly severe · 71–100%', color: '#DC2626' },
];

export function HelpModal({
  visible,
  title,
  description,
  colors,
  legend,
  onClose,
}: {
  visible: boolean;
  title: string;
  description: string;
  colors: Palette;
  legend?: HelpLegendItem[];
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          padding: 24,
          backgroundColor: '#00000080',
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close help"
          onPress={onClose}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <View
          style={{
            padding: 18,
            borderRadius: 18,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.line,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Text
              style={{
                color: colors.ink,
                fontSize: 17,
                fontWeight: '800',
                flex: 1,
              }}
            >
              {title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close help"
              onPress={onClose}
              hitSlop={8}
            >
              <Text style={{ color: colors.muted, fontSize: 25, lineHeight: 27 }}>
                ×
              </Text>
            </Pressable>
          </View>
          {legend?.length ? (
            <View style={{ gap: 12, marginTop: 16 }}>
              {legend.map(({ label, color, dashed }) => (
                <View
                  key={label}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}
                >
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: color,
                      ...(dashed
                        ? {
                            borderWidth: 1.5,
                            borderStyle: 'dashed' as const,
                            borderColor: '#15803D',
                          }
                        : {}),
                    }}
                  />
                  <Text style={{ color: colors.ink, fontSize: 12 }}>
                    {label}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          <Text
            style={{
              color: colors.muted,
              fontSize: 12,
              lineHeight: 18,
              marginTop: legend?.length ? 16 : 10,
            }}
          >
            {description}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

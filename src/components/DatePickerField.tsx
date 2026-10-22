import React, { useMemo, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Palette } from '../theme';
import { formatDate } from '../utils';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat('en-PH', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month, 1));
}

export function DatePickerField({
  value,
  onChange,
  colors,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  colors: Palette;
  disabled?: boolean;
}) {
  const initial = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const [visible, setVisible] = useState(false);
  const [viewYear, setViewYear] = useState(
    initial ? Number(initial[1]) : new Date().getFullYear(),
  );
  const [viewMonth, setViewMonth] = useState(
    initial ? Number(initial[2]) - 1 : new Date().getMonth(),
  );
  const cells = useMemo(() => {
    const offset = new Date(viewYear, viewMonth, 1).getDay();
    const count = new Date(viewYear, viewMonth + 1, 0).getDate();
    return [
      ...Array(offset).fill(null),
      ...Array.from({ length: count }, (_, i) => i + 1),
    ];
  }, [viewMonth, viewYear]);
  const selected = initial
    ? {
        year: Number(initial[1]),
        month: Number(initial[2]) - 1,
        day: Number(initial[3]),
      }
    : null;

  const changeMonth = (amount: number) => {
    const date = new Date(viewYear, viewMonth + amount, 1);
    setViewYear(date.getFullYear());
    setViewMonth(date.getMonth());
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          value
            ? `Follow-up date ${formatDate(value)}`
            : 'Choose follow-up date'
        }
        disabled={disabled}
        onPress={() => {
          if (selected) {
            setViewYear(selected.year);
            setViewMonth(selected.month);
          }
          setVisible(true);
        }}
        style={{
          minHeight: 46,
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: 10,
          paddingHorizontal: 13,
          backgroundColor: disabled ? colors.surfaceAlt : colors.surface,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <Text
          style={{ color: value ? colors.ink : colors.muted, fontSize: 13 }}
        >
          {value ? formatDate(value) : 'Choose a date'}
        </Text>
        <Text style={{ color: colors.blue, fontSize: 18 }}>▦</Text>
      </Pressable>

      <Modal
        transparent
        visible={visible}
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable
          onPress={() => setVisible(false)}
          style={{
            flex: 1,
            justifyContent: 'center',
            padding: 24,
            backgroundColor: '#0008',
          }}
        >
          <Pressable
            onPress={event => event.stopPropagation()}
            style={{
              padding: 18,
              borderRadius: 18,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.line,
            }}
          >
            <Text
              style={{
                color: colors.muted,
                fontSize: 11,
                fontWeight: '800',
                letterSpacing: 0.7,
              }}
            >
              FOLLOW-UP DATE
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 12,
                marginBottom: 12,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous month"
                onPress={() => changeMonth(-1)}
                hitSlop={8}
                style={{ padding: 8 }}
              >
                <Text
                  style={{
                    color: colors.blue,
                    fontSize: 23,
                    fontWeight: '700',
                  }}
                >
                  ‹
                </Text>
              </Pressable>
              <Text
                style={{ color: colors.ink, fontSize: 16, fontWeight: '800' }}
              >
                {monthLabel(viewYear, viewMonth)}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next month"
                onPress={() => changeMonth(1)}
                hitSlop={8}
                style={{ padding: 8 }}
              >
                <Text
                  style={{
                    color: colors.blue,
                    fontSize: 23,
                    fontWeight: '700',
                  }}
                >
                  ›
                </Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', marginBottom: 5 }}>
              {WEEKDAYS.map((day, index) => (
                <Text
                  key={`${day}-${index}`}
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    color: colors.muted,
                    fontSize: 11,
                    fontWeight: '700',
                    paddingVertical: 7,
                  }}
                >
                  {day}
                </Text>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {cells.map((day, index) => {
                const isSelected = Boolean(
                  day &&
                    selected?.year === viewYear &&
                    selected.month === viewMonth &&
                    selected.day === day,
                );
                return (
                  <View
                    key={`day-${index}`}
                    style={{ width: `${100 / 7}%`, padding: 2 }}
                  >
                    {day ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${monthLabel(
                          viewYear,
                          viewMonth,
                        )} ${day}`}
                        accessibilityState={{ selected: isSelected }}
                        onPress={() => {
                          onChange(
                            `${viewYear}-${`${viewMonth + 1}`.padStart(
                              2,
                              '0',
                            )}-${`${day}`.padStart(2, '0')}`,
                          );
                          setVisible(false);
                        }}
                        style={{
                          height: 38,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 10,
                          backgroundColor: isSelected
                            ? colors.blue
                            : 'transparent',
                        }}
                      >
                        <Text
                          style={{
                            color: isSelected ? '#FFFFFF' : colors.ink,
                            fontSize: 13,
                            fontWeight: isSelected ? '800' : '500',
                          }}
                        >
                          {day}
                        </Text>
                      </Pressable>
                    ) : (
                      <View style={{ height: 38 }} />
                    )}
                  </View>
                );
              })}
            </View>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 10,
              }}
            >
              <Pressable
                onPress={() => {
                  onChange('');
                  setVisible(false);
                }}
                style={{ paddingVertical: 8, paddingHorizontal: 5 }}
              >
                <Text
                  style={{
                    color: colors.muted,
                    fontSize: 12,
                    fontWeight: '700',
                  }}
                >
                  Clear date
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setVisible(false)}
                style={{ paddingVertical: 8, paddingHorizontal: 5 }}
              >
                <Text
                  style={{
                    color: colors.blue,
                    fontSize: 12,
                    fontWeight: '800',
                  }}
                >
                  Cancel
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

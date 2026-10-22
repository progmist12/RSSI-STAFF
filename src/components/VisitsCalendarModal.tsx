import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import type { StaffVisit } from '../types';

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export function VisitsCalendarModal({
  visible,
  visits,
  colors,
  onClose,
  onOpenReport,
}: {
  visible: boolean;
  visits: StaffVisit[];
  colors: any;
  onClose: () => void;
  onOpenReport: (visit: StaffVisit) => void;
}) {
  const [month, setMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState(dateKey(new Date()));
  const markedVisits = useMemo(() => {
    const grouped = new Map<string, StaffVisit[]>();
    visits
      .filter(visit => visit.status === 'scheduled')
      .forEach(visit => {
        const date = new Date(visit.scheduled_at);
        if (Number.isNaN(date.getTime())) return;
        const key = dateKey(date);
        grouped.set(key, [...(grouped.get(key) || []), visit]);
      });
    return grouped;
  }, [visits]);
  const monthDays = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const selectedVisits = markedVisits.get(selectedDay) || [];
  const textColor = colors.ink;
  const muted = colors.muted;
  const border = colors.line || '#DCE4EF';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(8, 20, 38, 0.48)', justifyContent: 'center', padding: 20 }}>
        <View style={{ maxHeight: '88%', backgroundColor: colors.surface, borderRadius: 20, padding: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <Text style={{ color: textColor, fontSize: 19, fontWeight: '800' }}>Visit schedule</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close visit calendar" hitSlop={10}>
              <Text style={{ color: muted, fontSize: 27, lineHeight: 29 }}>×</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Pressable onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} hitSlop={10}>
              <Text style={{ color: colors.blue, fontSize: 22, fontWeight: '700' }}>‹</Text>
            </Pressable>
            <Text style={{ color: textColor, fontSize: 16, fontWeight: '700' }}>
              {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </Text>
            <Pressable onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} hitSlop={10}>
              <Text style={{ color: colors.blue, fontSize: 22, fontWeight: '700' }}>›</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', marginBottom: 4 }}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, index) => (
              <Text key={`${label}-${index}`} style={{ width: '14.285%', textAlign: 'center', color: muted, fontSize: 12, fontWeight: '700', paddingVertical: 7 }}>{label}</Text>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 14 }}>
            {Array.from({ length: firstDay }, (_, index) => <View key={`blank-${index}`} style={{ width: '14.285%', height: 42 }} />)}
            {Array.from({ length: monthDays }, (_, index) => {
              const day = index + 1;
              const key = dateKey(new Date(month.getFullYear(), month.getMonth(), day));
              const marked = Boolean(markedVisits.get(key)?.length);
              const selected = selectedDay === key;
              return (
                <Pressable key={key} onPress={() => setSelectedDay(key)} style={{ width: '14.285%', height: 42, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? colors.blue : 'transparent', borderWidth: marked && !selected ? 1 : 0, borderColor: colors.blue }}>
                    <Text style={{ color: selected ? '#FFFFFF' : textColor, fontWeight: marked || selected ? '800' : '500' }}>{day}</Text>
                  </View>
                  {marked && !selected ? <View style={{ position: 'absolute', bottom: 1, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.blue }} /> : null}
                </Pressable>
              );
            })}
          </View>
          <View style={{ borderTopWidth: 1, borderColor: border, paddingTop: 12, minHeight: 86 }}>
            <Text style={{ color: textColor, fontWeight: '700', marginBottom: 8 }}>
              {new Date(`${selectedDay}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            </Text>
            {selectedVisits.length ? (
              <ScrollView>
                {selectedVisits.map(visit => (
                  <Pressable key={visit.id} onPress={() => onOpenReport(visit)} style={{ borderWidth: 1, borderColor: border, borderRadius: 12, padding: 11, marginBottom: 8 }}>
                    <Text style={{ color: textColor, fontWeight: '700' }}>{visit.property_name} · {visit.report_code}</Text>
                    <Text style={{ color: muted, fontSize: 12, marginTop: 3 }}>{visit.farmer_name} · {visit.municipality}, {visit.province}</Text>
                    <Text style={{ color: colors.blue, fontSize: 12, fontWeight: '600', marginTop: 4 }}>{new Date(visit.scheduled_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} · View report</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : <Text style={{ color: muted, fontSize: 13 }}>No visits scheduled for this day.</Text>}
          </View>
        </View>
      </View>
    </Modal>
  );
}

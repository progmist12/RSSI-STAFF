import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { AppNotification } from '../offlineStore';
import { Palette } from '../theme';

export function NotificationsPanel({
  visible,
  notifications,
  colors,
  onClose,
}: {
  visible: boolean;
  notifications: AppNotification[];
  colors: Palette;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          justifyContent: 'flex-start',
          backgroundColor: '#0008',
          padding: 16,
          paddingTop: 86,
        }}
      >
        <Pressable
          onPress={event => event.stopPropagation()}
          style={{
            maxHeight: '75%',
            borderRadius: 18,
            overflow: 'hidden',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.line,
          }}
        >
          <View
            style={{
              padding: 16,
              borderBottomWidth: 1,
              borderColor: colors.line,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text
              style={{ color: colors.ink, fontSize: 17, fontWeight: '800' }}
            >
              Notifications
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close notifications"
              onPress={onClose}
              hitSlop={10}
            >
              <Text style={{ color: colors.muted, fontSize: 22 }}>×</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 12 }}>
            {notifications.length ? (
              notifications.map(item => (
                <View
                  key={item.id}
                  style={{
                    padding: 12,
                    marginBottom: 8,
                    borderRadius: 12,
                    backgroundColor: item.read
                      ? colors.surfaceAlt
                      : colors.blueSoft,
                  }}
                >
                  <Text
                    style={{
                      color: colors.ink,
                      fontWeight: '700',
                      fontSize: 13,
                    }}
                  >
                    {item.title}
                  </Text>
                  <Text
                    style={{
                      color: colors.muted,
                      fontSize: 12,
                      lineHeight: 17,
                      marginTop: 4,
                    }}
                  >
                    {item.message}
                  </Text>
                  <Text
                    style={{ color: colors.muted, fontSize: 10, marginTop: 7 }}
                  >
                    {new Date(item.createdAt).toLocaleString()}
                  </Text>
                </View>
              ))
            ) : (
              <View style={{ padding: 22, alignItems: 'center' }}>
                <Text style={{ color: colors.ink, fontWeight: '700' }}>
                  You’re all caught up
                </Text>
                <Text
                  style={{
                    color: colors.muted,
                    fontSize: 12,
                    marginTop: 5,
                    textAlign: 'center',
                  }}
                >
                  Updates about offline work and your workspace will appear
                  here.
                </Text>
              </View>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

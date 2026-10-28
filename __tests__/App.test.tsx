/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

jest.mock('@react-native-async-storage/async-storage', () => {
  const values = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => values.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        values.set(key, value);
      }),
      removeItem: jest.fn(async (key: string) => values.delete(key)),
      clear: jest.fn(async () => values.clear()),
    },
  };
});

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));

jest.mock('@maplibre/maplibre-react-native', () => ({
  Camera: 'Camera',
  Map: 'Map',
  Marker: 'Marker',
}));

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(async () => ({isConnected: false, isInternetReachable: false})),
    addEventListener: jest.fn(() => jest.fn()),
  },
}));

jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: {WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY'},
  getGenericPassword: jest.fn(async () => false),
  setGenericPassword: jest.fn(async () => true),
  resetGenericPassword: jest.fn(async () => true),
}));

jest.mock('@notifee/react-native', () => ({
  AndroidImportance: {HIGH: 4},
  EventType: {PRESS: 1},
  TriggerType: {TIMESTAMP: 0},
  default: {
    requestPermission: jest.fn(async () => undefined),
    createChannel: jest.fn(async () => 'test-channel'),
    displayNotification: jest.fn(async () => undefined),
    getTriggerNotifications: jest.fn(async () => []),
    cancelTriggerNotification: jest.fn(async () => undefined),
    createTriggerNotification: jest.fn(async () => undefined),
    onForegroundEvent: jest.fn(() => jest.fn()),
    getDisplayedNotifications: jest.fn(async () => []),
    cancelNotification: jest.fn(async () => undefined),
  },
}));

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});

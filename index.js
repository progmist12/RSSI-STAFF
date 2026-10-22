/**
 * @format
 */

import { AppRegistry } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from './App';
import { name as appName } from './app.json';

try {
  const notifee = require('@notifee/react-native');
  notifee.default.onBackgroundEvent(async ({ type, detail }) => {
    if (type !== notifee.EventType.PRESS) return;
    const reportId = detail.notification?.data?.reportId;
    if (reportId) {
      await AsyncStorage.setItem('rssi_staff_pending_report_open', String(reportId));
    }
  });
} catch {
  // Older installed native builds may not have Notifee linked yet.
}

AppRegistry.registerComponent(appName, () => App);

import type { TimestampTrigger } from '@notifee/react-native';
import type { StaffVisit } from '../types';

type NotifeeModule = typeof import('@notifee/react-native');

function getNotifee(): NotifeeModule | null {
  try {
    return require('@notifee/react-native') as NotifeeModule;
  } catch {
    // An older installed APK may not contain the native Notifee module yet.
    return null;
  }
}

const CHANNEL_ID = 'rssi-staff-updates';
const VISIT_PREFIX = 'rssi-visit-';
let reminderSync = Promise.resolve();

export async function preparePhoneNotifications() {
  const notifee = getNotifee();
  if (!notifee) return false;
  await notifee.default.requestPermission();
  await notifee.default.createChannel({
    id: CHANNEL_ID,
    name: 'Reports and visit reminders',
    importance: notifee.AndroidImportance.HIGH,
  });
  return true;
}

export async function notifyNewReport(code: string, reportId: number) {
  const notifee = getNotifee();
  if (!notifee) return;
  await notifee.default.displayNotification({
    id: `rssi-report-${reportId}`,
    title: 'New field report',
    body: `${code} has been submitted and is ready to review.`,
    data: { reportId: String(reportId) },
    android: {
      channelId: CHANNEL_ID,
      pressAction: { id: 'default' },
      autoCancel: true,
      smallIcon: 'ic_launcher',
    },
  });
}

async function replaceVisitReminders(visits: StaffVisit[]) {
  const notifee = getNotifee();
  if (!notifee) return;
  const existing = await notifee.default.getTriggerNotifications();
  await Promise.all(
    existing
      .filter(item => item.notification.id?.startsWith(VISIT_PREFIX))
      .map(item => notifee.default.cancelTriggerNotification(item.notification.id!)),
  );

  const now = Date.now();
  const reminders = visits
    .filter(visit => visit.status === 'scheduled')
    .map(visit => ({ visit, scheduled: new Date(visit.scheduled_at) }))
    .filter(item => !Number.isNaN(item.scheduled.getTime()))
    .map(item => {
      const reminder = new Date(item.scheduled);
      reminder.setHours(8, 0, 0, 0);
      const visitTime = item.scheduled.getHours() * 60 + item.scheduled.getMinutes();
      if (visitTime < 8 * 60 || (reminder.getTime() <= now && item.scheduled.getTime() > now)) {
        reminder.setTime(item.scheduled.getTime());
      }
      return { ...item, reminder };
    })
    .filter(item => item.reminder.getTime() > now)
    .sort((a, b) => a.reminder.getTime() - b.reminder.getTime())
    .slice(0, 45);

  await Promise.all(
    reminders.map(({ visit, reminder }) => {
      const trigger: TimestampTrigger = {
        type: notifee.TriggerType.TIMESTAMP,
        timestamp: reminder.getTime(),
      };
      return notifee.default.createTriggerNotification(
        {
          id: `${VISIT_PREFIX}${visit.id}`,
          title: 'Visit scheduled for today',
          body: `${visit.report_code} · ${visit.property_name}, ${visit.municipality}`,
          data: { reportId: String(visit.report_id) },
          android: {
            channelId: CHANNEL_ID,
            pressAction: { id: 'default' },
            autoCancel: true,
            smallIcon: 'ic_launcher',
          },
        },
        trigger,
      );
    }),
  );
}

export function listenForReportNotificationPress(
  onReport: (reportId: number) => void,
) {
  const notifee = getNotifee();
  if (!notifee) return () => undefined;
  const handleNotification = (notification?: { data?: { reportId?: string } }) => {
    const reportId = Number(notification?.data?.reportId);
    if (Number.isInteger(reportId) && reportId > 0) onReport(reportId);
  };
  const unsubscribe = notifee.default.onForegroundEvent(({ type, detail }) => {
    if (type === notifee.EventType.PRESS) {
      handleNotification(detail.notification);
    }
  });
  void notifee.default
    .getInitialNotification()
    .then(initial => handleNotification(initial?.notification))
    .catch(() => undefined);
  return unsubscribe;
}

export async function clearReportPhoneNotifications(reportId: number) {
  const notifee = getNotifee();
  if (!notifee) return;
  const displayed = await notifee.default.getDisplayedNotifications();
  const matching = displayed.filter(
    item => Number(item.notification.data?.reportId) === reportId,
  );
  await Promise.all(
    matching.map(item =>
      item.notification.id
        ? notifee.default.cancelNotification(item.notification.id)
        : Promise.resolve(),
    ),
  );
  await notifee.default.cancelNotification(`rssi-report-${reportId}`);
}

export function syncVisitReminders(visits: StaffVisit[]) {
  reminderSync = reminderSync
    .catch(() => undefined)
    .then(() => replaceVisitReminders(visits));
  return reminderSync;
}

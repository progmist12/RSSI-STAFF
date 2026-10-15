import * as Keychain from 'react-native-keychain';
import {StaffSession} from './types';

const SERVICE = 'org.sra.rssi.staff.session';

export async function readSession(): Promise<StaffSession | null> {
  const credentials = await Keychain.getGenericPassword({service: SERVICE});
  if (!credentials) return null;
  try {
    const value = JSON.parse(credentials.password) as StaffSession;
    return value?.token && value?.user && Array.isArray(value.scopes) ? value : null;
  } catch {
    await clearSession();
    return null;
  }
}

export async function saveSession(session: StaffSession): Promise<void> {
  await Keychain.setGenericPassword('staff-session', JSON.stringify(session), {
    service: SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
  });
}

export async function clearSession(): Promise<void> {
  await Keychain.resetGenericPassword({service: SERVICE});
}


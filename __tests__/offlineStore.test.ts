import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  readPendingReviews,
  readPendingVisitChanges,
  savePendingReviews,
  savePendingVisitChanges,
} from '../src/offlineStore';
import {PendingReview, PendingVisitChange} from '../src/offlineStore';

jest.mock('@react-native-async-storage/async-storage', () => {
  const storage = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => storage.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        storage.set(key, value);
      }),
      clear: jest.fn(async () => storage.clear()),
    },
  };
});

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

test('offline reviews and visits survive storage and remain isolated per staff account', async () => {
  const review: PendingReview = {
    reportId: 23,
    nextStep: 'needed',
    updatedAt: '2026-10-27T10:00:00.000Z',
    review: {
      verificationStatus: 'Confirmed',
      sraSeverity: 'Moderate',
      assessmentRationale: 'Visited farm',
      reviewerNote: '',
      farmerMessage: '',
      followUpAt: '2026-11-04',
      plantHeightCm: '',
      leavesPerStalk: '',
      leafLengthCm: '',
      leafWidthCm: '',
      tillerCount: '',
      measurementDate: '',
      cropVariety: '',
      growthStage: '',
      sampleCount: '',
    },
  };
  const visitChange = {
    id: 'local-visit-23',
    kind: 'create',
    reportId: 23,
    visitId: null,
    localVisit: {id: -1, report_id: 23} as PendingVisitChange['localVisit'],
    expectedUpdatedAt: null,
    payload: {
      status: 'scheduled',
      scheduledAt: '2026-11-04T08:00:00+08:00',
      visitFindings: '',
      checkings: [],
      cropCharacteristics: {
        leavesPerStalk: null,
        plantHeight: null,
        leafLength: null,
        leafWidth: null,
        tillers: null,
      },
    },
    state: 'pending',
    savedAt: '2026-10-27T10:00:00.000Z',
  } as PendingVisitChange;

  await savePendingReviews(7, [review]);
  await savePendingVisitChanges(7, [visitChange]);

  await expect(readPendingReviews(7)).resolves.toEqual([review]);
  await expect(readPendingVisitChanges(7)).resolves.toEqual([visitChange]);
  await expect(readPendingReviews(8)).resolves.toEqual([]);
  await expect(readPendingVisitChanges(8)).resolves.toEqual([]);
  expect(AsyncStorage.setItem).toHaveBeenCalledTimes(2);
});

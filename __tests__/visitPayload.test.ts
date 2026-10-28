import {visitPayloadForApi} from '../src/app/visitPayload';

test.each(['scheduled', 'completed'] as const)(
  'visit payload preserves the %s scheduling state and maps crop measurements',
  status => {
    expect(
      visitPayloadForApi({
        status,
        scheduledAt: '2026-11-04T08:00:00+08:00',
        visitFindings: 'Inspected the affected plot',
        checkings: [],
        cropCharacteristics: {
          plantHeight: 82,
          leavesPerStalk: 7,
          leafLength: 55,
          leafWidth: 2.3,
          tillers: 10,
          measurementDate: '2026-11-04',
          cropVariety: 'local variety',
          growthStage: 'tillering',
          sampleCount: 5,
        },
      }),
    ).toEqual({
      status,
      scheduledAt: '2026-11-04T08:00:00+08:00',
      visitFindings: 'Inspected the affected plot',
      checkings: [],
      cropCharacteristics: {
        plantHeightCm: 82,
        leavesPerStalk: 7,
        leafLengthCm: 55,
        leafWidthCm: 2.3,
        tillerCount: 10,
        measurementDate: '2026-11-04',
        cropVariety: 'local variety',
        growthStage: 'tillering',
        sampleCount: 5,
      },
    });
  },
);

import type { CropCharacteristics } from '../types';

export function visitCropCharacteristicsPayload(
  values: CropCharacteristics,
) {
  return {
    plantHeightCm: values.plantHeight,
    leavesPerStalk: values.leavesPerStalk,
    leafLengthCm: values.leafLength,
    leafWidthCm: values.leafWidth,
    tillerCount: values.tillers,
    measurementDate: values.measurementDate || null,
    cropVariety: values.cropVariety || null,
    growthStage: values.growthStage || null,
    sampleCount: values.sampleCount ?? null,
  };
}

export function visitPayloadForApi<
  T extends { cropCharacteristics: CropCharacteristics },
>(values: T) {
  return {
    ...values,
    cropCharacteristics: visitCropCharacteristicsPayload(
      values.cropCharacteristics,
    ),
  };
}

import type { CharacteristicType } from '../entities/quality-characteristic.entity';
import type { MeasurementSource } from '../entities/quality-measurement.entity';

/**
 * Input shapes for the SPC data-foundation endpoints. Validation is performed
 * in the services (there is no global ValidationPipe in this app), so these are
 * plain typed contracts shared by controllers + services.
 */

export interface CreateCharacteristicDto {
  code?: string;
  name: string;
  modelId?: string | null;
  operationId?: string | null;
  station?: string | null;
  type?: CharacteristicType;
  unit?: string | null;
  nominal?: number | null;
  usl?: number | null;
  lsl?: number | null;
  isCritical?: boolean;
  active?: boolean;
  notes?: string | null;
}

export type UpdateCharacteristicDto = Partial<CreateCharacteristicDto>;

export interface ListCharacteristicsQuery {
  model?: string;
  search?: string;
  type?: CharacteristicType;
  active?: string; // 'true' | 'false'
}

/** A single reading inside a batch; per-reading fields override the batch ones. */
export interface MeasurementReadingDto {
  value?: number | null;
  passed?: boolean | null;
  subgroupId?: string | null;
  subgroupLabel?: string | null;
  reference?: string | null;
  gage?: string | null;
  measuredAt?: string | Date | null;
  measuredBy?: string | null;
  notes?: string | null;
}

/** Capture one or many readings against a characteristic in a single call. */
export interface CreateMeasurementsDto {
  characteristicId: string;
  source?: MeasurementSource;
  reference?: string | null;
  gage?: string | null;
  subgroupId?: string | null;
  subgroupLabel?: string | null;
  measuredBy?: string | null;
  measuredAt?: string | Date | null;
  notes?: string | null;
  /** When present, each entry becomes a row. A single value/passed also works. */
  readings?: MeasurementReadingDto[];
  value?: number | null;
  passed?: boolean | null;
}

export interface ListMeasurementsQuery {
  characteristic?: string;
  from?: string;
  to?: string;
}

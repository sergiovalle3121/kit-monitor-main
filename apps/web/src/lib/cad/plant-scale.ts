export type CadPlantPresetId =
  | "small-cell"
  | "smt-line"
  | "warehouse"
  | "full-factory";

export interface CadPlantPreset {
  id: CadPlantPresetId;
  label: string;
  description: string;
  widthMm: number;
  heightMm: number;
  gridMm: number;
}

export interface CadPlantPresetFootprint {
  width: number;
  height: number;
  gridSize: number;
}

export type CadPlantDisplayUnit = "mm" | "m";

export interface CadPlantBoundsObject {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CadPlantBoundsIssue {
  id: string;
  label: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
  overflow: number;
}

const MM_PER_UNIT: Record<string, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: 25.4,
  ft: 304.8,
};

export const CAD_PLANT_PRESETS: CadPlantPreset[] = [
  {
    id: "small-cell",
    label: "Small cell",
    description: "10 m x 8 m",
    widthMm: 10000,
    heightMm: 8000,
    gridMm: 500,
  },
  {
    id: "smt-line",
    label: "SMT line",
    description: "30 m x 12 m",
    widthMm: 30000,
    heightMm: 12000,
    gridMm: 1000,
  },
  {
    id: "warehouse",
    label: "Warehouse",
    description: "60 m x 40 m",
    widthMm: 60000,
    heightMm: 40000,
    gridMm: 2500,
  },
  {
    id: "full-factory",
    label: "Full factory",
    description: "120 m x 80 m",
    widthMm: 120000,
    heightMm: 80000,
    gridMm: 5000,
  },
];

export function cadUnitToMm(unit: string | null | undefined): number {
  return MM_PER_UNIT[unit || "mm"] ?? 1;
}

export function cadValueToMm(
  value: number,
  unit: string | null | undefined,
): number {
  return value * cadUnitToMm(unit);
}

export function cadValueFromMm(
  valueMm: number,
  unit: string | null | undefined,
): number {
  const factor = cadUnitToMm(unit);
  const value = valueMm / factor;
  return factor === 1 ? Math.round(value) : Number(value.toFixed(3));
}

export function cadValueForUnit(
  value: number,
  sourceUnit: string | null | undefined,
  displayUnit: CadPlantDisplayUnit,
): number {
  return cadValueFromMm(cadValueToMm(value, sourceUnit), displayUnit);
}

export function formatCadPlantLength(
  value: number,
  sourceUnit: string | null | undefined,
  displayUnit: CadPlantDisplayUnit,
): string {
  const converted = cadValueForUnit(value, sourceUnit, displayUnit);
  return `${converted.toLocaleString("en-US", {
    maximumFractionDigits: displayUnit === "mm" ? 0 : 2,
  })} ${displayUnit}`;
}

export function cadPlantPresetFootprint(
  presetId: CadPlantPresetId,
  unit: string | null | undefined,
): CadPlantPresetFootprint {
  const preset = CAD_PLANT_PRESETS.find((item) => item.id === presetId);
  if (!preset) throw new Error(`Unknown CAD plant preset: ${presetId}`);
  return {
    width: cadValueFromMm(preset.widthMm, unit),
    height: cadValueFromMm(preset.heightMm, unit),
    gridSize: cadValueFromMm(preset.gridMm, unit),
  };
}

export function recommendCadGridSize(
  width: number,
  height: number,
  unit: string | null | undefined,
): number {
  const maxMm = Math.max(cadValueToMm(width, unit), cadValueToMm(height, unit));
  const gridMm =
    maxMm <= 12000
      ? 500
      : maxMm <= 35000
        ? 1000
        : maxMm <= 70000
          ? 2500
          : 5000;
  return cadValueFromMm(gridMm, unit);
}

export function formatCadPlantSize(
  width: number,
  height: number,
  unit: string | null | undefined,
  displayUnit?: CadPlantDisplayUnit,
): string {
  const activeUnit = unit || "mm";
  const widthMm = cadValueToMm(width, activeUnit);
  const heightMm = cadValueToMm(height, activeUnit);
  const widthM = widthMm / 1000;
  const heightM = heightMm / 1000;
  const active = `${width.toLocaleString("en-US", {
    maximumFractionDigits: activeUnit === "mm" ? 0 : 2,
  })} x ${height.toLocaleString("en-US", {
    maximumFractionDigits: activeUnit === "mm" ? 0 : 2,
  })} ${activeUnit}`;
  const metric = `${widthM.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })} x ${heightM.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })} m`;
  const millimeter = `${Math.round(widthMm).toLocaleString("en-US")} x ${Math.round(heightMm).toLocaleString("en-US")} mm`;
  if (!displayUnit) return activeUnit === "m" ? `${metric} (${millimeter})` : `${active} (${metric})`;
  return displayUnit === "m" ? `${metric} (${millimeter})` : `${millimeter} (${metric})`;
}

export function detectObjectsOutsidePlantBounds(input: {
  width: number;
  height: number;
  objects: CadPlantBoundsObject[];
  tolerance?: number;
}): CadPlantBoundsIssue[] {
  const tolerance = Math.max(0, input.tolerance ?? 0);
  return input.objects
    .map((object) => {
      const left = Math.max(0, -object.x);
      const top = Math.max(0, -object.y);
      const right = Math.max(0, object.x + object.width - input.width);
      const bottom = Math.max(0, object.y + object.height - input.height);
      const overflow = Math.max(left, top, right, bottom);
      return {
        id: object.id,
        label: object.label,
        left,
        top,
        right,
        bottom,
        overflow,
      };
    })
    .filter((issue) => issue.overflow > tolerance);
}

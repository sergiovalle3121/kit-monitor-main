export type CadLayerId =
  | "layout"
  | "equipment"
  | "flow"
  | "aisles"
  | "measurements"
  | "safety";

export interface CadLayer {
  id: CadLayerId;
  label: string;
  color: string;
  visible: boolean;
  locked: boolean;
}

export type CadLayerAssignments = Record<string, CadLayerId>;

export interface CadLayerObjectRef {
  id: string;
  fallbackLayer: CadLayerId;
  area?: number;
}

export interface CadLayerSummary extends CadLayer {
  count: number;
  assignedCount: number;
  area: number;
}

export const DEFAULT_CAD_LAYERS: CadLayer[] = [
  {
    id: "layout",
    label: "Layout",
    color: "#38bdf8",
    visible: true,
    locked: false,
  },
  {
    id: "equipment",
    label: "Equipment",
    color: "#a78bfa",
    visible: true,
    locked: false,
  },
  { id: "flow", label: "Flow", color: "#34d399", visible: true, locked: false },
  {
    id: "aisles",
    label: "Aisles",
    color: "#fbbf24",
    visible: true,
    locked: false,
  },
  {
    id: "measurements",
    label: "Measurements",
    color: "#f472b6",
    visible: true,
    locked: false,
  },
  {
    id: "safety",
    label: "Safety",
    color: "#fb7185",
    visible: true,
    locked: false,
  },
];

export function toggleCadLayerVisible(
  layers: CadLayer[],
  id: CadLayerId,
): CadLayer[] {
  return layers.map((layer) =>
    layer.id === id ? { ...layer, visible: !layer.visible } : layer,
  );
}

export function toggleCadLayerLocked(
  layers: CadLayer[],
  id: CadLayerId,
): CadLayer[] {
  return layers.map((layer) =>
    layer.id === id ? { ...layer, locked: !layer.locked } : layer,
  );
}

export function showAllCadLayers(layers: CadLayer[]): CadLayer[] {
  return layers.map((layer) => ({ ...layer, visible: true }));
}

export function unlockAllCadLayers(layers: CadLayer[]): CadLayer[] {
  return layers.map((layer) => ({ ...layer, locked: false }));
}

export function isolateCadLayerVisibility(
  layers: CadLayer[],
  id: CadLayerId,
): CadLayer[] {
  return layers.map((layer) => ({ ...layer, visible: layer.id === id }));
}

export function hideEmptyCadLayers(
  layers: CadLayer[],
  summaries: CadLayerSummary[],
): CadLayer[] {
  const counts = new Map(
    summaries.map((summary) => [summary.id, summary.count]),
  );
  return layers.map((layer) => ({
    ...layer,
    visible: (counts.get(layer.id) ?? 0) > 0,
  }));
}

export function assignObjectsToLayer(
  assignments: CadLayerAssignments,
  objectIds: string[],
  layerId: CadLayerId,
): CadLayerAssignments {
  const next = { ...assignments };
  for (const id of objectIds) next[id] = layerId;
  return next;
}

export function layerForObject(
  assignments: CadLayerAssignments,
  objectId: string,
  fallback: CadLayerId,
): CadLayerId {
  return assignments[objectId] ?? fallback;
}

export function isLayerLocked(layers: CadLayer[], id: CadLayerId): boolean {
  return !!layers.find((layer) => layer.id === id)?.locked;
}

export function isLayerVisible(layers: CadLayer[], id: CadLayerId): boolean {
  return layers.find((layer) => layer.id === id)?.visible ?? true;
}

export function isObjectLayerLocked(
  layers: CadLayer[],
  assignments: CadLayerAssignments,
  objectId: string,
  fallback: CadLayerId,
): boolean {
  return isLayerLocked(layers, layerForObject(assignments, objectId, fallback));
}

export function editableObjectIds(
  layers: CadLayer[],
  assignments: CadLayerAssignments,
  objects: Array<{ id: string; fallbackLayer: CadLayerId }>,
): string[] {
  return objects
    .filter(
      (object) =>
        !isObjectLayerLocked(
          layers,
          assignments,
          object.id,
          object.fallbackLayer,
        ),
    )
    .map((object) => object.id);
}

export function summarizeCadLayers(
  layers: CadLayer[],
  assignments: CadLayerAssignments,
  objects: CadLayerObjectRef[],
): CadLayerSummary[] {
  const counts = new Map<
    CadLayerId,
    { count: number; assignedCount: number; area: number }
  >();
  for (const object of objects) {
    const assignedLayer = assignments[object.id];
    const layerId = assignedLayer ?? object.fallbackLayer;
    const row = counts.get(layerId) ?? { count: 0, assignedCount: 0, area: 0 };
    row.count += 1;
    if (assignedLayer) row.assignedCount += 1;
    row.area += object.area ?? 0;
    counts.set(layerId, row);
  }
  return layers.map((layer) => {
    const row = counts.get(layer.id);
    return {
      ...layer,
      count: row?.count ?? 0,
      assignedCount: row?.assignedCount ?? 0,
      area: row?.area ?? 0,
    };
  });
}

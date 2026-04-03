export type DifficultyLevel = 'baja' | 'media' | 'alta';
export type ConteoStatus = 'pendiente' | 'ok' | 'desviacion' | 'critico';

export interface ConteoMaterial {
  id: string;
  material: string;
  descripcion: string;
  location: string;
  location2: string;
  sapQuantity: number;
  precio: number;
  tipo: string;
  bulk: boolean;
  familia: string;
  cantMin: number;
  cantMax: number;
  nivelProceso: string;
  presentacion: string;
  difficulty: DifficultyLevel;
  difficultyScore: number;
  priorityScore: number;
}

export interface ConteoAssignment {
  materialId: string;
  dia: number;
  turno: string;
  completado: boolean;
}

export interface ConteoDayPlan {
  dia: number;
  assignments: ConteoAssignment[];
  totalWeight: number;
}

export interface ConteoLog {
  id: string;
  materialId: string;
  material: string;
  descripcion: string;
  location: string;
  sapQuantity: number;
  physicalQuantity: number | null;
  delta: number | null;
  deltaPct: number | null;
  status: ConteoStatus;
  dia: number;
  fecha: string;
  turno: string;
  observaciones: string;
}

export interface PlanConfig {
  days: number;
  turnos: string[];
}

export interface ConteoSummary {
  total: number;
  completed: number;
  pending: number;
  ok: number;
  desviacion: number;
  critico: number;
  accuracyPct: number;
}

export interface ConteoParseMeta {
  fileName: string;
  sheetNames: string[];
  primarySheet: string;
  headerRow: number;
  detectedColumns: string[];
  warnings: string[];
  recordCount: number;
}

export interface ConteoTurnoLoad {
  turno: string;
  total: number;
  pending: number;
  completed: number;
}

export interface ConteoDayLoad {
  dia: number;
  total: number;
  pending: number;
  completed: number;
  totalWeight: number;
  turnos: ConteoTurnoLoad[];
}

export interface ConteoDeltaBucket {
  label: string;
  count: number;
  ratio: number;
}

export interface ConteoLocationSummary {
  location: string;
  total: number;
  pending: number;
  desviacion: number;
  critico: number;
}

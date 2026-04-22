export interface VisualAid {
  id: string;
  model: string;
  title: string;
  process: string;
  area?: string;
  revision?: string;
  pdfUrl: string;
  isActive: boolean;
  notes?: string;
  uploadedBy?: string;
  createdAt: string;
  updatedAt: string;
  annotations?: Array<{x: number, y: number, text: string}>;
}

export type MostRecommendation = 'Óptimo' | 'Aceptable' | 'Revisar' | 'Reubicar';

export interface DispositionItem {
  id: string;
  model: string;
  bayId: number;
  partNumber: string;
  description?: string;
  usageFrequency: number;
  picksPerCycle: number;
  handlingDifficulty: 1 | 2 | 3 | 4 | 5;
  weightCategory: 1 | 2 | 3 | 4 | 5;
  distanceCategory: 1 | 2 | 3 | 4 | 5;
  criticality: 1 | 2 | 3 | 4 | 5;
  notes?: string;
  mostScore: number;
  recommendation: MostRecommendation;
  createdAt: string;
  updatedAt: string;
}

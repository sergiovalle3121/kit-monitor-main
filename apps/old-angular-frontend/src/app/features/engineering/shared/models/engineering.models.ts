export type EngineeringDocumentType = 'VISUAL_AID' | 'PLANT_LAYOUT';

export interface EngineeringScope {
  buildingId?: string;
  programId?: string;
  lineId?: string;
  model?: string;
}

export interface EngineeringViewport {
  zoom: number;
  x: number;
  y: number;
}

export interface EngineeringDocument {
  id?: string;
  name: string;
  documentType: EngineeringDocumentType;
  schemaVersion: number;
  scope: EngineeringScope;
  viewport: EngineeringViewport;
  units: string;
  content: {
    layers: EngineeringLayer[];
    objects?: any[];
    geometry?: any[];
  };
  metadata?: any;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EngineeringLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
}

export type EditorTool = 'SELECT' | 'RECT' | 'CIRCLE' | 'LINE' | 'ARROW' | 'TEXT' | 'PATH' | 'PAN';

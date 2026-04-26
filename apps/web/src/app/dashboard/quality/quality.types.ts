export type NcrSeverity = "Low" | "Medium" | "High" | "Critical";

export type NcrStatus = "Open" | "Under Review" | "Contained" | "Closed";

export interface NCR {
  id: string;
  partNumber: string;
  issue: string;
  status: NcrStatus;
  severity: NcrSeverity;
  rootCause?: string;
  closureDate?: string;
  createdAt: string;
  owner: string;
}

export type NcrSeverityFilter = NcrSeverity | "all";

export type NcrStatusFilter = NcrStatus | "all";

export type InspectionResult = "pass" | "fail" | "conditional" | "pending";

export interface QualityInspection {
  id: string;
  inspectedQuantity: number;
  passedQuantity: number;
  result: InspectionResult;
}

export class CreatePlanDto {
  workOrder?: string;
  model: string;
  line: number;   // 1–7
  bahia?: number;   // 1–6 (optional — kit is per line)
  quantity: number;
  shift: string;    // T1 | T2 | T3
  scheduledAt?: string; // ISO date string
  sequence?: number;
}

export class RegisterOutcomeDto {
  actualQty: number;
  shortageEvents?: number;
  overtimeHours?: number;
  details?: Record<string, any>;
}

export class CreatePlanScenarioDto {
  runId?: number;
  name: string;
  assumptions: {
    horizonDays: number;
    dailyCapacityUnits: number;
    efficiencyPercent: number;
    plannedDemandUnits: number;
    leadTimeDays?: number;
    scrapRate?: number;
  };
  constraints?: Record<string, any>;
}

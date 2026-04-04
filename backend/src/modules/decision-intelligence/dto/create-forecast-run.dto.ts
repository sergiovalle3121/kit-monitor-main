export class CreateForecastRunDto {
  name: string;
  sourceFile?: string;
  assumptions?: Record<string, any>;
  series: Array<{
    material: string;
    location?: string;
    championMethod: string;
    mape: number;
    mad: number;
    bias: number;
    forecastNext: number;
    forecastHorizon?: number[];
    diagnostics?: Record<string, any>;
    confidenceScore?: number;
  }>;
}

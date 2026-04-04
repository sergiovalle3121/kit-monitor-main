import { DispositionItem, MostRecommendation } from './ie-data.models';

export interface MostEvaluation {
  score: number;
  recommendation: MostRecommendation;
}

export function evaluateMiniMost(input: Pick<DispositionItem,
  'usageFrequency' | 'picksPerCycle' | 'handlingDifficulty' | 'weightCategory' | 'distanceCategory' | 'criticality'>,
): MostEvaluation {
  const score =
    input.usageFrequency * 3 +
    input.picksPerCycle * 4 +
    input.criticality * 3 +
    input.distanceCategory * 2 +
    input.handlingDifficulty * 2 +
    input.weightCategory;

  if (score <= 35) return { score, recommendation: 'Óptimo' };
  if (score <= 55) return { score, recommendation: 'Aceptable' };
  if (score <= 75) return { score, recommendation: 'Revisar' };
  return { score, recommendation: 'Reubicar' };
}
